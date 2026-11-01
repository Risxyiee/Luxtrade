'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bell, BellOff, Loader2, AlertCircle, Smartphone, Mail, Send, CheckCircle2, AlertTriangle, Monitor, HelpCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/lib/auth-context'
import { usePushSubscription } from '@/hooks/usePushSubscription'
import { useLanguage } from '@/contexts/LanguageContext'
import { isIOSSafari, isStandaloneMode } from '@/components/PWAInstallPrompt'

// ─── i18n strings ──────────────────────────────────────────────────────────────
const strings = {
  id: {
    enableBtn: 'Aktifkan Notifikasi',
    enablingBtn: 'Mengaktifkan...',
    disableBtn: 'Matikan',
    disablingBtn: 'Mematikan...',
    subscribed: 'Aktif — notif masuk ke HP',
    notSubscribed: 'Nonaktif',
    denied: 'Izin ditolak. Buka Settings → Notifications → LuxTradee',
    iosSafariWarning: 'Di iPhone, notifikasi push cuma jalan kalau app di-install ke Home Screen.',
    iosInstallBtn: 'Cara Install',
    emailNote: 'Email alert aktif sebagai fallback di iPhone',
    pushLabel: 'Push Notifications',
    iosBannerTitle: 'Aktifkan Push di iPhone',
    iosBannerDesc: 'Install LuxTradee ke Home Screen biar push notification bisa jalan.',
    iosBannerAction: 'Lihat Cara Install',
    permissionError: 'Gagal meminta izin notifikasi',
    testBtn: 'Kirim Notifikasi Tes',
    testingBtn: 'Mengirim...',
    testOk: 'Terkirim! Cek HP kamu 📲',
    testOkDevice: '📥 Sampai & tampil di perangkatmu!',
    testWrongDevice: '⚠️ PC/laptop menerima, tapi HP TIDAK melapor. Token push HP-mu tidak ada / sudah basi di server. Buka app LuxTradee dari Home Screen (bukan Safari) → matikan lalu nyalakan toggle Push di HP → tes lagi.',
    testPartial: 'Sampai di {ok}/{total} perangkat. Yang TIDAK melapor: {missing}. Buka app-nya dari Home Screen, toggle Push mati-nyala, tes lagi.',
    testNoReport: 'Sampai ke push service ✅ tapi belum ada perangkat yang lapor (±30 dtk). Cek: buka app LuxTradee dari Home Screen (bukan Safari — biar service worker terbaru aktif), Settings → Notifications → LuxTradee → Allow + Banners, matikan Focus. Lalu toggle Push mati-nyala → tes lagi.',
    testSwFail: 'Sampai di HP tapi GAGAL ditampilkan',
    testEmpty: 'Belum kekirim — coba matikan & nyalakan lagi notifikasinya',
    testFail: 'Gagal terkirim — coba lagi',
    testServer: 'Server belum bisa kirim push — bukan salah HP-mu. Coba lagi nanti',
    devicesTitle: 'Perangkat terdaftar',
    devicesEmpty: 'Belum ada perangkat terdaftar di server — toggle Push di device yang mau kamu terima notif-nya.',
    deviceIOS: 'iPhone/iPad',
    deviceChrome: 'Chrome',
    deviceFirefox: 'Firefox',
    deviceOther: 'Perangkat lain',
  },
  en: {
    enableBtn: 'Enable Notifications',
    enablingBtn: 'Enabling...',
    disableBtn: 'Disable',
    disablingBtn: 'Disabling...',
    subscribed: 'Active — notifications on your phone',
    notSubscribed: 'Inactive',
    denied: 'Permission denied. Go to Settings → Notifications → LuxTradee',
    iosSafariWarning: 'On iPhone, push notifications only work when the app is installed to Home Screen.',
    iosInstallBtn: 'How to Install',
    emailNote: 'Email alerts active as fallback on iPhone',
    pushLabel: 'Push Notifications',
    iosBannerTitle: 'Enable Push on iPhone',
    iosBannerDesc: 'Install LuxTradee to Home Screen so push notifications can work.',
    iosBannerAction: 'See How to Install',
    permissionError: 'Failed to request notification permission',
    testBtn: 'Send Test Notification',
    testingBtn: 'Sending...',
    testOk: 'Sent! Check your phone 📲',
    testOkDevice: '📥 Arrived & displayed on your device!',
    testWrongDevice: '⚠️ PC/laptop received it, but your PHONE did NOT report. Your phone\'s push token is missing/stale on the server. Open the LuxTradee app from the Home Screen (not Safari) → toggle Push off & on on your phone → test again.',
    testPartial: 'Arrived on {ok}/{total} devices. Did NOT report: {missing}. Open the app from Home Screen, toggle Push off & on, test again.',
    testNoReport: 'Reached the push service ✅ but no device confirmed (~30s). Check: open LuxTradee from the Home Screen (not Safari — so the latest service worker activates), Settings → Notifications → LuxTradee → Allow + Banners, turn Focus off. Then toggle Push off & on → test again.',
    testSwFail: 'Reached your phone but FAILED to display',
    testEmpty: 'Not delivered — try toggling notifications off & on',
    testFail: 'Send failed — try again',
    testServer: 'Push server can’t send yet — not your phone’s fault. Try later',
    devicesTitle: 'Registered devices',
    devicesEmpty: 'No devices registered on the server — toggle Push on the device that should receive notifications.',
    deviceIOS: 'iPhone/iPad',
    deviceChrome: 'Chrome',
    deviceFirefox: 'Firefox',
    deviceOther: 'Other device',
  },
} as const

