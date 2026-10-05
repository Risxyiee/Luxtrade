import { NextRequest, NextResponse } from 'next/server';
import { getEnvVar as getCfEnvVar } from '@/lib/cloudflare-bindings';

// Lazy accessor for child_process.spawn — not available on Cloudflare Workers
let _spawn: any = undefined;
function getSpawn(): any {
  if (_spawn !== undefined) return _spawn;
  try {
    const cp = require('child_process');
    if (cp && typeof cp.spawn === 'function') {
      const spawnStr = cp.spawn.toString();
      if (spawnStr.includes('not implemented') || spawnStr.includes('unenv')) {
        _spawn = null;
      } else {
        _spawn = cp.spawn;
      }
    } else {
      _spawn = null;
    }
  } catch {
    _spawn = null;
  }
  return _spawn;
}

export const dynamic = 'force-dynamic'

interface CalendarEvent {
  id: string;
  date: string;
  time: string;
  dateTime: string;
  currency: string;
  impact: 'high' | 'medium' | 'low';
  event: string;
  actual?: string;
  forecast: string;
  previous: string;
  flag?: string;
}

interface CacheEntry {
  events: CalendarEvent[];
  timestamp: number;
  source: string;
  unavailable?: boolean;
}

let calendarCache: CacheEntry | null = null;
const CACHE_DURATION = 10 * 60 * 1000;
const CACHE_DURATION_RATE_LIMITED = 30 * 60 * 1000;

const PLACEHOLDER_PATTERNS = [
  'your_', 'xxx', 'sk-or-', 'sk-your', 'hf_your',
  're_xxxxxxxxxx',
];

function isPlaceholder(value: string): boolean {
  if (!value || value.length < 6) return true;
  const lower = value.toLowerCase();
  return PLACEHOLDER_PATTERNS.some(p => lower.startsWith(p));
}

function coerceEnvString(val: unknown): string {
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (val && typeof val === 'object' && 'toString' in val) {
    try { const s = String(val); if (s && s !== '[object Object]') return s; } catch {}
  }
  return '';
}

async function getEnvVar(key: string): Promise<string> {
  const centralized = await getCfEnvVar(key);
  if (centralized && centralized.length > 0 && !isPlaceholder(centralized)) {
    return centralized;
  }

  const fromProcess = process.env[key];
  if (fromProcess && fromProcess.length > 0 && !isPlaceholder(fromProcess)) {
    return fromProcess;
  }

  try {
    const cfMod = await import('@opennextjs/cloudflare');
    const getCloudflareContext = cfMod.getCloudflareContext;
    try {
      const ctx = await getCloudflareContext({ async: true });
      if (ctx?.env) {
        const raw = ctx.env[key];
        const fromCtx = coerceEnvString(raw);
        if (fromCtx && fromCtx.length > 0 && !isPlaceholder(fromCtx)) {
          return fromCtx;
        }
      }
    } catch {}
    try {
      const ctx = getCloudflareContext();
      if (ctx?.env) {
        const raw = ctx.env[key];
        const fromCtx = coerceEnvString(raw);
        if (fromCtx && fromCtx.length > 0 && !isPlaceholder(fromCtx)) {
          return fromCtx;
        }
      }
    } catch {}
  } catch {}

  return '';
}

let _envCache: Record<string, string> | null = null;

async function getConfiguredApiKeys(): Promise<{ finnhub: boolean; rapid: boolean; fcs: boolean }> {
  _envCache ??= {};
  _envCache.FINNHUB_API_KEY ??= await getEnvVar('FINNHUB_API_KEY');
  _envCache.RAPIDAPI_KEY ??= await getEnvVar('RAPIDAPI_KEY');
  _envCache.RAPIDAPI_TRADING_ECONOMICS_KEY ??= await getEnvVar('RAPIDAPI_TRADING_ECONOMICS_KEY');
  _envCache.FCSAPI_KEY ??= await getEnvVar('FCSAPI_KEY');

  return {
    finnhub: !!(_envCache.FINNHUB_API_KEY && !isPlaceholder(_envCache.FINNHUB_API_KEY)),
    rapid: !!((_envCache.RAPIDAPI_KEY || _envCache.RAPIDAPI_TRADING_ECONOMICS_KEY) && !isPlaceholder(_envCache.RAPIDAPI_KEY || _envCache.RAPIDAPI_TRADING_ECONOMICS_KEY)),
    fcs: !!(_envCache.FCSAPI_KEY && !isPlaceholder(_envCache.FCSAPI_KEY)),
  };
}

