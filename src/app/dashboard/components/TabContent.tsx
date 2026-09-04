'use client'

import dynamic from 'next/dynamic'
import { TabSkeleton } from '@/components/TabSkeleton'
import { Trade, JournalEntry, WatchlistItem, Analytics } from '../utils/types'

// Lazy-loaded tab components — each chunk is only fetched when the tab is first visited
const DashboardTab = dynamic(() => import('../tabs/DashboardTab').then(m => ({ default: m.default })), { loading: () => <TabSkeleton />, ssr: false })
const TradesTab = dynamic(() => import('../tabs/TradesTab').then(m => ({ default: m.default })), { loading: () => <TabSkeleton />, ssr: false })
const JournalTab = dynamic(() => import('../tabs/JournalTab').then(m => ({ default: m.default })), { loading: () => <TabSkeleton />, ssr: false })
const WatchlistTab = dynamic(() => import('../tabs/WatchlistTab').then(m => ({ default: m.default })), { loading: () => <TabSkeleton />, ssr: false })
const AnalyticsTab = dynamic(() => import('../tabs/AnalyticsTab').then(m => ({ default: m.default })), { loading: () => <TabSkeleton />, ssr: false })
const AITab = dynamic(() => import('../tabs/AITab').then(m => ({ default: m.default })), { loading: () => <TabSkeleton />, ssr: false })
const PsychologyTab = dynamic(() => import('../tabs/PsychologyTab').then(m => ({ default: m.default })), { loading: () => <TabSkeleton />, ssr: false })
const HeatmapTab = dynamic(() => import('../tabs/HeatmapTab').then(m => ({ default: m.default })), { loading: () => <TabSkeleton />, ssr: false })
const CalendarTab = dynamic(() => import('../tabs/CalendarTab').then(m => ({ default: m.default })), { loading: () => <TabSkeleton />, ssr: false })
const RiskCalculatorTab = dynamic(() => import('../tabs/RiskCalculatorTab').then(m => ({ default: m.default })), { loading: () => <TabSkeleton />, ssr: false })
const TargetsTab = dynamic(() => import('../tabs/TargetsTab').then(m => ({ default: m.default })), { loading: () => <TabSkeleton />, ssr: false })
const MarketNewsTab = dynamic(() => import('../tabs/MarketNewsTab').then(m => ({ default: m.default })), { loading: () => <TabSkeleton />, ssr: false })
const EconomicCalendarTab = dynamic(() => import('../tabs/EconomicCalendarTab').then(m => ({ default: m.default })), { loading: () => <TabSkeleton />, ssr: false })
const CommunityTab = dynamic(() => import('../tabs/CommunityTab').then(m => ({ default: m.default })), { loading: () => <TabSkeleton />, ssr: false })