type LangKey = keyof typeof strings

interface DeviceInfo {
  ep: string
  platform: string
  ua: string
  updated?: string | null
}

interface NotificationSetupProps {
  /** Render as compact toggle for settings/sidebar */
  compact?: boolean
  /** Called when user wants to see iOS install instructions */
  onShowIOSInstall?: () => void
}

/** Icon + label per platform device */
function DeviceChip({ d, labels }: { d: DeviceInfo; labels: Record<string, string> }) {
  const Icon = d.platform === 'ios' ? Smartphone : d.platform === 'other' ? HelpCircle : Monitor
  const label = labels[d.platform] || labels.other
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/5 text-[10px] text-white/50">
      <Icon className="w-3 h-3" />
      {label}
    </span>
  )
}

/**
 * Smart notification setup component that:
 * - Detects iOS Safari and shows appropriate guidance
 * - Only requests push permission when in PWA/standalone mode (or non-iOS)
 * - Shows email fallback note on iOS
 * - Shows REGISTERED DEVICES (server truth) — diagnostic for "notif gak
 *   muncul di HP padahal toggle hijau" (biasanya token HP tidak/basi di DB)
 * - Test feedback is PER-DEVICE: desktop ✓ / HP ✗ beda cerita dgn HP ✓
 * - Works as compact toggle or full setup card
 */