async function getFinnhubKey(): Promise<string> {
  _envCache ??= {};
  _envCache.FINNHUB_API_KEY ??= await getEnvVar('FINNHUB_API_KEY');
  return _envCache.FINNHUB_API_KEY || '';
}

async function getRapidApiKey(): Promise<string> {
  _envCache ??= {};
  _envCache.RAPIDAPI_KEY ??= await getEnvVar('RAPIDAPI_KEY');
  _envCache.RAPIDAPI_TRADING_ECONOMICS_KEY ??= await getEnvVar('RAPIDAPI_TRADING_ECONOMICS_KEY');
  return _envCache.RAPIDAPI_KEY || _envCache.RAPIDAPI_TRADING_ECONOMICS_KEY || '';
}

async function getFcsApiKey(): Promise<string> {
  _envCache ??= {};
  _envCache.FCSAPI_KEY ??= await getEnvVar('FCSAPI_KEY');
  return _envCache.FCSAPI_KEY || '';
}

function buildDateTime(date: string, time: string): string {
  try {
    if (date.includes('T')) return date;
    if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const parts = time.split(':');
      const h = (parts[0] || '0').padStart(2, '0');
      const m = (parts[1] || '0').padStart(2, '0');
      return date + 'T' + h + ':' + m + ':00Z';
    }
    return new Date().toISOString();
  } catch { return new Date().toISOString(); }
}

function sortEvents(events: CalendarEvent[]): CalendarEvent[] {
  const impactOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  return events.sort((a, b) => {
    const dc = a.date.localeCompare(b.date);
    if (dc !== 0) return dc;
    const tc = a.time.localeCompare(b.time);
    if (tc !== 0) return tc;
    return (impactOrder[a.impact] ?? 99) - (impactOrder[b.impact] ?? 99);
  });
}

async function fetchFinnhubCalendar(): Promise<CalendarEvent[]> {
  const apiKey = await getFinnhubKey();
  if (!apiKey) throw new Error('No FINNHUB_API_KEY');

  const url = `https://finnhub.io/api/v1/calendar/economic?token=${apiKey}`;
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    if (res.status === 429) { const e = new Error('Rate limited'); (e as any).isRateLimit = true; throw e; }
    throw new Error('Finnhub returned ' + res.status);
  }

  const json = await res.json();
  const rawData = json.economicCalendar || json.data || json;
  if (!Array.isArray(rawData) || rawData.length === 0) throw new Error('Empty data');

  const events: CalendarEvent[] = [];
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const countryToCurrency: Record<string, string> = {
    US: 'USD', GB: 'GBP', EU: 'EUR', JP: 'JPY', AU: 'AUD', CA: 'CAD', CH: 'CHF', NZ: 'NZD',
    CN: 'CNY', DE: 'EUR', FR: 'EUR', KR: 'KRW', IN: 'INR',
  };

  for (const item of rawData) {
    const countryCode = (item.country || '').toUpperCase();
    const currency = countryToCurrency[countryCode] || countryCode.substring(0, 3);
    if (currency.length > 4) continue;

    const impactStr = String(item.impact || 'low').toLowerCase();
    const impact: 'high' | 'medium' | 'low' = impactStr === 'high' || impactStr === '3' ? 'high' : impactStr === 'medium' || impactStr === '2' ? 'medium' : 'low';
    const eventTitle = (item.indicator || item.event || 'Economic Event') as string;

    const rawTime = (item.time || '') as string;
    let eventDate = todayStr, eventTime = '08:30';
    const dtMatch = rawTime.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})/);
    if (dtMatch) { eventDate = dtMatch[1]; eventTime = dtMatch[2]; }
    else { const dOnly = rawTime.match(/^(\d{4}-\d{2}-\d{2})/); if (dOnly) eventDate = dOnly[1]; }

    const dedupeKey = currency + '-' + eventDate + '-' + eventTitle.substring(0, 30);
    if (events.some(e => (e.currency + '-' + e.date + '-' + e.event.substring(0, 30)) === dedupeKey)) continue;

    events.push({
      id: 'fh-' + events.length + '-' + currency + '-' + eventDate,
      date: eventDate, time: eventTime,
      dateTime: buildDateTime(eventDate, eventTime),
      currency, impact, event: eventTitle,
      actual: item.actual != null ? String(item.actual) : undefined,
      forecast: item.estimate != null ? String(item.estimate) : '',
      previous: item.prev != null ? String(item.prev) : '',
    });
  }

  return sortEvents(events);
}

