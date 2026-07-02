'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  BookOpen, Plus, Edit, Trash2, Smile, Meh, Frown, Sparkles,
  BarChart3, Brain, Zap, Crown, RefreshCw, Calendar, Tag, Image as ImageIcon, Link2, ChevronLeft, ChevronRight, FileText, Printer, X, PenLine
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { motion, AnimatePresence } from 'framer-motion'
import { safeParseTags } from '@/lib/parseUtils'
import { toast } from 'sonner'
import { JournalFilterPanel } from '@/app/dashboard/components/JournalFilterPanel'

// ==================== INTERFACES ====================

interface JournalEntry {
  id: string
  title: string
  content: string
  mood: string | null
  market_condition: string | null
  created_at: string
  tags?: string | null
  image_url?: string | null
  linked_trades_count?: number
}

// ==================== DAILY PROMPTS ====================

const DAILY_PROMPTS = [
  "Apa hal terbaik yang Anda pelajari dari trading hari ini?",
  "Gambarkan emosi Anda saat trading hari ini. Apa yang mempengaruhi?",
  "Trade mana yang paling berkesan minggu ini dan mengapa?",
  "Apa kesalahan yang sering Anda ulang? Bagaimana cara menghentikannya?",
  "Bagaimana kondisi market hari ini? Apakah sesuai ekspektasi?",
  "Jika bisa mengubah satu keputusan trading minggu ini, apa itu?",
  "Apa goal trading Anda untuk minggu depan?",
  "Evaluasi risk management Anda minggu ini. Apakah sudah konsisten?",
  "Pair apa yang paling cocok dengan gaya trading Anda?",
  "Apa pola market yang paling sering Anda manfaatkan?",
  "Ceritakan trade terbaik Anda dan apa yang membuatnya berhasil.",
  "Bagaimana cara Anda mengatasi loss berturut-turut?",
  "Apa indikator atau setup yang paling reliable untuk Anda?",
  "Seberapa baik Anda mengikuti trading plan minggu ini?",
  "Apa yang akan Anda lakukan berbeda di minggu depan?",
]

// ==================== HELPER FUNCTIONS ====================

function getDailyPrompt() {
  const today = new Date()
  const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24))
  return DAILY_PROMPTS[dayOfYear % DAILY_PROMPTS.length]
}

function getMoodIcon(mood: string | null) {
  switch (mood) {
    case 'confident': return <Smile className="w-4 h-4 text-emerald-400" />
    case 'neutral': return <Meh className="w-4 h-4 text-purple-400" />
    case 'anxious': return <Frown className="w-4 h-4 text-red-400" />
    default: return null
  }
}

function getMoodEmoji(mood: string | null) {
  switch (mood) {
    case 'confident': return '😊'
    case 'neutral': return '😐'
    case 'anxious': return '😰'
    default: return '📝'
  }
}

// ==================== JOURNAL TAB COMPONENT ====================

interface JournalTabProps {
  entries: JournalEntry[]
  loading: boolean
  onAdd: () => void
  onView: (entry: JournalEntry) => void
  onEdit: (entry: JournalEntry) => void
  onDelete: (id: string) => void
  isPro?: boolean
  onUpgrade?: () => void
}

// Separate Calendar View Component (defined outside to avoid component-in-render warning)
interface CalendarViewProps {
  entries: JournalEntry[]
  currentMonth: Date
  setCurrentMonth: (date: Date) => void
  onView: (entry: JournalEntry) => void
}