// Lazy-loaded feature components
const TradingScore = dynamic(() => import('@/components/TradingScore').then(m => ({ default: m.default })), { loading: () => <TabSkeleton />, ssr: false })
const AIWeeklyReport = dynamic(() => import('@/components/AIWeeklyReport').then(m => ({ default: m.default })), { loading: () => <TabSkeleton />, ssr: false })
const TradingStreaks = dynamic(() => import('@/components/TradingStreaks').then(m => ({ default: m.default })), { loading: () => <TabSkeleton />, ssr: false })
const AchievementCenter = dynamic(() => import('@/components/AchievementCenter').then(m => ({ default: m.default })), { loading: () => <TabSkeleton />, ssr: false })

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
  setAddAccountOpen?: (open: boolean) => void
  setAddJournalOpen: (open: boolean) => void
  setAddWatchlistOpen: (open: boolean) => void
  setPlanSelectionModalOpen: (open: boolean) => void
  onView: (trade: Trade) => void
  onEdit: (trade: Trade) => void
  onDelete: (trade: Trade) => void
  onDuplicate?: (trade: Trade) => void
  onJournalView: (entry: JournalEntry) => void
  onJournalEdit: (entry: JournalEntry) => void
  onJournalDelete: (id: string) => void
  onWatchlistDelete: (id: string) => void
  onGetTips: () => void
  onGetMarket: () => void
  onGetRecommendations: () => void
  onChatChange: (value: string) => void
  onSendChat: () => void
  onAnalyzeTrade?: (tradeId: string) => void
  onAnalyzeChart?: (imageData: string) => void
  isPro: boolean
  language: 'id' | 'en'
  user?: any
  profile?: any
  chartAnimated: boolean
  hasMounted: boolean
  tradingAccounts?: any[]
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
  setAddAccountOpen,
  setAddJournalOpen,
  setAddWatchlistOpen,
  setPlanSelectionModalOpen,
  onView,
  onEdit,
  onDelete,
  onDuplicate,
  onJournalView,
  onJournalEdit,
  onJournalDelete,
  onWatchlistDelete,
  onGetTips,
  onGetMarket,
  onGetRecommendations,
  onChatChange,
  onSendChat,
  onAnalyzeTrade,
  onAnalyzeChart,
  isPro,
  language,
  user,
  profile,
  chartAnimated,
  hasMounted,
  tradingAccounts,
}: TabContentProps) {
  return (
    <div className="w-full px-2 sm:px-4 lg:px-6 pb-24">
          {activeTab === 'dashboard' && (
            <DashboardTab
              analytics={analytics}
              trades={trades}
              journalEntries={journalEntries}
              loading={loading}
              setAddTradeOpen={setAddTradeOpen}
              setAddAccountOpen={setAddAccountOpen}
              onView={onView}
              onEdit={onEdit}
              onDelete={onDelete}
              chartAnimated={chartAnimated}
              language={language}
              isPro={isPro}
              profile={profile}
              tradingAccounts={tradingAccounts}
            />
          )}

          {activeTab === 'trades' && (
            <TradesTab
              trades={trades}
              loading={loading}
              setAddTradeOpen={setAddTradeOpen}
              onView={onView}
              onEdit={onEdit}
              onDelete={onDelete}
              onDuplicate={onDuplicate}
              language={language}
            />
          )}

          {activeTab === 'journal' && (
            <JournalTab
              entries={journalEntries}
              loading={loading}
              onAdd={() => setAddJournalOpen(true)}
              onView={onJournalView}
              onEdit={onJournalEdit}
              onDelete={onJournalDelete}
              isPro={isPro}
              onUpgrade={() => setPlanSelectionModalOpen(true)}
              trades={trades}
              language={language}
            />
          )}

          {activeTab === 'watchlist' && (
            <WatchlistTab
              items={watchlistItems}
              loading={loading}
              onAdd={() => setAddWatchlistOpen(true)}
              onDelete={onWatchlistDelete}
              isPro={isPro}
              onUpgrade={() => setPlanSelectionModalOpen(true)}
            />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsTab language={language} initialAnalytics={analytics} />
          )}

          {activeTab === 'ai' && (
            <AITab
              analytics={analytics}
              trades={trades}
              insight={aiInsight}
              loading={aiLoading}
              onGetTips={onGetTips}
              onGetMarket={onGetMarket}
              onGetRecommendations={onGetRecommendations}
              chatMessages={aiChatMessages}
              chatInput={aiChatInput}
              onChatChange={onChatChange}
              onSendChat={onSendChat}
              onAnalyzeTrade={onAnalyzeTrade}
              onAnalyzeChart={onAnalyzeChart}
              isPro={isPro}
              onUpgrade={() => setPlanSelectionModalOpen(true)}
            />
          )}

          {activeTab === 'score' && (
            <TradingScore analytics={analytics} trades={trades} isPro={isPro} onUpgrade={() => setPlanSelectionModalOpen(true)} />
          )}

          {activeTab === 'report' && (
            <AIWeeklyReport analytics={analytics as any} trades={trades} isPro={isPro} onUpgrade={() => setPlanSelectionModalOpen(true)} />
          )}

          {activeTab === 'streaks' && (
            <TradingStreaks trades={trades} isPro={isPro} onUpgrade={() => setPlanSelectionModalOpen(true)} />
          )}

          {activeTab === 'psychology' && (
            <PsychologyTab isPro={isPro} onUpgrade={() => setPlanSelectionModalOpen(true)} trades={trades} />
          )}

          {activeTab === 'heatmap' && (
            <HeatmapTab isPro={isPro} onUpgrade={() => setPlanSelectionModalOpen(true)} trades={trades} />
          )}

          {activeTab === 'calendar' && (
            <CalendarTab trades={trades} language={language} />
          )}

          {activeTab === 'news' && (
            <MarketNewsTab language={language} isPro={isPro} onUpgrade={() => setPlanSelectionModalOpen(true)} />
          )}

          {activeTab === 'economic-calendar' && (
            <EconomicCalendarTab language={language} isPro={isPro} onUpgrade={() => setPlanSelectionModalOpen(true)} />
          )}

          {activeTab === 'risk' && (
            <RiskCalculatorTab isPro={isPro} onUpgrade={() => setPlanSelectionModalOpen(true)} language={language} />
          )}

          {activeTab === 'targets' && (
            <TargetsTab isPro={isPro} onUpgrade={() => setPlanSelectionModalOpen(true)} language={language} analytics={analytics} trades={trades} />
          )}

          {activeTab === 'achievements' && hasMounted && (
            <AchievementCenter userId={user?.id || profile?.id || ''} />
          )}

          {activeTab === 'community' && (
            <CommunityTab
              trades={trades}
              analytics={analytics}
              language={language}
              isPro={isPro}
              profile={profile}
              onAddTradeOpen={setAddTradeOpen}
            />
          )}
    </div>
  )
}
