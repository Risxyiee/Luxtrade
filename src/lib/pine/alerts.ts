/**
 * alerts.ts — pengiriman alert Pine Signals ke kanal milik user.
 * Kanal: web-push (pushToUser), Telegram (Bot API), webhook (POST JSON).
 * Event CANCEL_PENDING wajib ikut terkirim (aturan tugas) — semua jenis
 * event melewati saluran yang sama.
 */
import { pushToUser } from '@/lib/push-notify';
import type { PineEvent } from './types';
import type { PineChannelRow } from './store';

export interface DeliveryResult {
  channel: PineChannelRow['type'];
  ok: boolean;
  detail?: string;
}

function fmtPrice(x: unknown): string {
  return typeof x === 'number' ? x.toFixed(2) : '-';
}

export function formatEventText(ev: PineEvent, scriptName: string): string {
  const sym = ev.symbol || 'XAUUSD';
  const tf = ev.timeframe || 'H1';
  switch (ev.event) {
    case 'PLACE_LIMIT':
      return `[${scriptName}] ${sym} ${tf} — PLACE LIMIT ${ev.side} @ ${fmtPrice(ev.entry)} | SL ${fmtPrice(ev.sl)} | TP ${fmtPrice(ev.tp)} (${ev.qtyOz ?? '-'} oz)`;
    case 'REPLACE_LIMIT':
      return `[${scriptName}] ${sym} ${tf} — REPLACE LIMIT ${ev.side} @ ${fmtPrice(ev.entry)} | SL ${fmtPrice(ev.sl)} | TP ${fmtPrice(ev.tp)}`;
    case 'CANCEL_PENDING':
      return `[${scriptName}] ${sym} ${tf} — CANCEL PENDING ${ev.side} (${ev.reason || '-'})`;
    case 'CLOSE_POSITION':
      return `[${scriptName}] ${sym} ${tf} — CLOSE POSITION (${ev.reason || '-'})`;
    default:
      return `[${scriptName}] ${sym} ${tf} — SIGNAL ${ev.side || ''} ${ev.reason ? `(${ev.reason})` : ''}`.trimEnd();
  }
}

async function sendTelegram(ev: PineEvent, scriptName: string, cfg: Record<string, unknown>): Promise<DeliveryResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = (cfg.chatId as string) || '';
  if (!token || !chatId) {
    return { channel: 'telegram', ok: false, detail: 'TELEGRAM_BOT_TOKEN/chatId belum diatur' };
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: formatEventText(ev, scriptName),
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return { channel: 'telegram', ok: false, detail: `HTTP ${res.status}` };
    }
    return { channel: 'telegram', ok: true };
  } catch (e) {
    return { channel: 'telegram', ok: false, detail: (e as Error).message };
  }
}

async function sendWebhook(ev: PineEvent, scriptName: string, cfg: Record<string, unknown>): Promise<DeliveryResult> {
  const url = (cfg.url as string) || '';
  if (!/^https?:\/\//i.test(url)) {
    return { channel: 'webhook', ok: false, detail: 'URL webhook tidak valid' };
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(typeof cfg.secret === 'string' && cfg.secret ? { 'x-pine-secret': cfg.secret } : {}),
      },
      body: JSON.stringify({ type: 'pine_signal', script: scriptName, event: ev }),
      signal: AbortSignal.timeout(8000),
    });
    return { channel: 'webhook', ok: res.ok, detail: res.ok ? undefined : `HTTP ${res.status}` };
  } catch (e) {
    return { channel: 'webhook', ok: false, detail: (e as Error).message };
  }
}

async function sendPush(ev: PineEvent, scriptName: string, userId: string): Promise<DeliveryResult> {
  try {
    const { getSupabaseAdmin } = await import('@/lib/supabase-admin-alt');
    const admin = getSupabaseAdmin();
    if (!admin) return { channel: 'push', ok: false, detail: 'Supabase admin tidak tersedia' };
    const res = await pushToUser(admin, userId, {
      title: `Pine Signals — ${ev.event.replace('_', ' ')}`,
      body: formatEventText(ev, scriptName),
      url: '/?tab=pine',
    });
    const ok = (res?.sent ?? 0) > 0;
    return { channel: 'push', ok, detail: ok ? undefined : 'tidak ada subscription push aktif' };
  } catch (e) {
    return { channel: 'push', ok: false, detail: (e as Error).message };
  }
}

/** Kirim satu event ke semua kanal aktif user. */
export async function deliverEvent(
  ev: PineEvent,
  scriptName: string,
  userId: string,
  channels: PineChannelRow[]
): Promise<DeliveryResult[]> {
  const results: DeliveryResult[] = [];
  for (const ch of channels) {
    if (!ch.enabled) continue;
    if (ch.type === 'push') results.push(await sendPush(ev, scriptName, userId));
    else if (ch.type === 'telegram') results.push(await sendTelegram(ev, scriptName, ch.config));
    else if (ch.type === 'webhook') results.push(await sendWebhook(ev, scriptName, ch.config));
  }
  return results;
}