function CalendarView({ entries, currentMonth, setCurrentMonth, onView }: CalendarViewProps) {
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startDayOfWeek = firstDay.getDay()
    const totalDays = lastDay.getDate()
    return { startDayOfWeek, totalDays }
  }

  const getEntriesForDate = (date: Date) => {
    const dateStr = date.toDateString()
    return entries.filter(e => new Date(e.created_at).toDateString() === dateStr)
  }

  const { startDayOfWeek, totalDays } = getDaysInMonth(currentMonth)
  const monthName = currentMonth.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
  const days = []

  // Empty cells for days before the first day of the month
  for (let i = 0; i < startDayOfWeek; i++) {
    days.push(<div key={`empty-${i}`} className="h-24" />)
  }

  // Days of the month
  for (let day = 1; day <= totalDays; day++) {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
    const dayEntries = getEntriesForDate(date)
    const isToday = date.toDateString() === new Date().toDateString()

    days.push(
      <div
        key={day}
        onClick={() => dayEntries.length > 0 && onView(dayEntries[0])}
        className={`h-24 p-2 rounded-lg border border-white/5 transition-all cursor-pointer hover:border-purple-500/30 ${
          isToday ? 'bg-purple-500/10 border-purple-500/30' : 'bg-white/5'
        } ${dayEntries.length > 0 ? 'hover:bg-white/10' : ''}`}
      >
        <div className="flex items-center justify-between mb-1">
          <span className={`text-sm font-medium ${isToday ? 'text-purple-400' : 'text-gray-400'}`}>
            {day}
          </span>
          {dayEntries.length > 0 && (
            <div className="flex gap-1">
              {dayEntries.slice(0, 3).map((e) => (
                <div
                  key={e.id}
                  className={`w-2 h-2 rounded-full ${
                    e.mood === 'confident' ? 'bg-emerald-400' :
                    e.mood === 'anxious' ? 'bg-red-400' :
                    'bg-purple-400'
                  }`}
                />
              ))}
              {dayEntries.length > 3 && (
                <span className="text-xs text-gray-500">+{dayEntries.length - 3}</span>
              )}
            </div>
          )}
        </div>
        {dayEntries.length > 0 && (
          <div className="space-y-1">
            {dayEntries.slice(0, 2).map((e) => (
              <p key={e.id} className="text-xs text-gray-400 truncate">
                {e.title}
              </p>
            ))}
            {dayEntries.length > 2 && (
              <p className="text-xs text-gray-500">+{dayEntries.length - 2} more</p>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
              className="text-gray-400 hover:text-white"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <CardTitle className="text-lg">{monthName}</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
              className="text-gray-400 hover:text-white"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentMonth(new Date())}
            className="border-purple-500/30 text-purple-400"
          >
            Today
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-2 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="text-center text-xs text-gray-500 font-medium">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">{days}</div>
      </CardContent>
    </Card>
  )
}

function JournalTab({
  entries,
  loading,
  onAdd,
  onView,
  onEdit,
  onDelete,
  isPro = true,
  onUpgrade
}: JournalTabProps) {
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [journalAnalytics, setJournalAnalytics] = useState<Record<string, any> | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [reminderDismissed, setReminderDismissed] = useState(false)

  // Check if reminder was dismissed this session
  useEffect(() => {
    const dismissed = sessionStorage.getItem('journal-reminder-dismissed')
    if (dismissed === new Date().toDateString()) {
      setReminderDismissed(true)
    }
  }, [])

  const dismissReminder = () => {
    setReminderDismissed(true)
    sessionStorage.setItem('journal-reminder-dismissed', new Date().toDateString())
  }

  // Filter state for advanced search
  const [filteredEntries, setFilteredEntries] = useState<JournalEntry[]>(entries)

  // Keep filteredEntries in sync when entries prop changes
  useEffect(() => {
    setFilteredEntries(entries)
  }, [entries])

  // ============ FEATURE 1: EXPORT PDF ============
  const handleExportPDF = useCallback(async () => {
    try {
      const jsPDFModule = await import('jspdf')
      const jsPDF = jsPDFModule.default
      await import('jspdf-autotable')

      const doc = new jsPDF()
      const exportDate = new Date().toLocaleDateString('id-ID', {
        day: 'numeric', month: 'long', year: 'numeric'
      })

      // Dark header background
      doc.setFillColor(15, 5, 29) // #0f051d
      doc.rect(0, 0, 210, 40, 'F')

      // Purple accent line
      doc.setFillColor(139, 92, 246) // purple-500
      doc.rect(0, 40, 210, 2, 'F')

      // Title
      doc.setTextColor(139, 92, 246)
      doc.setFontSize(22)
      doc.text('LuxTrade Journal Export', 14, 20)

      // Date
      doc.setTextColor(180, 160, 200)
      doc.setFontSize(11)
      doc.text(exportDate, 14, 30)

      // Total entries
      doc.setTextColor(200, 200, 200)
      doc.text(`${filteredEntries.length} entries`, 160, 30)

      let yPos = 50

      if (filteredEntries.length === 0) {
        doc.setTextColor(150, 150, 150)
        doc.setFontSize(14)
        doc.text('No journal entries to export.', 14, yPos)
      } else {
        // Table with summary data
        const tableData = filteredEntries.map((entry, index) => [
          (index + 1).toString(),
          new Date(entry.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
          entry.title,
          entry.mood || '-',
          entry.market_condition || '-',
          entry.tags ? entry.tags.split(',').map((t: string) => t.trim()).join(', ') : '-'
        ])

        ;(doc as any).autoTable({
          startY: yPos,
          head: [['#', 'Date', 'Title', 'Mood', 'Market', 'Tags']],
          body: tableData,
          theme: 'grid',
          styles: {
            fontSize: 8,
            cellPadding: 3,
            textColor: [80, 80, 80],
            lineColor: [200, 200, 200],
            lineWidth: 0.1
          },
          headStyles: {
            fillColor: [139, 92, 246],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 8
          },
          columnStyles: {
            0: { cellWidth: 10 },
            1: { cellWidth: 25 },
            2: { cellWidth: 55 },
            3: { cellWidth: 22 },
            4: { cellWidth: 28 },
            5: { cellWidth: 50 }
          },
          alternateRowStyles: {
            fillColor: [248, 245, 252]
          }
        })

        yPos = (doc as any).lastAutoTable.finalY + 10

        // Each entry content section
        filteredEntries.forEach((entry) => {
          // Check if we need a new page
          if (yPos > 250) {
            doc.addPage()
            yPos = 20
          }

          // Entry title
          doc.setFontSize(12)
          doc.setTextColor(80, 40, 120)
          doc.text(entry.title, 14, yPos)
          yPos += 6

          // Entry date & mood
          doc.setFontSize(9)
          doc.setTextColor(120, 120, 120)
          const entryDate = new Date(entry.created_at).toLocaleDateString('id-ID', {
            day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
          })
          const moodText = entry.mood ? ` | Mood: ${entry.mood}` : ''
          const marketText = entry.market_condition ? ` | Market: ${entry.market_condition}` : ''
          doc.text(`${entryDate}${moodText}${marketText}`, 14, yPos)
          yPos += 6

          // Content (handle multi-line)
          doc.setFontSize(10)
          doc.setTextColor(60, 60, 60)
          const lines = doc.splitTextToSize(entry.content, 180)
          doc.text(lines, 14, yPos)
          yPos += lines.length * 5 + 8
        })
      }

      // Footer
      const pageCount = doc.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)

        // Dark footer background
        doc.setFillColor(15, 5, 29)
        doc.rect(0, 282, 210, 15, 'F')

        // Purple accent line above footer
        doc.setFillColor(139, 92, 246)
        doc.rect(0, 280, 210, 2, 'F')

        doc.setTextColor(180, 160, 200)
        doc.setFontSize(8)
        doc.text('Generated by LuxTrade', 14, 290)
        doc.text(`Page ${i} of ${pageCount}`, 160, 290)
      }

      doc.save('luxtrade-journal.pdf')
      toast.success('Journal exported to PDF!')
    } catch (error) {
      console.error('PDF export error:', error)
      toast.error('Failed to export PDF')
    }
  }, [filteredEntries])

  // ============ FEATURE 2: PRINT ============
  const handlePrint = useCallback(() => {
    const entriesToPrint = filteredEntries
    const now = new Date()
    const dateRange = entriesToPrint.length > 0
      ? `${new Date(entriesToPrint[entriesToPrint.length - 1].created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} — ${new Date(entriesToPrint[0].created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`
      : now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

    const entriesHtml = entriesToPrint.map((entry) => `
      <div style="margin-bottom: 24px; padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; page-break-inside: avoid;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <h3 style="font-size: 16px; font-weight: 700; margin: 0; color: #1a1a2e;">${entry.title}</h3>
          <span style="font-size: 12px; color: #6b7280;">${new Date(entry.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <div style="display: flex; gap: 8px; margin-bottom: 12px;">
          ${entry.mood ? `<span style="display: inline-block; padding: 2px 10px; border-radius: 9999px; font-size: 12px; font-weight: 500; background: ${entry.mood === 'confident' ? '#d1fae5' : entry.mood === 'anxious' ? '#fee2e2' : '#ede9fe'}; color: ${entry.mood === 'confident' ? '#065f46' : entry.mood === 'anxious' ? '#991b1b' : '#5b21b6'};">${entry.mood}</span>` : ''}
          ${entry.market_condition ? `<span style="display: inline-block; padding: 2px 10px; border-radius: 9999px; font-size: 12px; font-weight: 500; background: #f3e8ff; color: #7c3aed;">${entry.market_condition}</span>` : ''}
        </div>
        <p style="font-size: 13px; line-height: 1.6; color: #374151; white-space: pre-wrap; margin: 0;">${entry.content}</p>
      </div>
    `).join('')

    const html = `<!DOCTYPE html>
    <html>
    <head>
      <title>LuxTrade Journal — Print</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
          background: #ffffff;
          color: #1a1a2e;
          padding: 24px;
          max-width: 800px;
          margin: 0 auto;
        }
        .header {
          text-align: center;
          margin-bottom: 32px;
          padding-bottom: 16px;
          border-bottom: 2px solid #7c3aed;
        }
        .header h1 { font-size: 24px; color: #1a1a2e; margin-bottom: 4px; }
        .header .date { font-size: 14px; color: #6b7280; }
        .header .count { font-size: 12px; color: #9ca3af; margin-top: 4px; }
        .footer {
          text-align: center; margin-top: 32px; padding-top: 12px;
          border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af;
        }
        @media print {
          body { padding: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>LuxTrade Journal</h1>
        <div class="date">${dateRange}</div>
        <div class="count">${entriesToPrint.length} entries</div>
      </div>
      ${entriesHtml}
      <div class="footer">Generated by LuxTrade — ${now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
    </body>
    </html>`

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(html)
      printWindow.document.close()
      printWindow.onload = () => {
        printWindow.print()
        printWindow.onafterprint = () => printWindow.close()
      }
    }
  }, [filteredEntries])

  // Toggle analytics and fetch data
  const toggleAnalytics = useCallback(async () => {
    const willShow = !showAnalytics
    setShowAnalytics(willShow)
    if (willShow && !journalAnalytics && entries.length > 0) {
      setAnalyticsLoading(true)
      try {
        const res = await fetch('/api/journal?analytics=true')
        const data = await res.json()
        if (data.analytics) setJournalAnalytics(data.analytics)
      } catch {}
      setAnalyticsLoading(false)
    }
  }, [showAnalytics, journalAnalytics, entries.length])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    )
  }

  const todayPrompt = getDailyPrompt()
  const todayStr = new Date().toDateString()
  const hasTodayEntry = filteredEntries.some(e => new Date(e.created_at).toDateString() === todayStr)

  // Calculate quick streak locally
  const uniqueDates = [...new Set(entries.map(e => new Date(e.created_at).toDateString()))]
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
  let quickStreak = 0
  if (uniqueDates.length > 0) {
    const firstDate = new Date(uniqueDates[0])
    firstDate.setHours(0, 0, 0, 0)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const diffDays = Math.floor((today.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays <= 1) {
      quickStreak = 1
      for (let i = 1; i < uniqueDates.length; i++) {
        const prev = new Date(uniqueDates[i - 1])
        const curr = new Date(uniqueDates[i])
        prev.setHours(0, 0, 0, 0)
        curr.setHours(0, 0, 0, 0)
        if (Math.floor((prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24)) === 1) {
          quickStreak++
        } else break
      }
    }
  }

  // Calendar helpers
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startDayOfWeek = firstDay.getDay()
    const totalDays = lastDay.getDate()
    return { startDayOfWeek, totalDays }
  }

  const getEntriesForDate = (date: Date) => {
    const dateStr = date.toDateString()
    return entries.filter(e => new Date(e.created_at).toDateString() === dateStr)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-xl font-bold">Trading Journal</h3>
          <p className="text-sm text-gray-400">Document your trading journey</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
            className={viewMode === 'list' ? 'bg-purple-500' : 'border-purple-500/30 text-purple-400'}
          >
            <BookOpen className="w-4 h-4 mr-1" /> List
          </Button>
          <Button
            variant={viewMode === 'calendar' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('calendar')}
            className={viewMode === 'calendar' ? 'bg-purple-500' : 'border-purple-500/30 text-purple-400'}
          >
            <Calendar className="w-4 h-4 mr-1" /> Calendar
          </Button>
          {entries.length > 2 && (
            <Button
              variant="outline"
              size="sm"
              onClick={toggleAnalytics}
              className="border-purple-500/30 text-purple-400"
            >
              <BarChart3 className="w-4 h-4 mr-1" />
              {showAnalytics ? 'Hide Analytics' : 'Analytics'}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
            disabled={entries.length === 0}
            className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
          >
            <FileText className="w-4 h-4 mr-1" /> Export PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            disabled={entries.length === 0}
            className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
          >
            <Printer className="w-4 h-4 mr-1" /> Print
          </Button>
          <Button onClick={onAdd} className="bg-gradient-to-r from-purple-500 to-violet-600">
            <Plus className="w-4 h-4 mr-2" />New Entry
          </Button>
        </div>
      </div>

      {/* Daily Reminder Banner */}
      {!hasTodayEntry && !reminderDismissed && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="relative overflow-hidden rounded-2xl border border-amber-500/30"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-orange-500/15" />
          <div className="relative flex items-center justify-between gap-4 p-4">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center flex-shrink-0">
                <PenLine className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-amber-200">
                  📝 Belum menulis jurnal hari ini. Catat trading kamu sekarang!
                </p>
                <p className="text-xs text-amber-300/60 mt-0.5">
                  Haven't written a journal entry today. Log your trades now!
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                size="sm"
                onClick={onAdd}
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
              >
                <PenLine className="w-4 h-4 mr-1.5" />
                Write Now
              </Button>
              <button
                onClick={dismissReminder}
                className="p-1.5 rounded-lg text-amber-300/50 hover:text-amber-200 hover:bg-amber-500/15 transition-colors"
                aria-label="Dismiss reminder"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Streak & Daily Prompt Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Streak Card */}
        <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/5 border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
                <span className="text-2xl">{quickStreak > 0 ? '🔥' : '💤'}</span>
              </div>
              <div>
                <p className="text-sm text-amber-300/70">Journal Streak</p>
                <p className="text-2xl font-bold text-amber-400">
                  {quickStreak} {quickStreak === 1 ? 'hari' : 'hari'}
                </p>
                <p className="text-xs text-amber-300/50">
                  {hasTodayEntry ? '✅ Sudah journaling hari ini!' : '📝 Belum journaling hari ini'}
                </p>
              </div>
            </div>
            {quickStreak >= 7 && (
              <div className="mt-3 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <p className="text-xs text-amber-300 font-medium">🏆 {quickStreak} hari streak! Konsisten adalah kunci trader sukses.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Daily Prompt Card */}
        <Card className="bg-gradient-to-br from-purple-500/10 to-violet-500/5 border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <p className="text-sm text-purple-300/70 font-medium">Daily Reflection Prompt</p>
            </div>
            <p className="text-white/90 text-sm italic leading-relaxed">{todayPrompt}</p>
            {!hasTodayEntry && (
              <Button
                size="sm"
                variant="outline"
                onClick={onAdd}
                className="mt-3 border-purple-500/30 text-purple-400 text-xs"
              >
                <Edit className="w-3 h-3 mr-1" /> Tulis jawabanmu
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Journal Analytics Panel */}
      <AnimatePresence>
        {showAnalytics && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            {analyticsLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 animate-spin text-purple-400" />
              </div>
            ) : journalAnalytics ? (
              <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
                <CardContent className="p-4 lg:p-6">
                  <h4 className="font-bold mb-4 flex items-center gap-2">
                    <Brain className="w-5 h-5 text-purple-400" />
                    Journal Analytics
                  </h4>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    <div className="p-3 rounded-lg bg-white/5 text-center">
                      <p className="text-2xl font-bold text-purple-400">{journalAnalytics.totalEntries}</p>
                      <p className="text-xs text-gray-500">Total Entries</p>
                    </div>
                    <div className="p-3 rounded-lg bg-white/5 text-center">
                      <p className="text-2xl font-bold text-amber-400">{journalAnalytics.longestStreak}</p>
                      <p className="text-xs text-gray-500">Longest Streak</p>
                    </div>
                    <div className="p-3 rounded-lg bg-white/5 text-center">
                      <p className="text-2xl font-bold text-emerald-400">{journalAnalytics.daysActive}</p>
                      <p className="text-xs text-gray-500">Days Active</p>
                    </div>
                    <div className="p-3 rounded-lg bg-white/5 text-center">
                      <p className="text-2xl font-bold text-cyan-400">{journalAnalytics.avgWordsPerEntry}</p>
                      <p className="text-xs text-gray-500">Avg Words</p>
                    </div>
                  </div>

                  {/* Mood Distribution */}
                  <div className="mb-6">
                    <p className="text-sm font-medium text-gray-400 mb-3">Mood Distribution</p>
                    <div className="flex items-center gap-4">
                      {[
                        { label: 'Confident', emoji: '😊', count: journalAnalytics.moodDistribution?.confident || 0, color: 'bg-emerald-500' },
                        { label: 'Neutral', emoji: '😐', count: journalAnalytics.moodDistribution?.neutral || 0, color: 'bg-purple-500' },
                        { label: 'Anxious', emoji: '😰', count: journalAnalytics.moodDistribution?.anxious || 0, color: 'bg-red-500' },
                      ].map(m => {
                        const total = journalAnalytics.totalEntries || 1
                        const pct = Math.round((m.count / total) * 100)
                        return (
                          <div key={m.label} className="flex-1">
                            <div className="flex items-center gap-1 mb-1">
                              <span className="text-sm">{m.emoji}</span>
                              <span className="text-xs text-gray-500">{m.label}</span>
                              <span className="text-xs text-gray-600 ml-auto">{pct}%</span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                              <motion.div
                                className={`h-full rounded-full ${m.color}`}
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.8, ease: 'easeOut' }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Mood Trend */}
                  {journalAnalytics.moodTrend && journalAnalytics.moodTrend.length > 1 && (
                    <div className="mb-6">
                      <p className="text-sm font-medium text-gray-400 mb-3">Mood Trend (Recent)</p>
                      <div className="flex items-end gap-2 h-20">
                        {journalAnalytics.moodTrend.map((item: any, i: number) => (
                          <div key={i} className="flex-1 flex flex-col items-center gap-1">
                            <span className="text-xs">{getMoodEmoji(
                              item.moodScore >= 3 ? 'confident' : item.moodScore >= 2 ? 'neutral' : item.moodScore >= 1 ? 'anxious' : null
                            )}</span>
                            <motion.div
                              className={`w-full rounded-t ${item.moodScore >= 3 ? 'bg-emerald-500/40' : item.moodScore >= 2 ? 'bg-purple-500/40' : 'bg-red-500/40'}`}
                              initial={{ height: 0 }}
                              animate={{ height: `${(item.moodScore / 3) * 40}px` }}
                              transition={{ duration: 0.5, delay: i * 0.1 }}
                            />
                            <span className="text-[9px] text-gray-600">{item.date}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Weekly Summary */}
                  {journalAnalytics.weeklySummary && (
                    <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-transparent border border-purple-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Zap className="w-4 h-4 text-purple-400" />
                        <p className="text-sm font-bold text-purple-300">Weekly AI Summary</p>
                      </div>
                      <p className="text-xs text-gray-400 leading-relaxed mb-2">{journalAnalytics.weeklySummary.moodAssessment}</p>
                      <p className="text-xs text-gray-500 leading-relaxed">{journalAnalytics.weeklySummary.recommendation}</p>
                      <p className="text-xs text-amber-400/70 mt-2">{journalAnalytics.weeklySummary.streakMessage}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Advanced Search/Filter Panel */}
      {entries.length > 0 && (
        <JournalFilterPanel entries={entries} onFilterChange={setFilteredEntries} />
      )}

      {/* Filtered entries count */}
      {filteredEntries.length !== entries.length && entries.length > 0 && (
        <p className="text-sm text-gray-400">
          Showing <span className="font-bold text-purple-400">{filteredEntries.length}</span> of <span className="font-bold">{entries.length}</span> entries
        </p>
      )}

      {/* Calendar View */}
      {viewMode === 'calendar' && filteredEntries.length > 0 && (
        <CalendarView 
          entries={filteredEntries} 
          currentMonth={currentMonth} 
          setCurrentMonth={setCurrentMonth}
          onView={onView}
        />
      )}

      {/* Journal Entries List */}
      {filteredEntries.length === 0 && entries.length === 0 ? (
        <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
          <CardContent className="py-16 text-center">
            <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-500" />
            <h3 className="text-lg font-semibold mb-2">No Journal Entries</h3>
            <p className="text-gray-400 mb-4">Start documenting your trades!</p>
            <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/10 max-w-sm mx-auto mb-4">
              <p className="text-xs text-purple-300/70 italic">💡 Daily Prompt: &ldquo;{todayPrompt}&rdquo;</p>
            </div>
            <Button onClick={onAdd} variant="outline" className="border-purple-500/30 text-purple-400">
              <Plus className="w-4 h-4 mr-2" /> Write First Entry
            </Button>
          </CardContent>
        </Card>
      ) : filteredEntries.length === 0 && entries.length > 0 ? (
        <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
          <CardContent className="py-12 text-center">
            <BookOpen className="w-10 h-10 mx-auto mb-3 text-gray-500" />
            <h3 className="text-lg font-semibold mb-2">No Matching Entries</h3>
            <p className="text-gray-400 text-sm">Try adjusting your search or filters</p>
          </CardContent>
        </Card>
      ) : viewMode === 'list' ? (
        <div className="grid gap-4">
          {filteredEntries.map((entry) => {
            const tags = safeParseTags(entry.tags)
            return (
            <Card
              key={entry.id}
              className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30 hover:border-purple-500/30 transition-colors cursor-pointer group"
              onClick={() => onView(entry)}
            >
              <CardContent className="p-4 lg:p-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{getMoodEmoji(entry.mood)}</span>
                    <h4 className="font-bold text-lg">{entry.title}</h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{new Date(entry.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(entry.id) }}
                      className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-gray-400 text-sm line-clamp-2">{entry.content}</p>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  {entry.mood && (
                    <Badge variant="outline" className="text-xs border-white/10 text-gray-400">
                      {getMoodIcon(entry.mood)} {entry.mood}
                    </Badge>
                  )}
                  {entry.market_condition && (
                    <Badge variant="outline" className="text-xs border-purple-500/30 text-purple-400">
                      {entry.market_condition}
                    </Badge>
                  )}
                  {/* Tags */}
                  {tags.length > 0 && tags.map((tag: string, idx: number) => (
                    <Badge key={idx} variant="outline" className="text-xs border-purple-500/30 text-purple-300">
                      <Tag className="w-2.5 h-2.5 mr-1" />
                      {tag}
                    </Badge>
                  ))}
                  {/* Image Attachment Indicator */}
                  {entry.image_url && (
                    <Badge variant="outline" className="text-xs border-cyan-500/30 text-cyan-400">
                      <ImageIcon className="w-2.5 h-2.5 mr-1" />
                      Image
                    </Badge>
                  )}
                  {/* Linked Trades Indicator */}
                  {entry.linked_trades_count && entry.linked_trades_count > 0 && (
                    <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-400">
                      <Link2 className="w-2.5 h-2.5 mr-1" />
                      {entry.linked_trades_count} trades
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )})}
        </div>
      ) : null}

      {/* PRO Upgrade Banner */}
      {!isPro && onUpgrade && (
        <Card className="bg-gradient-to-r from-amber-500/10 to-purple-500/10 border-amber-500/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Crown className="w-6 h-6 text-amber-400" />
              <div>
                <p className="text-sm font-bold text-white">Unlock Advanced Journal Analytics</p>
                <p className="text-xs text-gray-400">Get AI summaries, mood charts, and weekly reports with PRO</p>
              </div>
            </div>
            <Button onClick={onUpgrade} size="sm" className="bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold">
              Upgrade PRO
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default JournalTab
