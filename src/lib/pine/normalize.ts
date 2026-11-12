/**
 * normalize.ts — konversi hasil mentah PineTS menjadi event standar
 * (format sama dengan champion-signal.js).
 *
 * Saluran event:
 *  1. alert() berisi JSON valid dengan field `event` standar -> dipetakan 1:1
 *     (inilah saluran parity untuk port Champion v6).
 *  2. alert() teks biasa -> SIGNAL (side ditebak dari kata kunci).
 *  3. alertcondition() (script indicator) -> SIGNAL.
 *  4. Script strategy TANPA satu pun event JSON -> disintesis dari ledger
 *     order broker PineTS (fill entry/exit, order pending tersisa).
 *
 * Idempotensi: id = `${scriptId}:${candleTime}:${side}:${event}`.
 * Untuk beberapa event SIGNAL di bar yang sama, sufiks `#<urutan>` ditambahkan
 * secara deterministik (stabil antar re-run karena urutan alert deterministik).
 */
import {
  PineEvent,
  PineEventType,
  PineRawRunResult,
  pineEventId,
  PINE_EVENT_TYPES,
} from './types';

export interface NormalizeCtx {
  scriptId: string;
  scriptName?: string;
  symbol: string;
  timeframe: string;
  kind: 'strategy' | 'indicator' | 'unknown';
}

function inferSide(text: string): 'BUY' | 'SELL' | null {
  const t = text.toLowerCase();
  if (/\b(buy|long|bull)\b|buy|long|bull/.test(t) && !/sell|short|bear/.test(t)) return 'BUY';
  if (/sell|short|bear/.test(t) && !/\b(buy|long|bull)\b/.test(t)) return 'SELL';
  if (/buy|long|bull/.test(t)) return 'BUY';
  if (/sell|short|bear/.test(t)) return 'SELL';
  return null;
}

function iso(ms: number | null | undefined): string | undefined {
  if (!Number.isFinite(ms as number)) return undefined;
  return new Date(ms as number).toISOString();
}

function round2(x: unknown): number | undefined {
  if (typeof x !== 'number' || !Number.isFinite(x)) return undefined;
  return Number(x.toFixed(2));
}

