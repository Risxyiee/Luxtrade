'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import {
  Download, FileJson, FileText, BarChart3, Receipt, Printer, FileSpreadsheet
} from 'lucide-react'
import type { Trade, JournalEntry, Analytics } from '@/types'
import {
  exportToPDF,
  exportTradesToCSV,
  exportJournalToCSV,
  exportJournalToPDF,
  exportAllDataAsJSON,
  exportTaxReportPDF,
} from '@/lib/export-utils'
import { printJournal } from '@/lib/pdf-export'

interface ExportButtonsProps {
  journalEntries?: JournalEntry[]
  trades?: Trade[]
  analytics?: Analytics | null
  isPro?: boolean
  isDisabled?: boolean
  language?: 'id' | 'en'
  /** When true, shows the dashboard report export option */
  showDashboardReport?: boolean
  username?: string
}

const labels = {
  id: {
    export: 'Ekspor',
    journal: 'Jurnal',
    downloadPdf: 'Unduh PDF',
    downloadCsv: 'Unduh CSV',
    print: 'Cetak',
    trades: 'Transaksi',
    backup: 'Backup',
    fullBackup: 'Full Backup (JSON)',
    dashboardReport: 'Laporan Dashboard (PDF)',
    taxReport: 'Laporan Pajak SPT (PRO)',
    taxReportPro: 'Fitur PRO',
  },
  en: {
    export: 'Export',
    journal: 'Journal',
    downloadPdf: 'Download PDF',
    downloadCsv: 'Download CSV',
    print: 'Print',
    trades: 'Trades',
    backup: 'Backup',
    fullBackup: 'Full Backup (JSON)',
    dashboardReport: 'Dashboard Report (PDF)',
    taxReport: 'Tax Report (SPT)',
    taxReportPro: 'PRO Feature',
  },
} as const

export function ExportButtons({
  journalEntries = [],
  trades = [],
  analytics = null,
  isPro = false,
  isDisabled = false,
  language = 'id',
  showDashboardReport = false,
  username = 'Trader',
}: ExportButtonsProps) {
  const hasData = journalEntries.length > 0 || trades.length > 0
  const t = labels[language]
  const today = new Date().toISOString().split('T')[0]

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
          {t.export}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 bg-[#12091a] border-blue-500/30">
        {/* Dashboard Report — only in dashboard context */}
        {showDashboardReport && trades.length > 0 && analytics && (
          <>
            <DropdownMenuLabel className="text-xs font-semibold text-lux-text-secondary dark:text-gray-400 uppercase">{language === 'id' ? 'Laporan' : 'Report'}</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => exportToPDF(trades, analytics, username)}
              className="cursor-pointer text-lux-text-primary dark:text-gray-300 hover:text-lux-text-primary dark:hover:text-white"
            >
              <FileText className="w-4 h-4 mr-2 text-amber-400" />
              <span>{t.dashboardReport}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-blue-500/10" />
          </>
        )}

        {/* Journal Exports */}
        {journalEntries.length > 0 && (
          <>
            <DropdownMenuLabel className="text-xs font-semibold text-lux-text-secondary dark:text-gray-400 uppercase">{t.journal}</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => exportJournalToPDF(journalEntries, `journal-${today}.pdf`)}
              className="cursor-pointer text-lux-text-primary dark:text-gray-300 hover:text-lux-text-primary dark:hover:text-white"
            >
              <FileText className="w-4 h-4 mr-2 text-cyan-400" />
              <span>{t.downloadPdf}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => exportJournalToCSV(journalEntries, `journal-${today}.csv`)}
              className="cursor-pointer text-lux-text-primary dark:text-gray-300 hover:text-lux-text-primary dark:hover:text-white"
            >
              <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-400" />
              <span>{t.downloadCsv}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => printJournal(journalEntries)}
              className="cursor-pointer text-lux-text-primary dark:text-gray-300 hover:text-lux-text-primary dark:hover:text-white"
            >
              <Printer className="w-4 h-4 mr-2 text-blue-400" />
              <span>{t.print}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-blue-500/10" />
          </>
        )}

        {/* Trades Exports */}
        {trades.length > 0 && (
          <>
            <DropdownMenuLabel className="text-xs font-semibold text-lux-text-secondary dark:text-gray-400 uppercase">{t.trades}</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => exportTradesToCSV(trades, `trades-${today}.csv`)}
              className="cursor-pointer text-lux-text-primary dark:text-gray-300 hover:text-lux-text-primary dark:hover:text-white"
            >
              <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-400" />
              <span>{t.downloadCsv}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-blue-500/10" />
          </>
        )}

        {/* Tax Report — PRO only */}
        {trades.length > 0 && (
          <>
            <DropdownMenuLabel className="text-xs font-semibold text-lux-text-secondary dark:text-gray-400 uppercase">
              <Receipt className="w-3 h-3 inline mr-1" />
              {language === 'id' ? 'Pajak' : 'Tax'}
            </DropdownMenuLabel>
            {isPro ? (
              <DropdownMenuItem
                onClick={() => exportTaxReportPDF(trades, username)}
                className="cursor-pointer text-lux-text-primary dark:text-gray-300 hover:text-lux-text-primary dark:hover:text-white"
              >
                <BarChart3 className="w-4 h-4 mr-2 text-amber-400" />
                <span>{t.taxReport}</span>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                disabled
                className="text-lux-text-muted dark:text-gray-500 cursor-not-allowed"
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                <span>{t.taxReport}</span>
                <span className="ml-auto text-[10px] text-amber-400/60 font-medium">{t.taxReportPro}</span>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator className="bg-blue-500/10" />
          </>
        )}

        {/* Full Backup */}
        {hasData && (
          <>
            <DropdownMenuLabel className="text-xs font-semibold text-lux-text-secondary dark:text-gray-400 uppercase">{t.backup}</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() =>
                exportAllDataAsJSON(
                  trades,
                  journalEntries,
                  analytics,
                  `luxtrade-backup-${today}.json`
                )
              }
              className="cursor-pointer text-lux-text-primary dark:text-gray-300 hover:text-lux-text-primary dark:hover:text-white"
            >
              <FileJson className="w-4 h-4 mr-2 text-cyan-400" />
              <span>{t.fullBackup}</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
