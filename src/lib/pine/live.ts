/**
 * live.ts — siklus LIVE Pine Signals.
 *
 * Setiap candle H1 yang SUDAH close:
 *  1. Ambil SEMUA script ACTIVE+alerts_enabled (atau subset user/ids)
 *  2. Group per (symbol, timeframe) -> SATU fetch candle per group
 *     (dibagi ke semua user, bukan per user) + buang bar berjalan
 *  3. Jalankan pine-runner per script (window 1200 bar terakhir)
 *  4. Bandingkan dengan pine_events (kunci idempotensi) -> hanya event BARU
 *  5. Kirim alert (push/telegram/webhook) -> tandai delivered
 *
 * Re-run penuh per candle dipilih daripada incremental PineTS: deterministik,
 * bebas drift state, dan cukup cepat (1200 bar ~ <1.5 dtk per script — Uji A).
 */
import { runPine } from './pine-runner';
import { normalizeRunResult } from './normalize';
import { getClosedCandles, lastClosedCandleTime } from './candles';
import {
  insertEventsIfNew,
  listActiveScripts,
  listChannels,
  logRun,
  markEventsDelivered,
  PineScriptRow,
} from './store';
import { deliverEvent, DeliveryResult } from './alerts';
import { pineEventId, PineEvent } from './types';

export const LIVE_WINDOW_BARS = 1200;

export interface LiveCycleSummary {
  lastCandleTime: number;
  scriptsRun: number;
  scriptsOk: number;
  scriptsFailed: number;
  newEvents: number;
  delivered: number;
  details: {
    scriptId: string;
    scriptName: string;
    status: 'ok' | 'error' | 'timeout';
    newEvents: number;
    error?: string;
  }[];
  skippedNoData?: boolean;
}

function eventToRow(ev: PineEvent, script: PineScriptRow) {
  return {
    id: ev.id,
    script_id: script.id,
    user_id: script.user_id,
    event: ev.event,
    candle_time: ev.candleTime,
    side: ev.side ?? null,
    payload: { ...ev, scriptName: script.name } as Record<string, unknown>,
  };
}

/**
 * Jalankan siklus live. Aman dipanggil berulang / dari cron / manual.
 * onlyUserId: batasi ke satu user (mode manual per user).
 */
