'use client'

import { motion } from 'framer-motion'
import DashboardTab from '../tabs/DashboardTab'
import TradesTab from '../tabs/TradesTab'
import JournalTab from '../tabs/JournalTab'
import WatchlistTab from '../tabs/WatchlistTab'
import AnalyticsTab from '../tabs/AnalyticsTab'
import AITab from '../tabs/AITab'
import PsychologyTab from '../tabs/PsychologyTab'
import HeatmapTab from '../tabs/HeatmapTab'
import CalendarTab from '../tabs/CalendarTab'
import RiskCalculatorTab from '../tabs/RiskCalculatorTab'
import TargetsTab from '../tabs/TargetsTab'
import MarketNewsTab from '../tabs/MarketNewsTab'
import EconomicCalendarTab from '../tabs/EconomicCalendarTab'
import TradingScore from '@/components/TradingScore'
import AIWeeklyReport from '@/components/AIWeeklyReport'
import TradingStreaks from '@/components/TradingStreaks'
import AchievementCenter from '@/components/AchievementCenter'
import { Trade, JournalEntry, WatchlistItem, Analytics } from '../utils/types'

interface TabContentProps {
  activeTab: string
  trades: Trade[]
  analytics: Analytics | null
  journalEntries: JournalEntry[]
  watchlistItems: WatchlistItem[]
  loading: boolean
  aiInsight: string
  aiLoading: boolean
  aiChatMessages: { role: 'user' | 'assistant'; content: string }[]
  aiChatInput: string
  setAddTradeOpen: (open: boolean) => void
  setAddJournalOpen: (open: boolean) => void
  setAddWatchlistOpen: (open: boolean) => void
  setCsvImportOpen: (open: boolean) => void
  setSmartImportOpen: (open: boolean) => void
  setPlanSelectionModalOpen: (open: boolean) => void
  onView: (trade: Trade) => void
  onEdit: (trade: Trade) => void
  onDelete: (trade: Trade) => void
  onJournalView: (entry: JournalEntry) => void
  onJournalEdit: (entry: JournalEntry) => void
  onJournalDelete: (id: string) => void
  onWatchlistDelete: (id: string) => void
  onGetTips: () => void
  onGetMarket: () => void
  onChatChange: (value: string) => void
  onSendChat: () => void
  isPro: boolean
  language: 'id' | 'en'
  user?: any
  profile?: any
  chartAnimated: boolean
  hasMounted: boolean
}