export function normalizeRunResult(raw: PineRawRunResult, ctx: NormalizeCtx): PineEvent[] {
  const events: PineEvent[] = [];
  const counters = new Map<string, number>();

  const push = (ev: Omit<PineEvent, 'id'> & { idSuffix?: string }) => {
    const sideKey = ev.side ?? 'NONE';
    let id = pineEventId(ctx.scriptId, ev.candleTime, sideKey, ev.event);
    if (ev.idSuffix) id += `#${ev.idSuffix}`;
    events.push({ ...ev, id } as PineEvent);
  };

  let sawJsonEvent = false;

  for (const a of raw.alerts || []) {
    const candleTime = Number.isFinite(a.time) ? a.time : 0;
    if (a.type === 'alert') {
      const msg = (a.message || '').trim();
      let parsed: Record<string, unknown> | null = null;
      if (msg.startsWith('{')) {
        try {
          const o = JSON.parse(msg);
          if (o && typeof o === 'object' && !Array.isArray(o)) parsed = o;
        } catch {
          parsed = null;
        }
      }
      if (parsed && typeof parsed.event === 'string' && PINE_EVENT_TYPES.includes(parsed.event as PineEventType)) {
        sawJsonEvent = true;
        const side = (parsed.side as 'BUY' | 'SELL' | undefined) ?? undefined;
        const engineId = typeof parsed.id === 'string' ? parsed.id : undefined;
        const meta = (parsed.meta && typeof parsed.meta === 'object' ? parsed.meta : {}) as Record<string, unknown>;
        if (engineId) meta.engineId = engineId;
        push({
          event: parsed.event as PineEventType,
          strategy: (parsed.strategy as string) || ctx.scriptName || ctx.scriptId,
          symbol: (parsed.symbol as string) || ctx.symbol,
          timeframe: (parsed.timeframe as string) || ctx.timeframe,
          candleTime: Number.isFinite(parsed.candleTime as number) ? (parsed.candleTime as number) : candleTime,
          side,
          orderType: (parsed.orderType as 'LIMIT' | 'MARKET') || undefined,
          entry: round2(parsed.entry),
          sl: round2(parsed.sl),
          tp: round2(parsed.tp),
          qtyOz: typeof parsed.qtyOz === 'number' ? parsed.qtyOz : undefined,
          lot: typeof parsed.lot === 'number' ? parsed.lot : undefined,
          reason: typeof parsed.reason === 'string' ? parsed.reason : undefined,
          orderRef: typeof parsed.orderRef === 'string' ? parsed.orderRef : undefined,
          maxBarsToFill: typeof parsed.maxBarsToFill === 'number' ? parsed.maxBarsToFill : undefined,
          meta,
          source: 'alert-json',
        });
        continue;
      }
      // alert teks biasa -> SIGNAL
      const side = inferSide(msg);
      const key = `${candleTime}:SIGNAL:${side}`;
      const n = counters.get(key) || 0;
      counters.set(key, n + 1);
      push({
        event: 'SIGNAL',
        strategy: ctx.scriptName || ctx.scriptId,
        symbol: ctx.symbol,
        timeframe: ctx.timeframe,
        candleTime,
        side,
        reason: msg.slice(0, 500) || undefined,
        meta: { alertId: a.id },
        source: 'alert-text',
        idSuffix: String(n),
      });
      continue;
    }
    if (a.type === 'alertcondition') {
      const title = a.title || '';
      const side = inferSide(`${title} ${a.message || ''}`);
      const key = `${candleTime}:SIGNAL:${side}`;
      const n = counters.get(key) || 0;
      counters.set(key, n + 1);
      push({
        event: 'SIGNAL',
        strategy: ctx.scriptName || ctx.scriptId,
        symbol: ctx.symbol,
        timeframe: ctx.timeframe,
        candleTime,
        side,
        reason: (a.message || title).slice(0, 500) || undefined,
        meta: { alertcondition: title || undefined },
        source: 'alertcondition',
        idSuffix: String(n),
      });
    }
  }

  // Fallback: strategy tanpa event JSON -> sintesis dari ledger broker
  if (!sawJsonEvent && ctx.kind === 'strategy' && raw.strategy) {
    const s = raw.strategy;
    const trades = [...(s.opentrades || []), ...(s.closedtrades || [])];
    trades.forEach((t, idx) => {
      const size = Number(t.size ?? 0);
      const entrySide = size >= 0 ? 'BUY' : 'SELL';
      push({
        event: 'SIGNAL',
        strategy: ctx.scriptName || ctx.scriptId,
        symbol: ctx.symbol,
        timeframe: ctx.timeframe,
        candleTime: Number(t.entry_time ?? 0),
        side: entrySide,
        orderType: undefined,
        entry: round2(t.entry_price),
        reason: 'Order entry terisi (broker PineTS)',
        meta: { kind: 'ENTRY_FILLED', tradeId: String(t.id ?? idx), entryId: String(t.entry_id ?? '') },
        source: 'strategy-order',
        idSuffix: `entry${idx}`,
      });
      if (t.status === 'closed' && Number.isFinite(Number(t.exit_time))) {
        push({
          event: 'SIGNAL',
          strategy: ctx.scriptName || ctx.scriptId,
          symbol: ctx.symbol,
          timeframe: ctx.timeframe,
          candleTime: Number(t.exit_time ?? 0),
          side: entrySide === 'BUY' ? 'SELL' : 'BUY',
          entry: round2(t.exit_price),
          reason: `Posisi ditutup (${String(t.exit_id ?? 'exit')})`,
          meta: { kind: 'EXIT_FILLED', tradeId: String(t.id ?? idx) },
          source: 'strategy-order',
          idSuffix: `exit${idx}`,
        });
      }
    });
    (s.pending_orders || []).forEach((o, idx) => {
      if (o.status !== 'pending') return;
      push({
        event: 'PLACE_LIMIT',
        strategy: ctx.scriptName || ctx.scriptId,
        symbol: ctx.symbol,
        timeframe: ctx.timeframe,
        candleTime: Number(o.time ?? 0),
        side: Number(o.direction ?? 0) >= 0 ? 'BUY' : 'SELL',
        orderType: 'LIMIT',
        entry: round2(o.limit),
        qtyOz: typeof o.qty === 'number' ? o.qty : undefined,
        reason: 'Order pending aktif dari script strategy',
        meta: { orderId: String(o.id ?? idx) },
        source: 'strategy-order',
        idSuffix: `pending${idx}`,
      });
    });
  }

  // urutkan per bar lalu dedup per id (jaga-jaga alert ganda identik)
  events.sort((a, b) => a.candleTime - b.candleTime);
  const seen = new Set<string>();
  const out: PineEvent[] = [];
  for (const ev of events) {
    if (seen.has(ev.id)) continue;
    seen.add(ev.id);
    ev.candleTimeISO = iso(ev.candleTime);
    out.push(ev);
  }
  return out;
}