async function fetchFcsApiCalendar(): Promise<CalendarEvent[]> {
  const fcsKey = await getFcsApiKey();
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const url = fcsKey ? `https://fcsapi.com/api-v3/forex/calendar?date=${dateStr}&key=${fcsKey}` : `https://fcsapi.com/api-v3/forex/calendar?date=${dateStr}`;

  const res = await fetch(url, { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error('FCSAPI returned ' + res.status);

  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch { throw new Error('FCSAPI returned non-JSON'); }
  const rawData = json.response || json.data || json;
  if (!Array.isArray(rawData) || rawData.length === 0) throw new Error('Empty data');

  const events: CalendarEvent[] = [];
  const todayStr = today.toISOString().split('T')[0];
  for (const item of rawData) {
    const currency = (item.currency || '').toUpperCase();
    if (!currency || currency.length > 4) continue;
    const impactStr = String(item.impact || item.priority || '').toLowerCase();
    const impact: 'high' | 'medium' | 'low' = impactStr === 'high' || impactStr === '3' || impactStr === 'hot' ? 'high' : impactStr === 'medium' || impactStr === '2' ? 'medium' : 'low';
    const eventTitle = item.event || item.title || 'Economic Event';
    const eventDate = item.date || todayStr;
    const eventTime = item.time || '08:30';

    const dedupeKey = currency + '-' + eventDate + '-' + eventTitle.substring(0, 30);
    if (events.some(e => (e.currency + '-' + e.date + '-' + e.event.substring(0, 30)) === dedupeKey)) continue;

    events.push({
      id: 'fcs-' + events.length + '-' + currency + '-' + eventDate,
      date: eventDate, time: eventTime,
      dateTime: buildDateTime(eventDate, eventTime),
      currency, impact, event: eventTitle,
      actual: item.actual != null ? String(item.actual) : undefined,
      forecast: item.forecast != null ? String(item.forecast) : '',
      previous: item.previous != null ? String(item.previous) : '',
    });
  }

  return sortEvents(events);
}

async function fetchTECalendar(): Promise<CalendarEvent[]> {
  const apiKey = await getRapidApiKey();
  if (!apiKey) throw new Error('No RAPIDAPI_KEY');

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + 7);
  const endStr = endDate.toISOString().split('T')[0];

  const url = `https://trading-economics-scraper.p.rapidapi.com/get_calendar?country=United%20States,United%20Kingdom,Euro%20Zone,Japan,Australia,Canada,Switzerland,New%20Zealand&importance=3,2,1&start_date=${todayStr}&end_date=${endStr}`;

  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'x-rapidapi-host': 'trading-economics-scraper.p.rapidapi.com',
      'x-rapidapi-key': apiKey,
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    if (res.status === 429) { const e = new Error('Rate limited'); (e as any).isRateLimit = true; throw e; }
    throw new Error('TE Calendar returned ' + res.status);
  }

  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) throw new Error('Empty data');

  const countryToCurrency: Record<string, string> = {
    'United States': 'USD', 'United Kingdom': 'GBP', 'Euro Zone': 'EUR', 'Japan': 'JPY',
    'Australia': 'AUD', 'Canada': 'CAD', 'Switzerland': 'CHF', 'New Zealand': 'NZD',
  };

  const events: CalendarEvent[] = [];
  for (const item of data) {
    const countryName = item.country || '';
    const currency = countryToCurrency[countryName] || (item.currency || '').toUpperCase();
    if (!currency || currency.length > 4) continue;

    const impStr = String(item.importance || item.priority || '').toLowerCase();
    const impact: 'high' | 'medium' | 'low' = impStr === '3' || impStr === 'high' ? 'high' : impStr === '2' || impStr === 'medium' ? 'medium' : 'low';
    const eventTitle = item.event || item.indicator || item.title || 'Economic Event';
    const eventDate = (item.date || todayStr).split('T')[0];
    const eventTime = item.time || '08:30';

    const dedupeKey = currency + '-' + eventDate + '-' + eventTitle.substring(0, 30);
    if (events.some(e => (e.currency + '-' + e.date + '-' + e.event.substring(0, 30)) === dedupeKey)) continue;

    events.push({
      id: 'te-' + events.length + '-' + currency + '-' + eventDate,
      date: eventDate, time: eventTime,
      dateTime: buildDateTime(eventDate, eventTime),
      currency, impact, event: eventTitle,
      actual: item.actual != null ? String(item.actual) : undefined,
      forecast: item.forecast != null ? String(item.forecast) : '',
      previous: item.previous != null ? String(item.previous) : '',
    });
  }

  return sortEvents(events);
}

