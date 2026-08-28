'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Save, Bell, Mail, AlertTriangle, TrendingUp, Flame, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'

interface NotificationPreferences {
  emailDigest: 'daily' | 'weekly' | 'off'
  tradeAlerts: {
    bigWin: boolean
    bigLoss: boolean
    streak: boolean
    dailyLimit: boolean
  }
  thresholds: {
    bigWinAmount: number
    bigLossAmount: number
    maxDailyLosses: number
  }
  inApp: boolean
}

interface NotificationPreferencesProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  language: 'id' | 'en'
}

const DEFAULT_PREFS: NotificationPreferences = {
  emailDigest: 'daily',
  tradeAlerts: {
    bigWin: true,
    bigLoss: true,
    streak: true,
    dailyLimit: true,
  },
  thresholds: {
    bigWinAmount: 100,
    bigLossAmount: -100,
    maxDailyLosses: 5,
  },
  inApp: true,
}

const t = (key: string, lang: 'id' | 'en') => {
  const strings: Record<string, { id: string; en: string }> = {
    title: { id: 'Pengaturan Notifikasi', en: 'Notification Preferences' },
    desc: { id: 'Atur bagaimana kamu ingin menerima notifikasi trading', en: 'Configure how you want to receive trading notifications' },
    emailDigest: { id: 'Ringkasan Email', en: 'Email Digest' },
    emailDaily: { id: 'Harian', en: 'Daily' },
    emailWeekly: { id: 'Mingguan', en: 'Weekly' },
    emailOff: { id: 'Mati', en: 'Off' },
    tradeAlerts: { id: 'Peringatan Trade', en: 'Trade Alerts' },
    bigWin: { id: 'Big Win (P/L > threshold)', en: 'Big Win (P/L > threshold)' },
    bigLoss: { id: 'Big Loss (P/L < -threshold)', en: 'Big Loss (P/L < -threshold)' },
    streak: { id: 'Streak Menang/Kalah', en: 'Win/Loss Streak' },
    dailyLimit: { id: 'Batas Rugi Harian', en: 'Daily Loss Limit' },
    thresholds: { id: 'Batas Ambang (Threshold)', en: 'Thresholds' },
    bigWinAmount: { id: 'Big Win ($)', en: 'Big Win ($)' },
    bigLossAmount: { id: 'Big Loss ($)', en: 'Big Loss ($)' },
    maxDailyLosses: { id: 'Max Rugi/Hari', en: 'Max Daily Losses' },
    inApp: { id: 'Notifikasi In-App', en: 'In-App Notifications' },
    inAppDesc: { id: 'Tampilkan notifikasi di header', en: 'Show notifications in the header bell icon' },
    save: { id: 'Simpan', en: 'Save' },
    saving: { id: 'Menyimpan...', en: 'Saving...' },
    saved: { id: 'Preferensi tersimpan!', en: 'Preferences saved!' },
    error: { id: 'Gagal menyimpan preferensi', en: 'Failed to save preferences' },
    alertSettings: { id: 'Pengaturan Peringatan', en: 'Alert Settings' },
    thresholdSettings: { id: 'Nilai Ambang Batas', en: 'Threshold Values' },
    generalSettings: { id: 'Umum', en: 'General' },
  }
  return strings[key]?.[lang] || key
}