export async function runLiveCycle(opts: {
  trigger?: 'live' | 'manual';
  onlyUserId?: string;
  scriptIds?: string[];
  /** batasi jumlah script per siklus (proteksi CPU) */
  maxScripts?: number;
  now?: number;
} = {}): Promise<LiveCycleSummary> {
  const now = opts.now ?? Date.now();
  const trigger = opts.trigger ?? 'live';
  const summary: LiveCycleSummary = {
    lastCandleTime: lastClosedCandleTime(now),
    scriptsRun: 0,
    scriptsOk: 0,
    scriptsFailed: 0,
    newEvents: 0,
    delivered: 0,
    details: [],
  };

  let scripts: PineScriptRow[] = [];
  try {
    scripts = await listActiveScripts(opts.maxScripts ?? 60);
  } catch (e) {
    // tabel belum dibuat Bos -> kembalikan ringkasan kosong yang jujur
    summary.details.push({
      scriptId: '-',
      scriptName: '-',
      status: 'error',
      newEvents: 0,
      error: (e as Error).message,
    });
    summary.scriptsFailed = 1;
    return summary;
  }
  if (opts.onlyUserId) scripts = scripts.filter((s) => s.user_id === opts.onlyUserId);
  if (opts.scriptIds?.length) {
    const allow = new Set(opts.scriptIds);
    scripts = scripts.filter((s) => allow.has(s.id));
  }
  if (scripts.length === 0) return summary;

  // group per (symbol, timeframe) -> 1 fetch per group
  const groups = new Map<string, PineScriptRow[]>();
  for (const s of scripts) {
    const key = `${s.symbol}:${s.timeframe}`;
    const arr = groups.get(key) || [];
    arr.push(s);
    groups.set(key, arr);
  }

  const channelCache = new Map<string, Awaited<ReturnType<typeof listChannels>>>();

  for (const [key, groupScripts] of groups) {
    const [symbol, timeframe] = key.split(':');
    let candles;
    try {
      candles = await getClosedCandles(symbol, timeframe, LIVE_WINDOW_BARS, now);
    } catch (e) {
      for (const s of groupScripts) {
        summary.scriptsRun += 1;
        summary.scriptsFailed += 1;
        summary.details.push({ scriptId: s.id, scriptName: s.name, status: 'error', newEvents: 0, error: `Candle gagal: ${(e as Error).message}` });
      }
      continue;
    }
    if (candles.length < 500) {
      // warm-up minimum belum terpenuhi -> jangan jalankan engine
      for (const s of groupScripts) {
        summary.scriptsRun += 1;
        summary.scriptsFailed += 1;
        summary.details.push({ scriptId: s.id, scriptName: s.name, status: 'error', newEvents: 0, error: `Candle kurang dari 500 bar (${candles.length})` });
      }
      continue;
    }

    for (const script of groupScripts) {
      summary.scriptsRun += 1;
      const t0 = Date.now();
      try {
        const { result, events } = await runPine({
          source: script.source,
          candles,
          inputs: script.config || {},
          scriptId: script.id,
          scriptName: script.name,
          symbol: script.symbol,
          timeframe: script.timeframe,
        });

        if (!result.ok) {
          summary.scriptsFailed += 1;
          const status = result.error.name === 'TimeoutError' ? 'timeout' : 'error';
          summary.details.push({
            scriptId: script.id,
            scriptName: script.name,
            status,
            newEvents: 0,
            error: `${result.error.name}: ${result.error.message}`,
          });
          await logRun({
            script_id: script.id,
            user_id: script.user_id,
            trigger,
            status,
            bars: candles.length,
            duration_ms: result.durationMs,
            new_events: 0,
            error: `${result.error.name}: ${result.error.message}`,
          });
          continue;
        }

        summary.scriptsOk += 1;

        // hanya event dari candle yang sudah close (window terakhir):
        // efisiensi + tetap idempoten lewat kunci pine_events
        const fresh = events.filter(
          (ev) => ev.candleTime <= summary.lastCandleTime && ev.candleTime > summary.lastCandleTime - 3_600_000
        );

        const rows = fresh.map((ev) => eventToRow(ev, script));
        const inserted = await insertEventsIfNew(rows);
        summary.newEvents += inserted.length;
        summary.details.push({
          scriptId: script.id,
          scriptName: script.name,
          status: 'ok',
          newEvents: inserted.length,
        });
        await logRun({
          script_id: script.id,
          user_id: script.user_id,
          trigger,
          status: 'ok',
          bars: candles.length,
          duration_ms: result.durationMs,
          new_events: inserted.length,
        });

        // kirim alert untuk event baru
        if (inserted.length > 0) {
          if (!channelCache.has(script.user_id)) {
            try {
              channelCache.set(script.user_id, await listChannels(script.user_id));
            } catch {
              channelCache.set(script.user_id, []);
            }
          }
          const channels = channelCache.get(script.user_id) || [];
          if (channels.some((c) => c.enabled)) {
            const results: DeliveryResult[] = [];
            for (const row of inserted) {
              const ev = row.payload as unknown as PineEvent;
              results.push(...(await deliverEvent(ev, script.name, script.user_id, channels)));
            }
            const allOk = results.length > 0 && results.every((r) => r.ok);
            await markEventsDelivered(
              inserted.map((r) => r.id),
              results
            );
            if (allOk) summary.delivered += inserted.length;
          } else {
            // tidak ada kanal aktif -> tandai terkirim agar tidak menumpuk,
            // event tetap tampil di dashboard
            await markEventsDelivered(inserted.map((r) => r.id), []);
          }
        }
      } catch (e) {
        summary.scriptsFailed += 1;
        summary.details.push({
          scriptId: script.id,
          scriptName: script.name,
          status: 'error',
          newEvents: 0,
          error: (e as Error).message,
        });
        await logRun({
          script_id: script.id,
          user_id: script.user_id,
          trigger,
          status: 'error',
          bars: candles.length,
          duration_ms: Date.now() - t0,
          new_events: 0,
          error: (e as Error).message,
        });
      }
    }
  }

  return summary;
}

/** Backtest manual: jalankan script pada window candle dan kembalikan event + plot. */
export async function runBacktest(script: PineScriptRow, bars = 3000, now: number = Date.now()) {
  const candles = await getClosedCandles(script.symbol, script.timeframe, Math.min(bars, 3000), now);
  if (candles.length < 500) {
    throw new Error(`Candle hanya ${candles.length} bar — minimal 500 untuk warm-up`);
  }
  const { result, events, droppedDup, droppedOrder, barCount } = await runPine({
    source: script.source,
    candles,
    inputs: script.config || {},
    scriptId: script.id,
    scriptName: script.name,
    symbol: script.symbol,
    timeframe: script.timeframe,
  });
  return { result, events, droppedDup, droppedOrder, barCount, candles };
}

/** Validasi + normalisasi untuk preview (dipakai route validate). */
export function normalizeForScript(
  raw: Extract<ReturnType<typeof Object>, unknown>,
  ctx: { scriptId: string; scriptName?: string; symbol: string; timeframe: string; kind: 'strategy' | 'indicator' | 'unknown' }
) {
  return normalizeRunResult(raw as never, ctx);
}