async function fetchFallbackCalendar(): Promise<CalendarEvent[]> {
  const today = new Date();
  const events: CalendarEvent[] = [];
  const dow = today.getDay();
  const gdd = (t: number) => { const d = new Date(today); d.setDate(d.getDate() + (t - dow)); return d.toISOString().split('T')[0]; };
  const mon = gdd(1), tue = gdd(2), wed = gdd(3), thu = gdd(4), fri = gdd(5);

  events.push(
    { id: 'fb-1', date: mon, time: '07:00', dateTime: buildDateTime(mon, '07:00'), currency: 'EUR', impact: 'medium', event: 'Sentix Investor Confidence', forecast: '', previous: '' },
    { id: 'fb-2', date: mon, time: '08:30', dateTime: buildDateTime(mon, '08:30'), currency: 'USD', impact: 'low', event: 'Chicago Fed National Activity Index', forecast: '', previous: '' },
    { id: 'fb-3', date: tue, time: '07:00', dateTime: buildDateTime(tue, '07:00'), currency: 'EUR', impact: 'medium', event: 'German ZEW Economic Sentiment', forecast: '', previous: '' },
    { id: 'fb-4', date: tue, time: '10:00', dateTime: buildDateTime(tue, '10:00'), currency: 'EUR', impact: 'medium', event: 'ZEW Economic Sentiment', forecast: '', previous: '' },
    { id: 'fb-5', date: tue, time: '08:30', dateTime: buildDateTime(tue, '08:30'), currency: 'USD', impact: 'high', event: 'Retail Sales MoM', forecast: '0.3%', previous: '0.0%' },
    { id: 'fb-6', date: tue, time: '08:30', dateTime: buildDateTime(tue, '08:30'), currency: 'USD', impact: 'high', event: 'Core Retail Sales MoM', forecast: '0.2%', previous: '0.1%' },
    { id: 'fb-7', date: tue, time: '09:15', dateTime: buildDateTime(tue, '09:15'), currency: 'USD', impact: 'high', event: 'Industrial Production MoM', forecast: '0.3%', previous: '0.1%' },
    { id: 'fb-8', date: wed, time: '02:00', dateTime: buildDateTime(wed, '02:00'), currency: 'NZD', impact: 'medium', event: 'Westpac Consumer Confidence', forecast: '', previous: '' },
    { id: 'fb-9', date: wed, time: '07:00', dateTime: buildDateTime(wed, '07:00'), currency: 'EUR', impact: 'medium', event: 'German PPI MoM', forecast: '', previous: '' },
    { id: 'fb-10', date: wed, time: '08:30', dateTime: buildDateTime(wed, '08:30'), currency: 'USD', impact: 'high', event: 'Building Permits', forecast: '1.46M', previous: '1.49M' },
    { id: 'fb-11', date: wed, time: '08:30', dateTime: buildDateTime(wed, '08:30'), currency: 'USD', impact: 'high', event: 'Housing Starts', forecast: '1.37M', previous: '1.36M' },
    { id: 'fb-12', date: wed, time: '18:00', dateTime: buildDateTime(wed, '18:00'), currency: 'USD', impact: 'medium', event: 'FOMC Meeting Minutes', forecast: '', previous: '' },
    { id: 'fb-13', date: wed, time: '14:30', dateTime: buildDateTime(wed, '14:30'), currency: 'USD', impact: 'high', event: 'EIA Crude Oil Inventories', forecast: '', previous: '' },
    { id: 'fb-14', date: thu, time: '00:50', dateTime: buildDateTime(thu, '00:50'), currency: 'JPY', impact: 'medium', event: 'Trade Balance', forecast: '', previous: '' },
    { id: 'fb-15', date: thu, time: '08:30', dateTime: buildDateTime(thu, '08:30'), currency: 'USD', impact: 'high', event: 'Initial Jobless Claims', forecast: '220K', previous: '222K' },
    { id: 'fb-16', date: thu, time: '08:30', dateTime: buildDateTime(thu, '08:30'), currency: 'USD', impact: 'high', event: 'Philadelphia Fed Mfg Index', forecast: '-8.0', previous: '-10.3' },
    { id: 'fb-17', date: thu, time: '10:00', dateTime: buildDateTime(thu, '10:00'), currency: 'USD', impact: 'high', event: 'Existing Home Sales', forecast: '3.95M', previous: '3.96M' },
    { id: 'fb-18', date: thu, time: '07:00', dateTime: buildDateTime(thu, '07:00'), currency: 'EUR', impact: 'medium', event: 'ECB Economic Bulletin', forecast: '', previous: '' },
    { id: 'fb-19', date: thu, time: '08:30', dateTime: buildDateTime(thu, '08:30'), currency: 'GBP', impact: 'medium', event: 'Retail Sales MoM', forecast: '', previous: '' },
    { id: 'fb-20', date: fri, time: '08:30', dateTime: buildDateTime(fri, '08:30'), currency: 'USD', impact: 'high', event: 'Durable Goods Orders MoM', forecast: '-0.5%', previous: '0.0%' },
    { id: 'fb-21', date: fri, time: '10:00', dateTime: buildDateTime(fri, '10:00'), currency: 'USD', impact: 'high', event: 'U of Michigan Consumer Sentiment', forecast: '71.0', previous: '70.7' },
    { id: 'fb-22', date: fri, time: '07:00', dateTime: buildDateTime(fri, '07:00'), currency: 'EUR', impact: 'medium', event: 'German Ifo Business Climate', forecast: '', previous: '' },
    { id: 'fb-23', date: fri, time: '09:00', dateTime: buildDateTime(fri, '09:00'), currency: 'EUR', impact: 'medium', event: 'Eurozone Consumer Confidence', forecast: '', previous: '' },
    { id: 'fb-24', date: fri, time: '08:30', dateTime: buildDateTime(fri, '08:30'), currency: 'CAD', impact: 'high', event: 'Retail Sales MoM', forecast: '', previous: '' },
    { id: 'fb-25', date: fri, time: '08:30', dateTime: buildDateTime(fri, '08:30'), currency: 'GBP', impact: 'high', event: 'GDP Growth Rate QoQ', forecast: '', previous: '' },
    { id: 'fb-26', date: fri, time: '08:30', dateTime: buildDateTime(fri, '08:30'), currency: 'USD', impact: 'high', event: 'Nonfarm Payrolls (1st Fri)', forecast: '', previous: '' },
  );

  return sortEvents(events);
}