export default function NotificationSetup({ compact = false, onShowIOSInstall }: NotificationSetupProps) {
  const { language } = useLanguage()
  const lang = (language === 'id' ? 'id' : 'en') as LangKey
  const t = strings[lang]

  const { user, isPro } = useAuth()
  const userId = user?.id || ''
  const { isSupported, permission, isSubscribed, isLoading, error, subscribe, unsubscribe, resync } = usePushSubscription(userId)

  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [showIOSBanner, setShowIOSBanner] = useState(false)
  const [testState, setTestState] = useState<'idle' | 'sending' | 'ok' | 'okDevice' | 'wrongDevice' | 'partial' | 'noReport' | 'swFail' | 'empty' | 'fail' | 'server'>('idle')
  const [swFailReason, setSwFailReason] = useState('')
  // Breakdown tes: perangkat yang dituju vs yang tidak lapor
  const [sentDevices, setSentDevices] = useState<DeviceInfo[]>([])
  const [missingDevices, setMissingDevices] = useState<DeviceInfo[]>([])
  // Daftar perangkat terdaftar (server truth) — ditampilkan di UI
  const [deviceList, setDeviceList] = useState<DeviceInfo[] | null>(null)

  useEffect(() => {
    setIsIOS(isIOSSafari())
    setIsStandalone(isStandaloneMode())
  }, [])

  const platformLabels: Record<string, string> = {
    ios: t.deviceIOS,
    chrome: t.deviceChrome,
    firefox: t.deviceFirefox,
    other: t.deviceOther,
  }

  const refreshDevices = useCallback(async () => {
    try {
      const res = await fetch('/api/push/devices')
      if (!res.ok) return
      const json = await res.json()
      setDeviceList(Array.isArray(json.devices) ? json.devices : [])
    } catch {
      // silent — daftar perangkat bersifat diagnostik
    }
  }, [])

  // Ambil daftar perangkat saat subscribed (server truth)
  useEffect(() => {
    if (isSubscribed) refreshDevices()
    else setDeviceList(null)
  }, [isSubscribed, refreshDevices])

  /**
   * Core logic: When user clicks "Enable Notifications":
   * 1. If on iOS Safari (not standalone) → show iOS install banner
   * 2. If on iOS but in standalone mode → proceed normally (iOS 16.4+ supports push in PWA)
   * 3. If on Android/desktop → proceed normally
   */
  const handleEnable = useCallback(async () => {
    if (!userId) return

    // iOS Safari check — must be in standalone mode for push to work
    if (isIOS && !isStandalone) {
      setShowIOSBanner(true)
      onShowIOSInstall?.()
      return
    }

    // Normal flow: request permission & subscribe
    await subscribe(userId, isPro)
  }, [userId, isIOS, isStandalone, subscribe, isPro, onShowIOSInstall])

  const handleDisable = useCallback(async () => {
    await unsubscribe()
  }, [unsubscribe])

  /** FASE 5A: kirim push TES ke diri sendiri — bukti notif beneran sampai HP.
    * Drift (browser punya sub, server tidak) diperbaiki otomatis via resync
    * lalu kirim ulang. FIX F5: resync juga saat semua perangkat expired.
    *
    * FIX PER-DEVICE: server balas daftar perangkat yang dituju + sw tiap
    * device lapor dengan ep-nya → UI bisa bedakan "desktop ✓ tapi HP ✗"
    * (token HP basi — biang keladi keluhan Bos) dari "HP ✓ semua oke". */
  const handleSendTest = useCallback(async () => {
    setTestState('sending')
    setMissingDevices([])
    try {
      const send = async () => {
        const res = await fetch('/api/push/test', { method: 'POST' })
        if (!res.ok) return null
        return res.json()
      }
      let data = await send()
      if (data === null) {
        setTestState('fail')
        return
      }
      const needsRepair = data.sent === 0 && userId && (
        data.total === 0 || (data.expired ?? 0) > 0
      )
      if (needsRepair) {
        // Drift: browser punya subscription tapi server kosong/mati →
        // siklus ulang otomatis (unsubscribe + subscribe fresh)
        const fixed = await resync(userId, isPro)
        if (!fixed) {
          setTestState('empty')
          return
        }
        data = await send()
        if (data === null) {
          setTestState('fail')
          return
        }
      }
      if (data.sent > 0) {
        setTestState('ok')
        setSentDevices(Array.isArray(data.devices) ? data.devices : [])
        // FASE 5 debug: tunggu laporan penerimaan dari device (sw lapor
        // setelah showNotification sukses). Apple 201 ≠ tampil di HP.
        // 15×2s = 30 dtk — Apple bisa menyajikan push lambat (device idle,
        // Low Power Mode) + SW baru butuh waktu aktif → dulu 11 dtk sering
        // keburu berhenti di "Terkirim!" padahal notif menyusul.
        for (let i = 0; i < 15; i++) {
          await new Promise((r) => setTimeout(r, 2000))
          try {
            const rc = await fetch('/api/push/received?tag=push-test')
            if (rc.ok) {
              const rj = await rc.json()
              if (rj.received) {
                const receipts: Record<string, { ok?: boolean; reason?: string }> = rj.receipts || {}
                const expected: DeviceInfo[] = Array.isArray(data.devices) ? data.devices : []
                // Device "unknown" = SW lama (tanpa ep) — tetap dihitung lapor
                const matched = expected.filter((d) => receipts[d.ep])
                const missing = expected.filter((d) => !receipts[d.ep])
                const failEntry = matched.find((d) => receipts[d.ep]?.ok === false)

                if (failEntry) {
                  // Push SAMPAI di service worker tapi gagal ditampilkan —
                  // masalah di device (iOS Settings/WebView), bukan server
                  setSwFailReason(String(receipts[failEntry.ep]?.reason || '').slice(0, 120))
                  setTestState('swFail')
                  break
                }
                if (missing.length === 0 || (matched.length === 0 && receipts['device'])) {
                  // Semua perangkat lapor — atau SW lama lapor tanpa ep
                  setTestState('okDevice')
                  break
                }
                // Sebagian device diam. THE MONEY DIAGNOSIS:
                // desktop lapor tapi iPhone tidak → token HP basi/tak terdaftar
                setMissingDevices(missing)
                const phoneSilent = missing.some((d) => d.platform === 'ios')
                const nonPhoneReported = matched.some((d) => d.platform !== 'ios')
                setTestState(phoneSilent && nonPhoneReported ? 'wrongDevice' : 'partial')
                refreshDevices()
                break
              }
            }
          } catch {}
        }
        // 30 dtk berlalu tanpa laporan device → server OK, HP belum konfirmasi:
        // subscription basi / iOS Settings / Focus / SW lama. Panduan lengkap
        // di pesan testNoReport — JANGAN biarkan status menggantung di "Terkirim!"
        setTestState((s) => (s === 'ok' ? 'noReport' : s))
        refreshDevices()
      } else if (data.reason === 'send_failed') {
        // Server push-nya yang bermasalah (VAPID/library/runtime) —
        // mati-nyalakan notif gak akan nolong → pesan jujur
        setTestState('server')
      } else {
        setTestState('empty')
      }
    } catch {
      setTestState('fail')
    }
  }, [resync, userId, isPro, refreshDevices])

  // Whether push can actually work on this device
  const pushCanWork = isSupported && (!isIOS || isStandalone)

  // ─── Device list block (dipakai di compact & full) ─────────────────────────
  const deviceListBlock = deviceList !== null && (
    <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/10">
      <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wide mb-1.5">{t.devicesTitle}</p>
      {deviceList.length === 0 ? (
        <p className="text-[10px] text-amber-400/80">{t.devicesEmpty}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {deviceList.map((d) => (
            <DeviceChip key={d.ep} d={d} labels={platformLabels} />
          ))}
        </div>
      )}
    </div>
  )

  // ─── Test feedback block (dipakai di compact & full) ────────────────────────
  const testFeedback = (
    <>
      {testState === 'ok' && (
        <span className="flex items-center gap-1 text-[10px] text-emerald-400"><CheckCircle2 className="w-3 h-3" />{t.testOk}</span>
      )}
      {testState === 'okDevice' && (
        <span className="flex items-center gap-1 text-[10px] text-emerald-400"><Smartphone className="w-3 h-3" />{t.testOkDevice}</span>
      )}
      {testState === 'wrongDevice' && (
        <span className="flex items-start gap-1 text-[10px] text-amber-400 max-w-[240px]"><AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />{t.testWrongDevice}</span>
      )}
      {testState === 'partial' && (
        <span className="flex items-start gap-1 text-[10px] text-amber-400 max-w-[240px]">
          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
          {t.testPartial
            .replace('{ok}', String(sentDevices.length - missingDevices.length))
            .replace('{total}', String(sentDevices.length))
            .replace('{missing}', missingDevices.map((d) => platformLabels[d.platform] || d.platform).join(', '))}
        </span>
      )}
      {testState === 'noReport' && (
        <span className="flex items-start gap-1 text-[10px] text-amber-400 max-w-[240px]"><AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />{t.testNoReport}</span>
      )}
      {testState === 'swFail' && (
        <span className="flex items-start gap-1 text-[10px] text-amber-400 max-w-[220px]"><Smartphone className="w-3 h-3 mt-0.5 shrink-0" />{t.testSwFail}{swFailReason ? ` — ${swFailReason}` : ''}</span>
      )}
      {testState === 'empty' && (
        <span className="flex items-center gap-1 text-[10px] text-amber-400"><AlertTriangle className="w-3 h-3" />{t.testEmpty}</span>
      )}
      {testState === 'fail' && (
        <span className="flex items-center gap-1 text-[10px] text-red-400"><AlertCircle className="w-3 h-3" />{t.testFail}</span>
      )}
      {testState === 'server' && (
        <span className="flex items-center gap-1 text-[10px] text-amber-400"><AlertTriangle className="w-3 h-3" />{t.testServer}</span>
      )}
    </>
  )

  // ─── Compact toggle (for sidebar settings) ──────────────────────────────────
  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-center gap-2.5">
            {isSubscribed ? (
              <Bell className="w-4 h-4 text-emerald-400" />
            ) : (
              <BellOff className="w-4 h-4 text-white/40" />
            )}
            <div>
              <p className="text-sm font-medium text-white">{t.pushLabel}</p>
              <p className="text-xs text-white/40">
                {isSubscribed
                  ? t.subscribed
                  : permission === 'denied'
                    ? t.denied
                    : t.notSubscribed}
              </p>
            </div>
          </div>

          {pushCanWork ? (
            <button
              onClick={() => isSubscribed ? handleDisable() : handleEnable()}
              disabled={isLoading}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isSubscribed ? 'bg-emerald-500' : 'bg-white/20'
              } ${isLoading ? 'opacity-50' : ''}`}
            >
              {isLoading ? (
                <Loader2 className="w-3 h-3 text-white absolute left-1/2 -translate-x-1/2 animate-spin" />
              ) : (
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isSubscribed ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              )}
            </button>
          ) : (
            // iOS Safari — push not available in browser
            <button
              onClick={() => { setShowIOSBanner(true); onShowIOSInstall?.() }}
              className="px-2 py-1 rounded-lg bg-amber-500/15 text-[10px] text-amber-400 hover:bg-amber-500/25 transition-colors"
            >
              <Smartphone className="w-3 h-3 inline mr-1" />
              {t.iosInstallBtn}
            </button>
          )}
        </div>

        {/* iOS email fallback note */}
        {isIOS && !isStandalone && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
            <Mail className="w-3 h-3 text-emerald-400/60" />
            <p className="text-[10px] text-emerald-400/60">{t.emailNote}</p>
          </div>
        )}

        {/* Daftar perangkat terdaftar (server truth) — diagnostik token HP */}
        {deviceListBlock}

        {/* FASE 5A: tes notifikasi (hanya saat sudah berlangganan) */}
        {isSubscribed && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
            <button
              onClick={handleSendTest}
              disabled={testState === 'sending'}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 text-[11px] font-semibold text-emerald-400 hover:bg-emerald-500/25 active:scale-[0.97] transition-all disabled:opacity-50 disabled:pointer-events-none"
            >
              {testState === 'sending' ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Send className="w-3 h-3" />
              )}
              {testState === 'sending' ? t.testingBtn : t.testBtn}
            </button>
            {testFeedback}
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/5">
            <AlertCircle className="w-3 h-3 text-red-400" />
            <p className="text-[10px] text-red-400">{error}</p>
          </div>
        )}
      </div>
    )
  }

  // ─── Full card layout ───────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="bg-white/5 border border-white/10 rounded-2xl p-5"
      >
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
            isSubscribed ? 'bg-emerald-500/20' : 'bg-white/10'
          }`}>
            {isSubscribed ? (
              <Bell className="w-5 h-5 text-emerald-400" />
            ) : (
              <BellOff className="w-5 h-5 text-white/60" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-white mb-1">{t.pushLabel}</h3>

            {/* iOS Safari warning */}
            {isIOS && !isStandalone && (
              <div className="mb-3 p-2.5 rounded-lg bg-amber-500/8 border border-amber-500/15">
                <div className="flex items-center gap-1.5 mb-1">
                  <Smartphone className="w-3.5 h-3.5 text-amber-400" />
                  <p className="text-xs font-medium text-amber-400">{t.iosBannerTitle}</p>
                </div>
                <p className="text-[11px] text-white/50 leading-relaxed mb-2">{t.iosBannerDesc}</p>
                <button
                  onClick={() => { setShowIOSBanner(true); onShowIOSInstall?.() }}
                  className="text-[11px] font-medium text-amber-400 hover:text-amber-300 transition-colors"
                >
                  {t.iosBannerAction} →
                </button>
              </div>
            )}

            {/* Status text */}
            <p className="text-xs text-white/40 leading-relaxed mb-3">
              {isSubscribed
                ? t.subscribed
                : permission === 'denied'
                  ? t.denied
                  : isIOS && !isStandalone
                    ? t.iosSafariWarning
                    : 'Aktifkan biar notif trade, price alert, & news langsung masuk ke HP kamu.'
              }
            </p>

            {/* Error display */}
            {error && (
              <div className="flex items-center gap-1.5 mb-2 text-xs text-red-400">
                <AlertCircle className="w-3 h-3" />
                {error}
              </div>
            )}

            {/* Email fallback note on iOS */}
            {isIOS && !isStandalone && (
              <div className="flex items-center gap-1.5 mb-3 text-xs text-emerald-400/60">
                <Mail className="w-3 h-3" />
                {t.emailNote}
              </div>
            )}

            {/* Daftar perangkat terdaftar (server truth) */}
            <div className="mb-3">{deviceListBlock}</div>

            {/* Action buttons */}
            {!isSubscribed && pushCanWork && permission !== 'denied' && (
              <button
                onClick={handleEnable}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-sm font-bold text-white hover:bg-emerald-400 active:scale-[0.97] transition-all disabled:opacity-50 disabled:pointer-events-none"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Bell className="w-4 h-4" />
                )}
                {isLoading ? t.enablingBtn : t.enableBtn}
              </button>
            )}

            {isSubscribed && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleDisable}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 text-xs text-white/50 hover:text-white/80 hover:bg-white/10 transition-all disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <BellOff className="w-3 h-3" />
                  )}
                  {isLoading ? t.disablingBtn : t.disableBtn}
                </button>
                <button
                  onClick={handleSendTest}
                  disabled={testState === 'sending'}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/25 active:scale-[0.97] transition-all disabled:opacity-50 disabled:pointer-events-none"
                >
                  {testState === 'sending' ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Send className="w-3 h-3" />
                  )}
                  {testState === 'sending' ? t.testingBtn : t.testBtn}
                </button>
              </div>
            )}

            {/* FASE 5A: feedback tes notifikasi */}
            {isSubscribed && (
              <div className="mt-2">
                {testState === 'ok' && (
                  <p className="flex items-center gap-1.5 text-xs text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" />{t.testOk}</p>
                )}
                {testState === 'okDevice' && (
                  <p className="flex items-center gap-1.5 text-xs text-emerald-400"><Smartphone className="w-3.5 h-3.5" />{t.testOkDevice}</p>
                )}
                {testState === 'wrongDevice' && (
                  <p className="flex items-start gap-1.5 text-xs text-amber-400"><AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{t.testWrongDevice}</p>
                )}
                {testState === 'partial' && (
                  <p className="flex items-start gap-1.5 text-xs text-amber-400">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    {t.testPartial
                      .replace('{ok}', String(sentDevices.length - missingDevices.length))
                      .replace('{total}', String(sentDevices.length))
                      .replace('{missing}', missingDevices.map((d) => platformLabels[d.platform] || d.platform).join(', '))}
                  </p>
                )}
                {testState === 'noReport' && (
                  <p className="flex items-start gap-1.5 text-xs text-amber-400"><AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{t.testNoReport}</p>
                )}
                {testState === 'swFail' && (
                  <p className="flex items-start gap-1.5 text-xs text-amber-400"><Smartphone className="w-3.5 h-3.5 mt-0.5 shrink-0" />{t.testSwFail}{swFailReason ? ` — ${swFailReason}` : ''}</p>
                )}
                {testState === 'empty' && (
                  <p className="flex items-center gap-1.5 text-xs text-amber-400"><AlertTriangle className="w-3.5 h-3.5" />{t.testEmpty}</p>
                )}
                {testState === 'fail' && (
                  <p className="flex items-center gap-1.5 text-xs text-red-400"><AlertCircle className="w-3.5 h-3.5" />{t.testFail}</p>
                )}
                {testState === 'server' && (
                  <p className="flex items-center gap-1.5 text-xs text-amber-400"><AlertTriangle className="w-3.5 h-3.5" />{t.testServer}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
