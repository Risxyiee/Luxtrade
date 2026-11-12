'use client';

/**
 * PineSignalsTab — fitur PRO "Pine Signals".
 * Tempel Pine Script (v5/v6) -> validasi -> backtest di candle H1 yang sudah
 * close -> sinyal tampil di chart (Lightweight Charts v5) + alert.
 *
 * DISCLAIMER ditampilkan wajib: sinyal bukan nasihat keuangan.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Activity, AlertTriangle, BellRing, CheckCircle2, ChevronRight, FlaskConical,
  Loader2, Play, Plus, RadioTower, Save, Sparkles, Trash2, XCircle, Zap,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PineSignalsChart, { type ChartCandle, type ChartEvent, type ChartPlot } from '@/components/pine/PineSignalsChart';

interface PineScript {
  id: string;
  name: string;
  kind: 'strategy' | 'indicator';
  source: string;
  version: number;
  status: 'ACTIVE' | 'PAUSED' | 'ERROR';
  validation: { ok: boolean; errors: unknown[]; warnings: unknown[]; validatedAt: string } | null;
  config: Record<string, unknown>;
  symbol: string;
  timeframe: string;
  alerts_enabled: boolean;
}

interface ValidationIssue {
  severity: 'error' | 'warning';
  line?: number;
  col?: number;
  message: string;
}

interface PineEventRow {
  id: string;
  script_id: string;
  event: string;
  candle_time: number;
  side: string | null;
  payload: Record<string, unknown>;
  delivered: boolean;
  created_at: string;
}

interface Channel {
  id: string;
  type: 'push' | 'telegram' | 'webhook';
  config: Record<string, unknown>;
  enabled: boolean;
}

const CHAMPION_TEMPLATE = `//@version=5
strategy("Champion XAUUSD H1 v6", overlay=true,
     default_qty_type=strategy.fixed, default_qty_value=7,
     pyramiding=0, calc_on_order_fills=false, process_orders_on_close=false,
     initial_capital=100000)

// (template port Champion v6 — lihat tombol "Muat Champion v6" di bawah)`;

function fmtEvent(e: {
  event: string;
  side?: string | null;
  payload?: Record<string, unknown>;
}): string {
  const p = (e.payload || e) as Record<string, unknown>;
  const px = (v: unknown) => (typeof v === 'number' ? v.toFixed(2) : '-');
  switch (e.event) {
    case 'PLACE_LIMIT':
    case 'REPLACE_LIMIT':
      return `${e.event === 'PLACE_LIMIT' ? 'Pasang' : 'Ganti'} limit ${e.side} @ ${px(p.entry)} · SL ${px(p.sl)} · TP ${px(p.tp)}`;
    case 'CANCEL_PENDING':
      return `Batalkan pending ${e.side} (${p.reason || '-'})`;
    case 'CLOSE_POSITION':
      return `Tutup posisi (${p.reason || '-'})`;
    default:
      return `Sinyal ${e.side || ''} ${(p.reason as string) || ''}`.trim();
  }
}

function fmtTime(ms: number): string {
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

export default function PineSignalsTab({
  isPro,
  onUpgrade,
}: {
  isPro: boolean;
  onUpgrade: () => void;
}) {
  const [scripts, setScripts] = useState<PineScript[]>([]);
  const [tablesMissing, setTablesMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  // editor state
  const [name, setName] = useState('Champion v6');
  const [kind, setKind] = useState<'strategy' | 'indicator'>('strategy');
  const [source, setSource] = useState('');
  const [validating, setValidating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validation, setValidation] = useState<{ ok: boolean; errors: ValidationIssue[]; warnings: ValidationIssue[] } | null>(null);

  // backtest state
  const [btLoading, setBtLoading] = useState(false);
  const [btCandles, setBtCandles] = useState<ChartCandle[]>([]);
  const [btEvents, setBtEvents] = useState<ChartEvent[]>([]);
  const [btPlots, setBtPlots] = useState<ChartPlot[]>([]);
  const [btSummary, setBtSummary] = useState<{ broker?: { positionSize: number; openTrades: number; closedTrades: number }; durationMs?: number; barCount?: number } | null>(null);

  // live & channels
  const [eventsLog, setEventsLog] = useState<PineEventRow[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [tgChatId, setTgChatId] = useState('');
  const [whUrl, setWhUrl] = useState('');
  const [liveRunning, setLiveRunning] = useState(false);

  const selected = useMemo(() => scripts.find((s) => s.id === selectedId) || null, [scripts, selectedId]);

  const loadScripts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/pine/scripts');
      const json = await res.json();
      if (json.tablesMissing) setTablesMissing(true);
      setScripts(json.scripts || []);
    } catch {
      toast.error('Gagal memuat script');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/pine/events?limit=50');
      const json = await res.json();
      if (!json.tablesMissing) setEventsLog(json.events || []);
    } catch { /* diam */ }
  }, []);

  const loadChannels = useCallback(async () => {
    try {
      const res = await fetch('/api/pine/channels');
      const json = await res.json();
      if (!json.tablesMissing) setChannels(json.channels || []);
    } catch { /* diam */ }
  }, []);

  useEffect(() => {
    loadScripts();
    loadEvents();
    loadChannels();
  }, [loadScripts, loadEvents, loadChannels]);

  const openEditor = (s?: PineScript) => {
    if (s) {
      setSelectedId(s.id);
      setName(s.name);
      setKind(s.kind);
      setSource(s.source);
      setValidation(s.validation ? { ok: s.validation.ok, errors: s.validation.errors as ValidationIssue[], warnings: s.validation.warnings as ValidationIssue[] } : null);
    } else {
      setSelectedId(null);
      setName('Script Baru');
      setKind('strategy');
      setSource('');
      setValidation(null);
    }
    setEditorOpen(true);
  };

  const doValidate = async () => {
    if (!source.trim()) {
      toast.error('Source masih kosong');
      return;
    }
    setValidating(true);
    try {
      const res = await fetch('/api/pine/validate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ source }),
      });
      const json = await res.json();
      const v = json.validation as { ok: boolean; errors: ValidationIssue[]; warnings: ValidationIssue[] };
      setValidation(v);
      if (v.ok) toast.success('Validasi OK — script siap disimpan');
      else toast.error(`Validasi gagal: ${v.errors.length} error`);
    } catch {
      toast.error('Validasi gagal dijalankan');
    } finally {
      setValidating(false);
    }
  };

  const doSave = async () => {
    // wajib valid dulu — script gagal validasi TIDAK disimpan
    if (!validation || !validation.ok) {
      await doValidate();
      return;
    }
    setSaving(true);
    try {
      const payload = { name, kind, source, symbol: 'XAUUSD', timeframe: 'H1', config: selected?.config || {} };
      const res = selectedId
        ? await fetch(`/api/pine/scripts/${selectedId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/pine/scripts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (!res.ok) {
        if (json.validation) setValidation(json.validation);
        toast.error(json.error || 'Gagal menyimpan');
        return;
      }
      toast.success(selectedId ? 'Script diperbarui (versi baru)' : 'Script tersimpan');
      setEditorOpen(false);
      await loadScripts();
    } catch {
      toast.error('Gagal menyimpan script');
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async (id: string) => {
    if (!confirm('Hapus script ini beserta riwayat eventnya?')) return;
    const res = await fetch(`/api/pine/scripts/${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Script dihapus');
      if (selectedId === id) setSelectedId(null);
      await loadScripts();
      await loadEvents();
    } else {
      toast.error('Gagal menghapus');
    }
  };

  const doBacktest = async (s: PineScript) => {
    setBtLoading(true);
    setSelectedId(s.id);
    setBtEvents([]);
    setBtCandles([]);
    setBtPlots([]);
    try {
      // candle untuk chart: satu fetch dibagi komponen (Vela feed, detik)
      const candlePromise = fetch('/api/candles?symbol=XAUUSD&interval=1h&limit=3000')
        .then((r) => r.json())
        .then((j) => (j?.data || []) as { time: number; open: number; high: number; low: number; close: number }[])
        .catch(() => []);

      const res = await fetch(`/api/pine/scripts/${s.id}/backtest`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bars: 3000 }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Backtest gagal');
        return;
      }
      const candlesRaw = await candlePromise;
      const secToMs = candlesRaw.map((c) => ({
        time: c.time < 1e12 ? c.time * 1000 : c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));
      setBtCandles(secToMs);
      setBtEvents(json.events || []);
      setBtPlots(
        Object.entries(json.plots || {}).map(([nm, data]) => ({
          name: nm,
          data: (data as { time: number; value: number | null }[]).map((d) => ({
            time: d.time < 1e12 ? d.time * 1000 : d.time,
            value: d.value,
          })),
        }))
      );
      setBtSummary({ broker: json.broker, durationMs: json.durationMs, barCount: json.barCount });
      toast.success(`${(json.events || []).length} event dari ${json.barCount} candle (${json.durationMs} ms)`);
    } catch {
      toast.error('Backtest gagal dijalankan');
    } finally {
      setBtLoading(false);
    }
  };

  const toggleScript = async (s: PineScript, field: 'status' | 'alerts_enabled') => {
    const body: Record<string, unknown> =
      field === 'status' ? { status: s.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' } : { alerts_enabled: !s.alerts_enabled };
    const res = await fetch(`/api/pine/scripts/${s.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      await loadScripts();
    } else {
      toast.error('Gagal mengubah status');
    }
  };

  const runLive = async () => {
    setLiveRunning(true);
    try {
      const res = await fetch('/api/pine/live-run', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Live run gagal');
        return;
      }
      const s = json.summary as { scriptsOk: number; scriptsFailed: number; newEvents: number; delivered: number };
      toast.success(`Live selesai: ${s.scriptsOk} OK, ${s.scriptsFailed} gagal, ${s.newEvents} event baru, ${s.delivered} terkirim`);
      await loadEvents();
    } catch {
      toast.error('Live run gagal');
    } finally {
      setLiveRunning(false);
    }
  };

  const saveChannel = async (type: 'telegram' | 'webhook', config: Record<string, unknown>) => {
    const res = await fetch('/api/pine/channels', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type, config }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || 'Gagal menyimpan kanal');
      return;
    }
    toast.success('Kanal alert tersimpan');
    await loadChannels();
  };

  const removeChannel = async (id: string) => {
    const res = await fetch(`/api/pine/channels?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      await loadChannels();
      toast.success('Kanal dihapus');
    }
  };

  const loadChampion = async () => {
    try {
      const res = await fetch('/api/pine/champion-template');
      if (res.ok) {
        const j = await res.json();
        setSource(j.source || '');
        setKind('strategy');
        setName('Champion XAUUSD H1 v6');
        setValidation(null);
        return;
      }
    } catch { /* fallback di bawah */ }
    setSource(CHAMPION_TEMPLATE);
  };

  // ---------------- GATE PRO ----------------
  if (!isPro) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Card className="border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent">
          <CardContent className="p-8 text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Zap className="w-7 h-7 text-amber-400" />
            </div>
            <h2 className="text-xl font-semibold">Pine Signals — Fitur PRO</h2>
            <p className="text-sm text-slate-400 max-w-lg mx-auto">
              Tempel Pine Script v5/v6 milikmu, jalankan di server pada candle H1 yang sudah close,
              lihat sinyalnya di chart, dan terima alert otomatis (push/Telegram/webhook).
            </p>
            <Button onClick={onUpgrade} className="bg-gradient-to-r from-blue-500 to-cyan-400 text-white">
              <Sparkles className="w-4 h-4 mr-2" /> Upgrade ke PRO
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Disclaimer wajib */}
      <div className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-xs text-amber-200/90">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
        <span>
          <strong>Disclaimer:</strong> Sinyal dihasilkan otomatis dari Pine Script milikmu dan dijalankan pada
          candle yang sudah close. Ini BUKAN nasihat keuangan — keputusan dan risiko trading sepenuhnya milikmu.
        </span>
      </div>

      {tablesMissing && (
        <div className="flex items-start gap-2 rounded-lg border border-sky-500/25 bg-sky-500/5 p-3 text-xs text-sky-200/90">
          <RadioTower className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Tabel database Pine Signals belum dibuat. Jalankan{' '}
            <code className="px-1 rounded bg-black/30">supabase/migrations/20261112_pine_signals.sql</code> di Supabase
            SQL Editor, lalu muat ulang halaman ini.
          </span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        {/* ============ DAFTAR SCRIPT ============ */}
        <div className="space-y-3">
          <Card className="border-white/10 bg-white/[0.02]">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" /> Script Pine
              </CardTitle>
              <Button size="sm" variant="outline" className="h-7" onClick={() => openEditor()}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Baru
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {loading ? (
                <div className="flex items-center justify-center py-8 text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              ) : scripts.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">
                  Belum ada script. Buat baru atau muat template Champion v6.
                </p>
              ) : (
                <ScrollArea className="max-h-[420px] pr-2">
                  <div className="space-y-2">
                    {scripts.map((s) => (
                      <div
                        key={s.id}
                        className={`rounded-lg border p-2.5 cursor-pointer transition-colors ${
                          selectedId === s.id ? 'border-blue-400/40 bg-blue-500/5' : 'border-white/10 hover:border-white/20'
                        }`}
                        onClick={() => setSelectedId(s.id)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium truncate">{s.name}</span>
                          <Badge variant={s.status === 'ACTIVE' ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">
                            {s.status}
                          </Badge>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
                          <span className="uppercase">{s.symbol} · {s.timeframe}</span>
                          <span>·</span>
                          <span>{s.kind}</span>
                          <span>·</span>
                          <span>v{s.version}</span>
                        </div>
                        <div className="mt-2 flex items-center gap-1.5">
                          <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={(e) => { e.stopPropagation(); doBacktest(s); }} disabled={btLoading}>
                            {btLoading && selectedId === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <FlaskConical className="w-3 h-3 mr-1" />}
                            Backtest
                          </Button>
                          <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={(e) => { e.stopPropagation(); openEditor(s); }}>
                            Edit
                          </Button>
                          <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 text-red-400" onClick={(e) => { e.stopPropagation(); doDelete(s.id); }}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                          <div className="ml-auto flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <span className="text-[9px] text-slate-500">alert</span>
                            <Switch checked={s.alerts_enabled} onCheckedChange={() => toggleScript(s, 'alerts_enabled')} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
              <Separator className="bg-white/5" />
              <Button size="sm" variant="ghost" className="w-full h-7 text-[11px] text-slate-400" onClick={loadChampion}>
                <ChevronRight className="w-3 h-3 mr-1" /> Muat template Champion v6
              </Button>
            </CardContent>
          </Card>

          {/* Live control */}
          <Card className="border-white/10 bg-white/[0.02]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BellRing className="w-4 h-4 text-cyan-400" /> Mode Live
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-slate-400">
              <p>Script <span className="text-slate-200">ACTIVE</span> dijalankan otomatis tiap candle H1 close (cron). Hanya event BARU yang dikirim.</p>
              <Button size="sm" className="w-full h-8" onClick={runLive} disabled={liveRunning || tablesMissing}>
                {liveRunning ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Play className="w-3.5 h-3.5 mr-2" />}
                Jalankan Live Sekarang
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* ============ KOLOM UTAMA ============ */}
        <div className="space-y-4 min-w-0">
          <Tabs defaultValue="chart" className="w-full">
            <TabsList className="bg-white/5">
              <TabsTrigger value="chart" className="text-xs">Chart &amp; Backtest</TabsTrigger>
              <TabsTrigger value="events" className="text-xs">Event Terkini</TabsTrigger>
              <TabsTrigger value="channels" className="text-xs">Kanal Alert</TabsTrigger>
            </TabsList>

            {/* -------- CHART -------- */}
            <TabsContent value="chart" className="space-y-3 mt-3">
              <Card className="border-white/10 bg-white/[0.02]">
                <CardContent className="p-3 md:p-4">
                  {btCandles.length > 0 ? (
                    <>
                      <PineSignalsChart
                        candles={btCandles}
                        events={btEvents}
                        plots={btPlots}
                        sourceLabel={`Sumber: TradingView/TwelveData · XAUUSD H1 · waktu UTC · ${btSummary?.barCount ?? 0} candle`}
                        height={480}
                      />
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                        <Badge variant="outline" className="text-[10px]">
                          <Activity className="w-3 h-3 mr-1" /> {btEvents.length} event
                        </Badge>
                        {btSummary?.broker && (
                          <Badge variant="outline" className="text-[10px]">
                            trade closed: {btSummary.broker.closedTrades} · open: {btSummary.broker.openTrades}
                          </Badge>
                        )}
                        {btSummary?.durationMs !== undefined && (
                          <Badge variant="outline" className="text-[10px]">runtime {btSummary.durationMs} ms</Badge>
                        )}
                        <span className="ml-auto">Panah = sinyal · X = cancel · C = close · garis = entry/SL/TP aktif</span>
                      </div>
                    </>
                  ) : (
                    <div className="h-[480px] flex flex-col items-center justify-center text-center text-sm text-slate-400 gap-3">
                      {btLoading ? (
                        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                      ) : (
                        <>
                          <FlaskConical className="w-8 h-8 text-slate-600" />
                          <p>Pilih script lalu klik <span className="text-slate-200">Backtest</span> untuk menjalankannya pada 3000 candle H1 yang sudah close.</p>
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {btEvents.length > 0 && (
                <Card className="border-white/10 bg-white/[0.02]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Event Backtest (terbaru dulu)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="max-h-64">
                      <div className="space-y-1.5">
                        {[...btEvents].reverse().map((ev, i) => (
                          <div key={`${ev.candleTime}-${ev.event}-${i}`} className="flex items-center gap-2 text-xs py-1 border-b border-white/5 last:border-0">
                            <span className="text-slate-500 w-36 shrink-0 font-mono text-[10px]">{fmtTime(ev.candleTime)}</span>
                            <Badge
                              variant="outline"
                              className={`text-[9px] px-1.5 py-0 shrink-0 ${
                                ev.event === 'CANCEL_PENDING'
                                  ? 'text-slate-400'
                                  : ev.side === 'BUY'
                                  ? 'text-emerald-400'
                                  : ev.side === 'SELL'
                                  ? 'text-red-400'
                                  : 'text-amber-400'
                              }`}
                            >
                              {ev.event}
                            </Badge>
                            <span className="text-slate-300 truncate">{fmtEvent(ev)}</span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* -------- EVENT LOG -------- */}
            <TabsContent value="events" className="mt-3">
              <Card className="border-white/10 bg-white/[0.02]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Riwayat Event (database)</CardTitle>
                </CardHeader>
                <CardContent>
                  {eventsLog.length === 0 ? (
                    <p className="text-xs text-slate-400 py-8 text-center">
                      Belum ada event. Event muncul saat mode live/backtest menyimpan sinyal baru.
                    </p>
                  ) : (
                    <ScrollArea className="max-h-96">
                      <div className="space-y-1.5">
                        {eventsLog.map((ev) => (
                          <div key={ev.id} className="flex items-center gap-2 text-xs py-1.5 border-b border-white/5 last:border-0">
                            <span className="text-slate-500 w-36 shrink-0 font-mono text-[10px]">{fmtTime(ev.candle_time)}</span>
                            <Badge
                              variant="outline"
                              className={`text-[9px] px-1.5 py-0 shrink-0 ${
                                ev.event === 'CANCEL_PENDING'
                                  ? 'text-slate-400'
                                  : ev.side === 'BUY'
                                  ? 'text-emerald-400'
                                  : ev.side === 'SELL'
                                  ? 'text-red-400'
                                  : 'text-amber-400'
                              }`}
                            >
                              {ev.event}
                            </Badge>
                            <span className="text-slate-300 truncate">{fmtEvent(ev)}</span>
                            <span className="ml-auto shrink-0">
                              {ev.delivered ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                              ) : (
                                <XCircle className="w-3.5 h-3.5 text-slate-600" />
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* -------- KANAL ALERT -------- */}
            <TabsContent value="channels" className="mt-3 space-y-3">
              <Card className="border-white/10 bg-white/[0.02]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <BellRing className="w-4 h-4 text-cyan-400" /> Kanal Alert
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-xs">
                  <div className="flex items-center justify-between rounded-lg border border-white/10 p-3">
                    <div>
                      <p className="text-slate-200 text-sm">Web Push (browser/HP)</p>
                      <p className="text-slate-500">Aktif otomatis jika izin notifikasi sudah diberikan di dashboard.</p>
                    </div>
                    <Badge variant={channels.some((c) => c.type === 'push') ? 'default' : 'secondary'}>
                      {channels.some((c) => c.type === 'push') ? 'tersimpan' : 'default'}
                    </Badge>
                  </div>

                  <div className="rounded-lg border border-white/10 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-slate-200 text-sm">Telegram</p>
                      {channels.find((c) => c.type === 'telegram') && (
                        <Button size="sm" variant="ghost" className="h-6 text-[10px] text-red-400" onClick={() => removeChannel(channels.find((c) => c.type === 'telegram')!.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="chat_id Telegram (mis. 123456789)"
                        value={tgChatId}
                        onChange={(e) => setTgChatId(e.target.value)}
                        className="h-8 text-xs bg-black/20"
                      />
                      <Button size="sm" className="h-8" onClick={() => tgChatId.trim() && saveChannel('telegram', { chatId: tgChatId.trim() })}>
                        Simpan
                      </Button>
                    </div>
                    <p className="text-[10px] text-slate-500">Event CANCEL_PENDING juga dikirim ke semua kanal.</p>
                  </div>

                  <div className="rounded-lg border border-white/10 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-slate-200 text-sm">Webhook</p>
                      {channels.find((c) => c.type === 'webhook') && (
                        <Button size="sm" variant="ghost" className="h-6 text-[10px] text-red-400" onClick={() => removeChannel(channels.find((c) => c.type === 'webhook')!.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="https://contoh.com/hook (POST JSON)"
                        value={whUrl}
                        onChange={(e) => setWhUrl(e.target.value)}
                        className="h-8 text-xs bg-black/20"
                      />
                      <Button size="sm" className="h-8" onClick={() => /^https?:\/\//.test(whUrl.trim()) && saveChannel('webhook', { url: whUrl.trim() })}>
                        Simpan
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* -------- EDITOR (dialog-like inline) -------- */}
          {editorOpen && (
            <Card className="border-blue-400/20 bg-white/[0.02]">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium">{selectedId ? 'Edit Script' : 'Script Baru'}</CardTitle>
                <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditorOpen(false)}>Tutup</Button>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2 md:grid-cols-[1fr_160px]">
                  <div className="space-y-1">
                    <Label className="text-xs">Nama</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-sm bg-black/20" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tipe</Label>
                    <div className="flex gap-1 h-8 items-center">
                      <Button size="sm" variant={kind === 'strategy' ? 'default' : 'outline'} className="h-8 text-xs" onClick={() => setKind('strategy')}>strategy</Button>
                      <Button size="sm" variant={kind === 'indicator' ? 'default' : 'outline'} className="h-8 text-xs" onClick={() => setKind('indicator')}>indicator</Button>
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Source Pine Script (v5/v6)</Label>
                    <span className="text-[10px] text-slate-500">{source.length} / 50000 byte</span>
                  </div>
                  <Textarea
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    spellCheck={false}
                    className="font-mono text-[11px] leading-4 min-h-[320px] bg-black/30 border-white/10"
                    placeholder="//@version=5&#10;strategy(&quot;...&quot;)&#10;..."
                  />
                </div>

                {/* Panel status validasi */}
                {validation && (
                  <div className={`rounded-lg border p-3 text-xs space-y-1 ${validation.ok ? 'border-emerald-500/25 bg-emerald-500/5' : 'border-red-500/25 bg-red-500/5'}`}>
                    <div className="flex items-center gap-2 font-medium">
                      {validation.ok ? (
                        <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> <span className="text-emerald-300">OK — siap disimpan</span></>
                      ) : (
                        <><XCircle className="w-3.5 h-3.5 text-red-400" /> <span className="text-red-300">Gagal validasi — script tidak bisa disimpan</span></>
                      )}
                    </div>
                    {validation.errors.map((e, i) => (
                      <p key={`e${i}`} className="text-red-300/90 font-mono text-[11px]">
                        {e.line ? `baris ${e.line}${e.col ? `:${e.col}` : ''} — ` : ''}{e.message}
                      </p>
                    ))}
                    {validation.warnings.map((w, i) => (
                      <p key={`w${i}`} className="text-amber-300/80 font-mono text-[11px]">
                        {w.line ? `baris ${w.line} — ` : ''}peringatan: {w.message}
                      </p>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={doValidate} disabled={validating}>
                    {validating ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-2" />}
                    Validasi
                  </Button>
                  <Button size="sm" onClick={doSave} disabled={saving || validating}>
                    {saving ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-2" />}
                    {selectedId ? 'Simpan Perubahan' : 'Simpan Script'}
                  </Button>
                  {!selectedId && (
                    <Button size="sm" variant="ghost" onClick={loadChampion} className="text-slate-400">
                      Muat template Champion v6
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