async function fetchCalendarEvents(): Promise<{ events: CalendarEvent[]; source: string; unavailable: boolean }> {
  const errors: string[] = [];
  const collectedEvents: CalendarEvent[] = [];
  let primarySource = '';
  const apiKeys = await getConfiguredApiKeys();
  const anyKeyConfigured = apiKeys.finnhub || apiKeys.rapid || apiKeys.fcs;

  if (apiKeys.finnhub) {
    try {
      const events = await fetchFinnhubCalendar();
      if (events.length > 0) {
        primarySource = 'Finnhub (Live)';
        collectedEvents.push(...events);
      }
    } catch (err: any) {
      errors.push('Finnhub: ' + err.message);
    }
  }

  if (apiKeys.rapid) {
    try {
      const events = await fetchTECalendar();
      if (events.length > 0) {
        if (!primarySource) primarySource = 'TradingEconomics (Live)';
        collectedEvents.push(...events);
      }
    } catch (err: any) {
      errors.push('TE: ' + err.message);
    }
  }

  if (collectedEvents.length > 0) {
    const seen = new Set<string>();
    const deduped = collectedEvents.filter(e => {
      const key = e.currency + '-' + e.date + '-' + e.event.substring(0, 30);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return { events: sortEvents(deduped), source: primarySource || 'API (Live)', unavailable: false };
  }

  if (anyKeyConfigured) {
    console.warn('[EconCalendar] Live API keys configured but no live source succeeded. Returning unavailable instead of fake fallback data. Errors:', errors.join('; '));
    return { events: [], source: 'Unavailable', unavailable: true };
  }

  const fallbackEvents = await fetchFallbackCalendar();
  return { events: fallbackEvents, source: 'Fallback Schedule (no live API keys)', unavailable: true };
}

function isSampleCalendarData(events: CalendarEvent[]): boolean {
  if (events.length === 0) return true;

  const sampleIndicators = [
    'unavailable',
    'sample',
    'placeholder',
    'lorem ipsum',
    'temporarily unavailable',
  ];

  for (const item of events.slice(0, 5)) {
    for (const indicator of sampleIndicators) {
      if (item.event.toLowerCase().includes(indicator)) return true;
    }
    if (item.id && item.id.startsWith('fb-')) return true;
    if (!item.id || !item.id.match(/^(fh-|te-|fcs-|mfb-|inv-|ws-|fb-)/)) return true;
  }
  return false;
}

async function getKVCache(): Promise<CacheEntry | null> {
  try {
    let kv: any = null;
    try {
      const { getCloudflareContext } = await import('@opennextjs/cloudflare');
      const ctx = getCloudflareContext();
      kv = (ctx as any)?.env?.luxtradee_kv;
    } catch {}
    if (!kv) return null;
    const raw = await kv.get('economic_calendar_cache', 'text');
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;

    if (isSampleCalendarData(entry.events)) {
      try { await kv.delete('economic_calendar_cache'); } catch {}
      return null;
    }

    if (entry.source && (entry.source.includes('Fallback') || entry.unavailable === true)) {
      try { await kv.delete('economic_calendar_cache'); } catch {}
      return null;
    }

    return entry;
  } catch { return null; }
}

async function setKVCache(entry: CacheEntry, ttlMs?: number): Promise<void> {
  try {
    let kv: any = null;
    try {
      const { getCloudflareContext } = await import('@opennextjs/cloudflare');
      const ctx = getCloudflareContext();
      kv = (ctx as any)?.env?.luxtradee_kv;
    } catch {}
    if (!kv) return;
    await kv.put('economic_calendar_cache', JSON.stringify(entry), { expirationTtl: Math.ceil((ttlMs || CACHE_DURATION) / 1000) });
  } catch {}
}

export async function GET(request: NextRequest) {
  _envCache = null;

  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get('refresh') === 'true' || searchParams.get('forceRefresh') === 'true';
  const impactFilter = searchParams.get('impact');
  const currencyFilter = searchParams.get('currency');
  const timezone = searchParams.get('tz');
  const now = new Date();
  const serverTime = now.toISOString();

  if (searchParams.get('debug') === 'true') {
    const keys = await getConfiguredApiKeys();
    return NextResponse.json({
      environment: process.env.NODE_ENV || 'unknown',
      configuredApiKeys: keys,
      apiKeys: {
        FINNHUB_API_KEY: (await getFinnhubKey()) ? `SET (${(await getFinnhubKey()).length} chars)` : 'NOT SET',
        RAPIDAPI_KEY: (await getRapidApiKey()) ? `SET (${(await getRapidApiKey()).length} chars)` : 'NOT SET',
        FCSAPI_KEY: (await getFcsApiKey()) ? `SET (${(await getFcsApiKey()).length} chars)` : 'NOT SET',
      },
      cacheStatus: {
        inMemory: calendarCache ? `${calendarCache.events.length} events, source: ${calendarCache.source}` : 'empty',
      },
      now: serverTime,
    });
  }

  try {
    if (!forceRefresh) {
      const kvEntry = await getKVCache();
      if (kvEntry && Date.now() - kvEntry.timestamp < CACHE_DURATION) {
        let events = kvEntry.events;
        if (impactFilter) events = events.filter(e => e.impact === impactFilter);
        if (currencyFilter) events = events.filter(e => e.currency === currencyFilter);
        return NextResponse.json({
          success: true, cached: true, cacheSource: 'kv', events,
          totalAvailable: kvEntry.events.length, source: kvEntry.source,
          fetchedAt: new Date(kvEntry.timestamp).toISOString(),
          now: serverTime, timezone: timezone || null,
          unavailable: kvEntry.unavailable || false,
        });
      }
    }

    if (!forceRefresh && calendarCache && Date.now() - calendarCache.timestamp < CACHE_DURATION) {
      if (isSampleCalendarData(calendarCache.events)) {
        calendarCache = null;
      } else if (calendarCache.source && (calendarCache.source.includes('Fallback') || calendarCache.unavailable === true)) {
        calendarCache = null;
      } else {
        let events = calendarCache.events;
        if (impactFilter) events = events.filter(e => e.impact === impactFilter);
        if (currencyFilter) events = events.filter(e => e.currency === currencyFilter);
        return NextResponse.json({
          success: true, cached: true, cacheSource: 'memory', events,
          totalAvailable: calendarCache.events.length, source: calendarCache.source,
          fetchedAt: new Date(calendarCache.timestamp).toISOString(),
          now: serverTime, timezone: timezone || null,
          unavailable: calendarCache.unavailable || false,
        });
      }
    }

    let fetchResult: { events: CalendarEvent[]; source: string; unavailable: boolean };
    try {
      fetchResult = await Promise.race([
        fetchCalendarEvents(),
        new Promise<{ events: CalendarEvent[]; source: string; unavailable: boolean }>((resolve) =>
          setTimeout(() => {
            console.warn('[EconCalendar] Cascade timed out after 25s');
            resolve({ events: [], source: 'Unavailable', unavailable: true });
          }, 25000)
        ),
      ]);
    } catch (err: any) {
      console.error('[EconCalendar] Cascade error:', err.message);
      fetchResult = { events: [], source: 'Unavailable', unavailable: true };
    }

    const { events: allEvents, source, unavailable } = fetchResult;
    const cacheTTL = (unavailable && allEvents.length === 0) ? 60 * 1000 : CACHE_DURATION;
    const newCache: CacheEntry = { events: allEvents, timestamp: Date.now(), source, unavailable };
    calendarCache = newCache;
    await setKVCache(newCache, cacheTTL);

    let events = allEvents;
    if (impactFilter) events = events.filter(e => e.impact === impactFilter);
    if (currencyFilter) events = events.filter(e => e.currency === currencyFilter);

    return NextResponse.json({
      success: true, cached: false, events,
      totalAvailable: allEvents.length, source,
      fetchedAt: new Date().toISOString(),
      now: serverTime, timezone: timezone || null, unavailable,
    });
  } catch (error) {
    console.error('[EconCalendar] API error:', error);

    if (calendarCache && calendarCache.events.length > 0) {
      let events = calendarCache.events;
      if (impactFilter) events = events.filter(e => e.impact === impactFilter);
      if (currencyFilter) events = events.filter(e => e.currency === currencyFilter);
      return NextResponse.json({
        success: true, cached: true, expired: true, events,
        totalAvailable: calendarCache.events.length,
        source: calendarCache.source + ' (stale)',
        fetchedAt: new Date(calendarCache.timestamp).toISOString(),
        now: serverTime, timezone: timezone || null,
        message: 'Using cached data (fresh data unavailable)',
      });
    }

    return NextResponse.json({
      success: true, cached: false, events: [],
      totalAvailable: 0, source: 'Unavailable',
      fetchedAt: new Date().toISOString(), now: serverTime,
      timezone: timezone || null, unavailable: true,
      message: 'Calendar data temporarily unavailable. Try again in a few minutes.',
    });
  }
}




































































































































































































































































































































































