export default function NotificationPreferences({ open, onOpenChange, language }: NotificationPreferencesProps) {
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_PREFS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchPrefs = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications/preferences', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        if (data.preferences) {
          setPrefs({
            ...DEFAULT_PREFS,
            ...data.preferences,
            tradeAlerts: { ...DEFAULT_PREFS.tradeAlerts, ...data.preferences.tradeAlerts },
            thresholds: { ...DEFAULT_PREFS.thresholds, ...data.preferences.thresholds },
          })
        }
      }
    } catch {
      // Use defaults
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) fetchPrefs()
  }, [open, fetchPrefs])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(prefs),
      })
      if (res.ok) {
        toast.success(t('saved', language))
      } else {
        toast.error(t('error', language))
      }
    } catch {
      toast.error(t('error', language))
    } finally {
      setSaving(false)
    }
  }

  const updateTradeAlert = (key: keyof NotificationPreferences['tradeAlerts'], value: boolean) => {
    setPrefs(prev => ({
      ...prev,
      tradeAlerts: { ...prev.tradeAlerts, [key]: value },
    }))
  }

  const updateThreshold = (key: keyof NotificationPreferences['thresholds'], value: number) => {
    setPrefs(prev => ({
      ...prev,
      thresholds: { ...prev.thresholds, [key]: value },
    }))
  }

  const digestOptions: { value: 'daily' | 'weekly' | 'off'; label: string }[] = [
    { value: 'daily', label: t('emailDaily', language) },
    { value: 'weekly', label: t('emailWeekly', language) },
    { value: 'off', label: t('emailOff', language) },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-[#0a0c14] border-blue-900/30 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Bell className="w-5 h-5 text-blue-400" />
            {t('title', language)}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {t('desc', language)}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
          </div>
        ) : (
          <div className="space-y-5 max-h-[65vh] overflow-y-auto pr-1">
            {/* General */}
            <section className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">{t('generalSettings', language)}</h4>

              {/* In-App Toggle */}
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2.5">
                  <Bell className="w-4 h-4 text-blue-400/70" />
                  <div>
                    <p className="text-sm text-gray-200">{t('inApp', language)}</p>
                    <p className="text-xs text-gray-500">{t('inAppDesc', language)}</p>
                  </div>
                </div>
                <Switch
                  checked={prefs.inApp}
                  onCheckedChange={(checked) => setPrefs(prev => ({ ...prev, inApp: checked }))}
                  className="data-[state=checked]:bg-blue-500"
                />
              </div>

              {/* Email Digest */}
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-blue-400/70" />
                  <p className="text-sm text-gray-200">{t('emailDigest', language)}</p>
                </div>
                <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5">
                  {digestOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setPrefs(prev => ({ ...prev, emailDigest: opt.value }))}
                      className={`px-2.5 py-1 text-xs rounded-md transition-all duration-150 ${
                        prefs.emailDigest === opt.value
                          ? 'bg-blue-500 text-white shadow-sm'
                          : 'text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* Divider */}
            <div className="border-t border-white/5" />

            {/* Trade Alerts */}
            <section className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">{t('alertSettings', language)}</h4>

              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2.5">
                  <TrendingUp className="w-4 h-4 text-emerald-400/70" />
                  <p className="text-sm text-gray-200">{t('bigWin', language)}</p>
                </div>
                <Switch
                  checked={prefs.tradeAlerts.bigWin}
                  onCheckedChange={(checked) => updateTradeAlert('bigWin', checked)}
                  className="data-[state=checked]:bg-blue-500"
                />
              </div>

              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-red-400/70" />
                  <p className="text-sm text-gray-200">{t('bigLoss', language)}</p>
                </div>
                <Switch
                  checked={prefs.tradeAlerts.bigLoss}
                  onCheckedChange={(checked) => updateTradeAlert('bigLoss', checked)}
                  className="data-[state=checked]:bg-blue-500"
                />
              </div>

              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2.5">
                  <Flame className="w-4 h-4 text-amber-400/70" />
                  <p className="text-sm text-gray-200">{t('streak', language)}</p>
                </div>
                <Switch
                  checked={prefs.tradeAlerts.streak}
                  onCheckedChange={(checked) => updateTradeAlert('streak', checked)}
                  className="data-[state=checked]:bg-blue-500"
                />
              </div>

              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2.5">
                  <ShieldAlert className="w-4 h-4 text-orange-400/70" />
                  <p className="text-sm text-gray-200">{t('dailyLimit', language)}</p>
                </div>
                <Switch
                  checked={prefs.tradeAlerts.dailyLimit}
                  onCheckedChange={(checked) => updateTradeAlert('dailyLimit', checked)}
                  className="data-[state=checked]:bg-blue-500"
                />
              </div>
            </section>

            {/* Divider */}
            <div className="border-t border-white/5" />

            {/* Thresholds */}
            <section className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">{t('thresholdSettings', language)}</h4>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm text-gray-300 whitespace-nowrap">{t('bigWinAmount', language)}</label>
                  <Input
                    type="number"
                    value={prefs.thresholds.bigWinAmount}
                    onChange={(e) => updateThreshold('bigWinAmount', parseFloat(e.target.value) || 0)}
                    className="w-24 h-8 text-sm bg-white/5 border-white/10 text-white text-right"
                    min={1}
                  />
                </div>

                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm text-gray-300 whitespace-nowrap">{t('bigLossAmount', language)}</label>
                  <Input
                    type="number"
                    value={prefs.thresholds.bigLossAmount}
                    onChange={(e) => updateThreshold('bigLossAmount', parseFloat(e.target.value) || 0)}
                    className="w-24 h-8 text-sm bg-white/5 border-white/10 text-white text-right"
                    max={-1}
                  />
                </div>

                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm text-gray-300 whitespace-nowrap">{t('maxDailyLosses', language)}</label>
                  <Input
                    type="number"
                    value={prefs.thresholds.maxDailyLosses}
                    onChange={(e) => updateThreshold('maxDailyLosses', parseInt(e.target.value) || 1)}
                    className="w-24 h-8 text-sm bg-white/5 border-white/10 text-white text-right"
                    min={1}
                    max={20}
                  />
                </div>
              </div>
            </section>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-2">
          <Button
            onClick={handleSave}
            disabled={saving || loading}
            className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-lg shadow-blue-500/25"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            {saving ? t('saving', language) : t('save', language)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
