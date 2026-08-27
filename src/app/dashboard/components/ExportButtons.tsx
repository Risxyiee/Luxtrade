'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Download, FileJson, FileText, BarChart3 } from 'lucide-react'
import {
  exportJournalToPDF,
  exportTradesToCSV,
  exportJournalToCSV,
  exportAllDataAsJSON,
  printJournal,
  JournalEntryForPDF,
  TradeForCSV,
} from '@/lib/pdf-export'

interface ExportButtonsProps {
  journalEntries?: JournalEntryForPDF[]
  trades?: TradeForCSV[]
  isDisabled?: boolean
}

export function ExportButtons({ journalEntries = [], trades = [], isDisabled = false }: ExportButtonsProps) {
  const hasData = journalEntries.length > 0 || trades.length > 0

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={!hasData || isDisabled}
          className="border-blue-500/30 text-cyan-400 disabled:opacity-50"
        >
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-[#12091a] border-blue-500/30">
        {/* Journal Exports */}
        {journalEntries.length > 0 && (
          <>
            <div className="px-2 py-1.5 text-xs font-semibold text-lux-text-secondary dark:text-gray-400 uppercase">Journal</div>
            <DropdownMenuItem
              onClick={() => exportJournalToPDF(journalEntries, `journal-${new Date().toISOString().split('T')[0]}.pdf`)}
              className="cursor-pointer text-lux-text-primary dark:text-gray-300 hover:text-lux-text-primary dark:hover:text-white"
            >
              <FileText className="w-4 h-4 mr-2 text-cyan-400" />
              <span>Download as PDF</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => exportJournalToCSV(journalEntries, `journal-${new Date().toISOString().split('T')[0]}.csv`)}
              className="cursor-pointer text-lux-text-primary dark:text-gray-300 hover:text-lux-text-primary dark:hover:text-white"
            >
              <BarChart3 className="w-4 h-4 mr-2 text-emerald-400" />
              <span>Download as CSV</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => printJournal(journalEntries)}
              className="cursor-pointer text-lux-text-primary dark:text-gray-300 hover:text-lux-text-primary dark:hover:text-white"
            >
              <FileText className="w-4 h-4 mr-2 text-blue-400" />
              <span>Print</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-blue-500/10" />
          </>
        )}

        {/* Trades Exports */}
        {trades.length > 0 && (
          <>
            <div className="px-2 py-1.5 text-xs font-semibold text-lux-text-secondary dark:text-gray-400 uppercase">Trades</div>
            <DropdownMenuItem
              onClick={() => exportTradesToCSV(trades, `trades-${new Date().toISOString().split('T')[0]}.csv`)}
              className="cursor-pointer text-lux-text-primary dark:text-gray-300 hover:text-lux-text-primary dark:hover:text-white"
            >
              <BarChart3 className="w-4 h-4 mr-2 text-emerald-400" />
              <span>Download as CSV</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-blue-500/10" />
          </>
        )}

        {/* Full Backup */}
        {hasData && (
          <>
            <div className="px-2 py-1.5 text-xs font-semibold text-lux-text-secondary dark:text-gray-400 uppercase">Backup</div>
            <DropdownMenuItem
              onClick={() =>
                exportAllDataAsJSON(
                  trades,
                  journalEntries,
                  `luxtrade-backup-${new Date().toISOString().split('T')[0]}.json`
                )
              }
              className="cursor-pointer text-lux-text-primary dark:text-gray-300 hover:text-lux-text-primary dark:hover:text-white"
            >
              <FileJson className="w-4 h-4 mr-2 text-cyan-400" />
              <span>Full Backup (JSON)</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