export default function TabContent({
  activeTab,
  trades,
  analytics,
  journalEntries,
  watchlistItems,
  loading,
  aiInsight,
  aiLoading,
  aiChatMessages,
  aiChatInput,
  setAddTradeOpen,
  setAddJournalOpen,
  setAddWatchlistOpen,
  setCsvImportOpen,
  setSmartImportOpen,
  setPlanSelectionModalOpen,
  onView,
  onEdit,
  onDelete,
  onJournalView,
  onJournalEdit,
  onJournalDelete,
  onWatchlistDelete,
  onGetTips,
  onGetMarket,
  onChatChange,
  onSendChat,
  isPro,
  language,
  user,
  profile,
  chartAnimated,
  hasMounted,
}: TabContentProps) {
  return (
    <div className="p-4 lg:p-6 pb-24">
      {activeTab === 'dashboard' && (
        <motion.div
          key="dashboard"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          <DashboardTab
            analytics={analytics}
            trades={trades}
            journalEntries={journalEntries}
            loading={loading}
            setAddTradeOpen={setAddTradeOpen}
            onView={onView}
            onEdit={onEdit}
            onDelete={onDelete}
            chartAnimated={chartAnimated}
            language={language}
            isPro={isPro}
          />
        </motion.div>
      )}

      {activeTab === 'trades' && (
        <motion.div
          key="trades"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          <TradesTab
            trades={trades}
            loading={loading}
            onView={onView}
            onEdit={onEdit}
            onDelete={onDelete}
            onImport={() => setCsvImportOpen(true)}
            onSmartImport={() => setSmartImportOpen(true)}
          />
        </motion.div>
      )}

      {activeTab === 'journal' && (
        <motion.div
          key="journal"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          <JournalTab
            entries={journalEntries}
            loading={loading}
            onAdd={() => setAddJournalOpen(true)}
            onView={onJournalView}
            onEdit={onJournalEdit}
            onDelete={onJournalDelete}
            isPro={isPro}
            onUpgrade={() => setPlanSelectionModalOpen(true)}
          />
        </motion.div>
      )}

      {activeTab === 'watchlist' && (
        <motion.div
          key="watchlist"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          <WatchlistTab
            items={watchlistItems}
            loading={loading}
            onAdd={() => setAddWatchlistOpen(true)}
            onDelete={onWatchlistDelete}
          />
        </motion.div>
      )}

      {activeTab === 'analytics' && (
        <motion.div
          key="analytics"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          <AnalyticsTab analytics={analytics} loading={loading} trades={trades} />
        </motion.div>
      )}

      {activeTab === 'ai' && (
        <motion.div
          key="ai"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          <AITab
            analytics={analytics}
            trades={trades}
            insight={aiInsight}
            loading={aiLoading}
            onGetTips={onGetTips}
            onGetMarket={onGetMarket}
            chatMessages={aiChatMessages}
            chatInput={aiChatInput}
            onChatChange={onChatChange}
            onSendChat={onSendChat}
            isPro={isPro}
            onUpgrade={() => setPlanSelectionModalOpen(true)}
          />
        </motion.div>
      )}

      {activeTab === 'score' && (
        <motion.div
          key="score"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          <TradingScore analytics={analytics} trades={trades} isPro={isPro} onUpgrade={() => setPlanSelectionModalOpen(true)} />
        </motion.div>
      )}

      {activeTab === 'report' && (
        <motion.div
          key="report"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          <AIWeeklyReport analytics={analytics} trades={trades} isPro={isPro} onUpgrade={() => setPlanSelectionModalOpen(true)} />
        </motion.div>
      )}

      {activeTab === 'streaks' && (
        <motion.div
          key="streaks"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          <TradingStreaks trades={trades} isPro={isPro} onUpgrade={() => setPlanSelectionModalOpen(true)} />
        </motion.div>
      )}

      {activeTab === 'psychology' && (
        <motion.div
          key="psychology"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          <PsychologyTab isPro={isPro} onUpgrade={() => setPlanSelectionModalOpen(true)} trades={trades} />
        </motion.div>
      )}

      {activeTab === 'heatmap' && (
        <motion.div
          key="heatmap"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          <HeatmapTab isPro={isPro} onUpgrade={() => setPlanSelectionModalOpen(true)} trades={trades} />
        </motion.div>
      )}

      {activeTab === 'calendar' && (
        <motion.div
          key="calendar"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          <CalendarTab trades={trades} language={language} />
        </motion.div>
      )}

      {activeTab === 'news' && (
        <motion.div
          key="news"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          <MarketNewsTab language={language} />
        </motion.div>
      )}

      {activeTab === 'economic-calendar' && (
        <motion.div
          key="economic-calendar"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          <EconomicCalendarTab language={language} />
        </motion.div>
      )}

      {activeTab === 'risk' && (
        <motion.div
          key="risk"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          <RiskCalculatorTab isPro={isPro} onUpgrade={() => setPlanSelectionModalOpen(true)} language={language} />
        </motion.div>
      )}

      {activeTab === 'targets' && (
        <motion.div
          key="targets"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          <TargetsTab isPro={isPro} onUpgrade={() => setPlanSelectionModalOpen(true)} language={language} analytics={analytics} trades={trades} />
        </motion.div>
      )}

      {activeTab === 'achievements' && (
        <motion.div
          key="achievements"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          {hasMounted && (
            <AchievementCenter userId={user?.id || profile?.id || ''} />
          )}
        </motion.div>
      )}
    </div>
  )
}
