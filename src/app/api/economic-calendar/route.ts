import { NextRequest, NextResponse } from 'next/server';
import { getEnvVar } from '@/lib/cloudflare-bindings';

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────
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

// ─── In-Memory Cache ────────────────────────────────────────────────────────
let calendarCache: CacheEntry | null = null;
// 2h serve window — the calendar is WEEKLY data (only actuals update intraday),
// and nfs.faireconomy.media rate-limits shared Cloudflare Workers egress IPs.
// A longer window means far fewer upstream hits (max ~12/day instead of ~48).
const CACHE_DURATION = 2 * 60 * 60 * 1000;
const CACHE_DURATION_RATE_LIMITED = 30 * 60 * 1000; // 30 min when rate limited

// Last-known-good KV cache: survives long upstream outages (7 days).
// When ALL live sources fail, we serve this instead of the synthetic fallback.
const LASTGOOD_KV_KEY = 'economic_calendar_lastgood';
const LASTGOOD_KV_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

// ─── API Key Helpers ────────────────────────────────────────────────────────
let _envCache: Record<string, string> | null = null;

async function getFinnhubKey(): Promise<string> {
  _envCache ??= {};
  _envCache.FINNHUB_API_KEY ??= await getEnvVar('FINNHUB_API_KEY', { quiet: true });
  return _envCache.FINNHUB_API_KEY || '';
}
async function getRapidApiKey(): Promise<string> {
  _envCache ??= {};
  _envCache.RAPIDAPI_KEY ??= await getEnvVar('RAPIDAPI_KEY', { quiet: true });
  _envCache.RAPIDAPI_TRADING_ECONOMICS_KEY ??= await getEnvVar('RAPIDAPI_TRADING_ECONOMICS_KEY', { quiet: true });
  return _envCache.RAPIDAPI_KEY || _envCache.RAPIDAPI_TRADING_ECONOMICS_KEY || '';
}
async function getFcsApiKey(): Promise<string> {
  _envCache ??= {};
  _envCache.FCSAPI_KEY ??= await getEnvVar('FCSAPI_KEY', { quiet: true });
  return _envCache.FCSAPI_KEY || '';
}

// ─── Helper: Build ISO datetime ────────────────────────────────────────────
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

// ─── Helper: Sort events ──────────────────────────────────────────────────
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

// ─── 1. Faireconomy.media / ForexFactory JSON (FREE, no API key, works from CF Workers) ──
async function fetchFaireconomyCalendar(): Promise<CalendarEvent[]> {
  // IMPORTANT: Faireconomy.media rate-limits requests without a Referer header
  // from forexfactory.com — we must include it to bypass the 429 block.
  // Try both thisweek and nextweek endpoints for more data coverage.
  const urls = [
    'https://nfs.faireconomy.media/ff_calendar_thisweek.json',
    'https://nfs.faireconomy.media/ff_calendar_nextweek.json',
  ];
  const events: CalendarEvent[] = [];

  // Three attempts with increasing delay — the rate limiter is often a
  // per-second burst limit, so retries after a pause rescue transient hits.
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (events.length > 0) break;
    if (attempt > 1) {
      await new Promise(r => setTimeout(r, attempt * 1000)); // 2s, 3s backoff
      console.log('[EconCalendar] Faireconomy retry attempt ' + attempt);
    }

    for (const url of urls) {
      try {
        const res = await fetch(url, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://www.forexfactory.com/',
          },
          signal: AbortSignal.timeout(12000),
        });
        if (!res.ok) {
          console.warn(`[EconCalendar] Faireconomy ${url} returned ${res.status} ${res.statusText} (attempt ${attempt})`);
          continue;
        }
        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) continue;

        for (const item of data) {
          const currency = (item.country || '').toUpperCase();
          if (!currency || currency.length > 4) continue;
          // Skip "All" or non-currency entries
          if (currency === 'ALL' || currency.length < 2) continue;

          const impactStr = String(item.impact || '').toLowerCase();
          const impact: 'high' | 'medium' | 'low' =
            impactStr === 'high' || impactStr === '3' || impactStr === 'hot' ? 'high' :
            impactStr === 'medium' || impactStr === '2' ? 'medium' : 'low';
          // Skip "Holiday" impact entries
          if (impactStr === 'holiday') continue;

          const eventTitle = (item.title || 'Economic Event').trim();
          if (!eventTitle || eventTitle.length < 3) continue;

          // Parse date — format: "2026-10-21T02:00:00-04:00"
          let eventDate = new Date().toISOString().split('T')[0];
          let eventTime = '08:30';
          if (item.date) {
            try {
              const d = new Date(item.date);
              if (!isNaN(d.getTime())) {
                // Convert to UTC for consistency
                eventDate = d.toISOString().split('T')[0];
                eventTime = d.toISOString().substring(11, 16);
              }
            } catch {}
          }

          const dedupeKey = currency + '-' + eventDate + '-' + eventTitle.substring(0, 30);
          if (events.some(e => (e.currency + '-' + e.date + '-' + e.event.substring(0, 30)) === dedupeKey)) continue;

          events.push({
            id: 'fe-' + events.length + '-' + currency + '-' + eventDate,
            date: eventDate,
            time: eventTime,
            dateTime: buildDateTime(eventDate, eventTime),
            currency,
            impact,
            event: eventTitle,
            actual: item.actual != null ? String(item.actual) : undefined,
            forecast: item.forecast != null ? String(item.forecast) : '',
            previous: item.previous != null ? String(item.previous) : '',
          });
        }
      } catch (err: any) {
        console.warn(`[EconCalendar] Faireconomy fetch error: ${err.message}`);
      }
    } // end urls loop
  } // end attempts loop

  if (events.length === 0) throw new Error('No events from Faireconomy (thisweek returned empty or rate-limited)');
  console.log('[EconCalendar] Faireconomy SUCCESS: ' + events.length + ' events');
  return sortEvents(events);
}

// ─── 2. FCSAPI.com Calendar (DEAD — returns 404, kept as fallback) ──────────
async function fetchFcsApiCalendar(): Promise<CalendarEvent[]> {
  const fcsKey = await getFcsApiKey();
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const url = fcsKey
    ? `https://fcsapi.com/api-v3/forex/calendar?date=${dateStr}&key=${fcsKey}`
    : `https://fcsapi.com/api-v3/forex/calendar?date=${dateStr}`;

  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
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
    const impact: 'high' | 'medium' | 'low' =
      impactStr === 'high' || impactStr === '3' || impactStr === 'hot' ? 'high' :
      impactStr === 'medium' || impactStr === '2' ? 'medium' : 'low';
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

  console.log('[EconCalendar] FCSAPI: ' + events.length + ' events');
  return sortEvents(events);
}

// ─── 2. Finnhub Calendar (FREE tier: 60 calls/min) ────────────────────────
async function fetchFinnhubCalendar(): Promise<CalendarEvent[]> {
  const apiKey = await getFinnhubKey();
  if (!apiKey) throw new Error('No FINNHUB_API_KEY');

  const url = `https://finnhub.io/api/v1/calendar/economic?token=${apiKey}`;
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    if (res.status === 429) {
      const e = new Error('Rate limited');
      (e as any).isRateLimit = true;
      throw e;
    }
    if (res.status === 403) {
      throw new Error('Finnhub 403 — API key may be invalid or free tier restricted from CF Workers IP');
    }
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
    const impact: 'high' | 'medium' | 'low' =
      impactStr === 'high' || impactStr === '3' ? 'high' :
      impactStr === 'medium' || impactStr === '2' ? 'medium' : 'low';
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

  console.log('[EconCalendar] Finnhub: ' + events.length + ' events');
  return sortEvents(events);
}

// ─── 3. TradingEconomics Calendar (RapidAPI) ──────────────────────────────
async function fetchTECalendar(): Promise<CalendarEvent[]> {
  const apiKey = await getRapidApiKey();
  if (!apiKey) throw new Error('No RAPIDAPI_KEY');

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + 7);
  const endStr = endDate.toISOString().split('T')[0];

  // TradingEconomics calendar endpoint on RapidAPI
  // Note: Free tier has strict rate limits (typically 500 req/month)
  const url = `https://tradingeconomics.p.rapidapi.com/calendar?country=United%20States,United%20Kingdom,Euro%20Zone,Japan,Australia,Canada,Switzerland,New%20Zealand&importance=3,2,1&start_date=${todayStr}&end_date=${endStr}`;

  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'x-rapidapi-host': 'tradingeconomics.p.rapidapi.com',
      'x-rapidapi-key': apiKey,
      'User-Agent': 'Mozilla/5.0 (compatible; LuxTradeBot/1.0)',
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    if (res.status === 429) {
      const e = new Error('Rate limited');
      (e as any).isRateLimit = true;
      throw e;
    }
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
    const impact: 'high' | 'medium' | 'low' =
      impStr === '3' || impStr === 'high' ? 'high' :
      impStr === '2' || impStr === 'medium' ? 'medium' : 'low';
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

  console.log('[EconCalendar] TradingEconomics: ' + events.length + ' events');
  return sortEvents(events);
}

// ─── 4. MyFXBook Calendar RSS (FREE, no API key) ──────────────────────────
async function fetchMyFXBookCalendar(): Promise<CalendarEvent[]> {
  const todayStr = new Date().toISOString().split('T')[0];
  const res = await fetch('https://www.myfxbook.com/calendar.feed', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Accept': 'application/rss+xml, text/xml, text/html, */*;',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(8000),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error('MyFXBook returned ' + res.status);

  const xml = await res.text();
  if (!xml.includes('<item') && !xml.includes('<entry')) throw new Error('MyFXBook response is not RSS/XML');

  const events: CalendarEvent[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null && events.length < 80) {
    const itemXml = match[1];

    const titleMatch = itemXml.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i)
      || itemXml.match(/<title>([\s\S]*?)<\/title>/i);
    const eventTitle = titleMatch?.[1]?.trim() || '';
    if (!eventTitle || eventTitle.length < 3) continue;

    const currMatch = eventTitle.match(/^(USD|EUR|GBP|JPY|AUD|CAD|CHF|NZD|CNY)\b/i);
    const currency = currMatch ? currMatch[1].toUpperCase() : '';
    if (!currency) continue;

    const dateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
    let eventDate = todayStr, eventTime = '08:30';
    if (dateMatch?.[1]) {
      try {
        const d = new Date(dateMatch[1].trim());
        if (!isNaN(d.getTime())) {
          eventDate = d.toISOString().split('T')[0];
          eventTime = d.toISOString().substring(11, 16);
        }
      } catch {}
    }

    const descMatch = itemXml.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i)
      || itemXml.match(/<description>([\s\S]*?)<\/description>/i);
    const desc = descMatch?.[1]?.trim() || '';

    const impact: 'high' | 'medium' | 'low' =
      /\b(high|critical|3)\b/i.test(desc) || /\bhigh\s*impact\b/i.test(eventTitle) ? 'high' :
      /\b(medium|moderate|2)\b/i.test(desc) ? 'medium' : 'low';

    const actualMatch = desc.match(/Actual[:\s]*([\-\d.]+%?)/i);
    const forecastMatch = desc.match(/Forecast[:\s]*([\-\d.]+%?)/i);
    const previousMatch = desc.match(/Previous[:\s]*([\-\d.]+%?)/i);

    const dedupeKey = currency + '-' + eventDate + '-' + eventTitle.substring(0, 30);
    if (events.some(e => (e.currency + '-' + e.date + '-' + e.event.substring(0, 30)) === dedupeKey)) continue;

    events.push({
      id: 'mfb-' + events.length + '-' + currency + '-' + eventDate,
      date: eventDate, time: eventTime,
      dateTime: buildDateTime(eventDate, eventTime),
      currency, impact, event: eventTitle,
      actual: actualMatch?.[1] || undefined,
      forecast: forecastMatch?.[1] || '',
      previous: previousMatch?.[1] || '',
    });
  }

  if (events.length === 0) throw new Error('No events parsed from MyFXBook RSS');
  console.log('[EconCalendar] MyFXBook: ' + events.length + ' events');
  return sortEvents(events);
}

// ─── 5. ForexFactory Calendar XML (FREE, no API key) ─────────────────────
async function fetchForexFactoryCalendar(): Promise<CalendarEvent[]> {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // ForexFactory provides a weekly XML calendar
  const res = await fetch('https://www.forexfactory.com/rss', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Accept': 'application/rss+xml, text/xml, */*;',
    },
    signal: AbortSignal.timeout(8000),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error('ForexFactory returned ' + res.status);

  const xml = await res.text();
  if (!xml.includes('<item') && !xml.includes('<entry')) throw new Error('ForexFactory response is not RSS/XML');

  const events: CalendarEvent[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null && events.length < 80) {
    const itemXml = match[1];

    // Extract title
    const titleMatch = itemXml.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i)
      || itemXml.match(/<title>([\s\S]*?)<\/title>/i);
    const eventTitle = titleMatch?.[1]?.trim() || '';
    if (!eventTitle || eventTitle.length < 3) continue;

    // Extract currency from title (e.g. "USD Nonfarm Payrolls")
    const currMatch = eventTitle.match(/^(USD|EUR|GBP|JPY|AUD|CAD|CHF|NZD|CNY)\b/i);
    const currency = currMatch ? currMatch[1].toUpperCase() : '';
    if (!currency) continue;

    // Extract date/time
    const dateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
    let eventDate = todayStr, eventTime = '08:30';
    if (dateMatch?.[1]) {
      try {
        const d = new Date(dateMatch[1].trim());
        if (!isNaN(d.getTime())) {
          eventDate = d.toISOString().split('T')[0];
          eventTime = d.toISOString().substring(11, 16);
        }
      } catch {}
    }

    // Extract description for impact
    const descMatch = itemXml.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i)
      || itemXml.match(/<description>([\s\S]*?)<\/description>/i);
    const desc = descMatch?.[1]?.trim() || '';

    const impact: 'high' | 'medium' | 'low' =
      /\b(high|critical|3)\b/i.test(desc) || /\bhigh\s*impact\b/i.test(eventTitle) ? 'high' :
      /\b(medium|moderate|2)\b/i.test(desc) ? 'medium' : 'low';

    const dedupeKey = currency + '-' + eventDate + '-' + eventTitle.substring(0, 30);
    if (events.some(e => (e.currency + '-' + e.date + '-' + e.event.substring(0, 30)) === dedupeKey)) continue;

    events.push({
      id: 'ff-' + events.length + '-' + currency + '-' + eventDate,
      date: eventDate, time: eventTime,
      dateTime: buildDateTime(eventDate, eventTime),
      currency, impact, event: eventTitle,
      forecast: '', previous: '',
    });
  }

  if (events.length === 0) throw new Error('No events parsed from ForexFactory RSS');
  console.log('[EconCalendar] ForexFactory: ' + events.length + ' events');
  return sortEvents(events);
}

// ─── 6. Web Search via DuckDuckGo (CF Workers compatible) ──────────────────
async function fetchWebSearchCalendar(): Promise<CalendarEvent[]> {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const query = `NFP nonfarm payrolls CPI FOMC ISM PMI economic data release this week ${dateStr} USD EUR GBP`;

  const currencyKeywords: Record<string, string[]> = {
    USD: ['us ', 'united states', 'usd', 'nonfarm', 'nfp', 'fomc', 'fed ', 'federal reserve', 'jobless claims', 'us cpi', 'us gdp', 'us retail', 'us pmi', 'us housing', 'us durable', 'ism', 'adp employment', 'us payrolls', 'unemployment rate'],
    EUR: ['euro', 'eur', 'ecb', 'german', 'eurozone', 'eu pmi', 'eu cpi', 'eu gdp', 'ez cpi'],
    GBP: ['pound', 'sterling', 'gbp', 'boe', 'bank of england', 'uk gdp', 'uk cpi', 'uk retail', 'uk pmi'],
    JPY: ['yen', 'jpy', 'boj', 'bank of japan', 'japan cpi', 'japan gdp', 'japan pmi'],
    AUD: ['australian dollar', 'aud', 'rba', 'reserve bank of australia', 'au pmi', 'au cpi'],
    CAD: ['canadian dollar', 'cad', 'boc', 'bank of canada', 'ca retail', 'ca gdp'],
    CHF: ['swiss franc', 'chf', 'snb', 'swiss national bank'],
    NZD: ['new zealand', 'nzd', 'rbnz', 'nz gdp'],
    CNY: ['yuan', 'cny', 'pboc', 'china pmi', 'china gdp'],
  };
  const highImpactKeywords = ['nfp', 'nonfarm', 'non-farm', 'fomc', 'fed rate', 'interest rate decision', 'cpi', 'gdp', 'rate decision', 'payrolls', 'jobless claims', 'unemployment rate'];
  const mediumImpactKeywords = ['pmi', 'retail sales', 'ppi', 'housing', 'consumer confidence', 'industrial production', 'trade balance', 'consumer price'];

  function parseSearchResultsToEvents(results: { name?: string; snippet?: string; url?: string; date?: string }[]): CalendarEvent[] {
    const events: CalendarEvent[] = [];

    for (const r of results) {
      if (!r.name && !r.snippet) continue;
      const text = `${r.name} ${r.snippet}`.toLowerCase();

      let currency = '';
      for (const [curr, keywords] of Object.entries(currencyKeywords)) {
        for (const kw of keywords) {
          if (text.includes(kw)) { currency = curr; break; }
        }
        if (currency) break;
      }
      if (!currency) {
        const currMatch = r.name?.match(/\b(USD|EUR|GBP|JPY|AUD|CAD|CHF|NZD|CNY)\b/i);
        if (currMatch) currency = currMatch[1].toUpperCase();
      }
      if (!currency) continue;

      let impact: 'high' | 'medium' | 'low' = 'low';
      for (const kw of highImpactKeywords) { if (text.includes(kw)) { impact = 'high'; break; } }
      if (impact === 'low') { for (const kw of mediumImpactKeywords) { if (text.includes(kw)) { impact = 'medium'; break; } } }

      let eventTitle = (r.name || 'Economic Event')
        .replace(/\s*[-|–—]\s*(Forex Factory|Investing\.com|FXStreet|Trading Economics|Myfxbook|XTB|ActionForex|MarketWatch|BeInCrypto|GoMarkets|TradingCharts|Mitrade|YouTube|Facebook|BLS\.gov|Bloomberg|Forex\.com|Reuters|IG|Tickmill|LeapRate|Lirunex|CBCX Markets|RCG Markets).*$/i, '')
        .replace(/\s*\(\d{2}\.\d{2}\.\d{4}\)\s*/g, '')
        .trim();

      if (eventTitle.toLowerCase().includes('economic calendar') && r.snippet) {
        const eventPatterns = [/(?:Nonfarm|Non-farm|NFP)\s+Payrolls/i, /Unemployment\s+Rate/i, /(?:CPI|Consumer\s+Price\s+Index)/i, /(?:PMI|Purchasing\s+Managers\s+Index)/i, /(?:GDP|Gross\s+Domestic\s+Product)/i, /Retail\s+Sales/i, /Jobless\s+Claims/i, /ISM\s+Manufacturing/i, /FOMC/i];
        for (const pattern of eventPatterns) { const match = r.snippet.match(pattern); if (match) { eventTitle = match[0]; break; } }
      }
      if (eventTitle.toLowerCase() === 'economic calendar' || eventTitle.length < 5) continue;

      let eventDate = todayStr;
      let eventTime = '08:30';
      const timeMatch = text.match(/(\d{1,2}:\d{2})\s*(am|pm|gmt|utc|et|est)?/i);
      if (timeMatch) {
        eventTime = timeMatch[1];
        if (timeMatch[2]?.toLowerCase() === 'pm' && !eventTime.startsWith('12')) {
          const [h, m] = eventTime.split(':');
          eventTime = `${Number(h) + 12}:${m}`;
        }
      }

      const normalizedTitle = eventTitle
        .replace(/non-?farm\s+payrolls?s?/i, 'NFP')
        .replace(/unemployment\s+rate/i, 'Unemployment Rate')
        .replace(/consumer\s+price\s+index/i, 'CPI')
        .replace(/purchasing\s+managers'??\s+index/i, 'PMI')
        .replace(/gross\s+domestic\s+product/i, 'GDP')
        .replace(/federal\s+open\s+market\s+committee/i, 'FOMC')
        .substring(0, 30);
      const dedupeKey = currency + '-' + eventDate + '-' + normalizedTitle;
      if (events.some(e => (e.currency + '-' + e.date + '-' + e.event.substring(0, 30)) === dedupeKey)) continue;

      events.push({
        id: 'ws-' + events.length + '-' + currency + '-' + eventDate,
        date: eventDate, time: eventTime,
        dateTime: buildDateTime(eventDate, eventTime),
        currency, impact, event: eventTitle, forecast: '', previous: '',
      });
    }
    return sortEvents(events);
  }

  // DuckDuckGo HTML search (works in CF Workers/Edge via fetch)
  try {
    console.log('[EconCalendar] Trying DuckDuckGo search for economic calendar...');
    const ddgResp = await fetch('https://lite.duckduckgo.com/lite/?q=' + encodeURIComponent(query), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(10000),
      redirect: 'follow',
    });

    if (ddgResp.ok) {
      const html = await ddgResp.text();
      const linkRegex = /<a[^>]*class="result-link"[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi;
      const snippetRegex = /<td[^>]*class="result-snippet"[^>]*>(.*?)<\/td>/gi;
      const ddgResults: { name: string; snippet: string; url: string }[] = [];

      let linkMatch;
      let idx = 0;
      while ((linkMatch = linkRegex.exec(html)) !== null && idx < 15) {
        const url = linkMatch[1];
        const titleRaw = linkMatch[2].replace(/<[^>]*>/g, '').trim();
        if (!url.startsWith('http') || !titleRaw) continue;
        const snippetMatch = snippetRegex.exec(html);
        const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]*>/g, '').trim() : '';
        ddgResults.push({ name: titleRaw, snippet, url });
        idx++;
      }

      if (ddgResults.length > 0) {
        const events = parseSearchResultsToEvents(ddgResults);
        if (events.length > 0) {
          console.log('[EconCalendar] DuckDuckGo search: ' + events.length + ' events');
          return events;
        }
      }
    }
  } catch (err: any) {
    console.error('[EconCalendar] DuckDuckGo search failed: ' + err.message);
  }

  console.warn('[EconCalendar] Web search failed');
  return [];
}

// ─── 6. Fallback Calendar (guaranteed, no API needed) ─────────────────────
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

  console.log('[EconCalendar] Fallback: ' + events.length + ' events');
  return sortEvents(events);
}


// ─── Gemini + Google Search grounding (LIVE fallback, CF Workers-safe) ────
// Pure REST call to generativelanguage.googleapis.com — no SDK, no fs, no readFile.
// Replaces the old z-ai-web-dev-sdk provider whose create() crashed on Workers.
async function fetchGeminiCalendar(): Promise<CalendarEvent[]> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  const weekStart = fmt(new Date(today.getTime() - 1 * 86400000));
  const weekEnd = fmt(new Date(today.getTime() + 6 * 86400000));

  const prompt =
    `Search the web for the forex economic calendar for ${weekStart} to ${weekEnd} (this week).\n` +
    `Return ONLY a valid JSON array (no markdown fences, no explanation) of HIGH and MEDIUM impact events for currencies: USD, EUR, GBP, JPY, AUD, CAD, CHF, NZD, CNY.\n` +
    `Each element must be exactly: {"date":"YYYY-MM-DD","time":"HH:mm","currency":"USD","impact":"high","event":"Event Name","forecast":"", "previous":""}\n` +
    `impact is one of: high, medium, low.\n` +
    `Include key events only: interest rate decisions (FOMC, ECB, BOE, BOJ, RBA, BOC, SNB, RBNZ), CPI, NFP/nonfarm payrolls, GDP, PMI, retail sales, unemployment rate, jobless claims, PPI, trade balance.\n` +
    `Use "" (empty string) for unknown fields. Maximum 40 events, sorted by date.\n` +
    `Return the JSON array only.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        tools: [{ googleSearch: {} }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192,
        },
      }),
      signal: AbortSignal.timeout(25000),
    }
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini API ${res.status}: ${errText.slice(0, 120)}`);
  }

  const data = await res.json();
  const text: string = (data?.candidates?.[0]?.content?.parts || [])
    .map((p: { text?: string }) => p.text || '')
    .join('');
  if (!text.trim()) throw new Error('Gemini returned empty response');

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('No JSON array in Gemini response');
  const rawEvents = JSON.parse(jsonMatch[0]) as Array<{
    date?: string; time?: string; currency?: string;
    impact?: string; event?: string; forecast?: string; previous?: string;
  }>;
  if (!Array.isArray(rawEvents) || rawEvents.length === 0) throw new Error('Gemini returned empty event list');

  const VALID_CURRENCIES = new Set(['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD', 'CNY']);
  const todayStr = fmt(today);
  const events: CalendarEvent[] = [];

  for (const raw of rawEvents) {
    const date = (raw.date || '').slice(0, 10);
    const currency = (raw.currency || '').toUpperCase();
    const eventName = (raw.event || '').trim().slice(0, 80);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (!VALID_CURRENCIES.has(currency)) continue;
    if (!eventName) continue;
    const impact = ['high', 'medium', 'low'].includes((raw.impact || '').toLowerCase())
      ? (raw.impact!.toLowerCase() as 'high' | 'medium' | 'low')
      : 'medium';
    events.push({
      id: `gm-${events.length}-${currency}-${date}`,
      date,
      time: raw.time || '',
      dateTime: buildDateTime(date, raw.time || ''),
      currency,
      impact,
      event: eventName,
      forecast: raw.forecast || '',
      previous: raw.previous || '',
    });
  }

  if (events.length === 0) throw new Error('Gemini events failed validation');

  const seen = new Set<string>();
  const deduped = events.filter(e => {
    const key = e.currency + '-' + e.date + '-' + e.event.substring(0, 30);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`[EconCalendar] Gemini grounding: ${deduped.length} events (today=${todayStr}, from ${events.length} before dedup)`);
  return sortEvents(deduped);
}

// ─── Cascade: Faireconomy first (free + reliable), then APIs, web search, fallback last ─
async function fetchCalendarEvents(): Promise<{ events: CalendarEvent[]; source: string; unavailable: boolean }> {
  const errors: string[] = [];
  const collectedEvents: CalendarEvent[] = [];
  let primarySource = '';

  // Log API key availability at start of cascade
  const fhKey = await getFinnhubKey();
  const rapKey = await getRapidApiKey();
  const fcsKey = await getFcsApiKey();
  console.log(`[EconCalendar] API keys: Finnhub=${fhKey ? 'YES' : 'NO'}, RapidAPI=${rapKey ? 'YES' : 'NO'}, FCSAPI=${fcsKey ? 'YES' : 'NO'}`);

  // 0. Faireconomy.media / ForexFactory JSON (BEST — free, no key, works from CF Workers with Referer header)
  try {
    const feEvents = await fetchFaireconomyCalendar();
    if (feEvents.length > 0) {
      primarySource = 'ForexFactory/Faireconomy (Live)';
      collectedEvents.push(...feEvents);
      console.log(`[EconCalendar] Faireconomy: ${feEvents.length} events collected`);
    }
  } catch (err: any) {
    errors.push('Faireconomy: ' + err.message);
    console.error('[EconCalendar] Faireconomy failed:', err.message);
  }

  // If Faireconomy gave us good data, we can return early — no need to hit other APIs
  if (collectedEvents.length >= 15) {
    const seen = new Set<string>();
    const deduped = collectedEvents.filter(e => {
      const key = e.currency + '-' + e.date + '-' + e.event.substring(0, 30);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    console.log(`[EconCalendar] Early return: ${deduped.length} events from Faireconomy (sufficient)`);
    return { events: sortEvents(deduped), source: primarySource || 'ForexFactory/Faireconomy (Live)', unavailable: false };
  }

  // 1. Gemini + Google Search grounding — LIVE fallback (pure HTTPS, CF Workers-safe).
  //    Replaces z-ai-web-dev-sdk (its create() calls readFile → crashes on Workers).
  //    Only used when Faireconomy gave insufficient data (<15 events → no early return above).
  try {
    const gmEvents = await fetchGeminiCalendar();
    if (gmEvents.length > 0) {
      if (!primarySource) primarySource = 'Gemini + Google Search (Live)';
      collectedEvents.push(...gmEvents);
      console.log(`[EconCalendar] Gemini: ${gmEvents.length} events, total now ${collectedEvents.length}`);
    }
  } catch (err: any) {
    errors.push('Gemini: ' + err.message);
    console.warn('[EconCalendar] Gemini grounding failed:', err.message);
  }

  // 2. TradingEconomics Calendar (RapidAPI) — SKIPPED
  // RapidAPI removed/disabled the /calendar endpoint on tradingeconomics.p.rapidapi.com
  // (returns 404 {"message":"API doesn't exists"} even with a valid key, verified Nov 2025).
  // The direct api.tradingeconomics.com guest:guest access is also dead (410 Gone).
  // if (rapKey) {
  //   try {
  //     const events = await fetchTECalendar();
  //     if (events.length > 0) {
  //       if (!primarySource) primarySource = 'TradingEconomics (Live)';
  //       collectedEvents.push(...events);
  //       console.log(`[EconCalendar] TradingEconomics: ${events.length} events, total now ${collectedEvents.length}`);
  //     }
  //   } catch (err: any) {
  //     errors.push('TE: ' + err.message);
  //     console.error('[EconCalendar] TradingEconomics failed:', err.message);
  //   }
  // }
  console.log('[EconCalendar] Skipping TradingEconomics (RapidAPI endpoint removed — 404)');

  // 3. Finnhub — SKIPPED (returns 403 from CF Workers IPs on free tier)
  // if (fhKey) {
  //   try {
  //     const events = await fetchFinnhubCalendar();
  //     if (events.length > 0) {
  //       if (!primarySource) primarySource = 'Finnhub (Live)';
  //       collectedEvents.push(...events);
  //       console.log(`[EconCalendar] Finnhub: ${events.length} events, total now ${collectedEvents.length}`);
  //     }
  //   } catch (err: any) {
  //     errors.push('Finnhub: ' + err.message);
  //     console.error('[EconCalendar] Finnhub failed:', err.message);
  //   }
  // }
  console.log('[EconCalendar] Skipping Finnhub (403 from CF Workers)');

  // 4. FCSAPI — SKIPPED (dead endpoint, returns 404)
  // if (fcsKey) {
  //   try {
  //     const events = await fetchFcsApiCalendar();
  //     if (events.length > 0) {
  //       if (!primarySource) primarySource = 'FCSAPI (Live)';
  //       collectedEvents.push(...events);
  //       console.log(`[EconCalendar] FCSAPI: ${events.length} events collected`);
  //     }
  //   } catch (err: any) {
  //     errors.push('FCSAPI: ' + err.message);
  //     console.error('[EconCalendar] FCSAPI failed:', err.message);
  //   }
  // }
  console.log('[EconCalendar] Skipping FCSAPI (dead endpoint, 404)');

  // 5. MyFXBook RSS — SKIPPED (returns 403/404 from CF Workers)
  // try {
  //   const events = await fetchMyFXBookCalendar();
  //   if (events.length > 0) {
  //     if (!primarySource) primarySource = 'MyFXBook (Live)';
  //     collectedEvents.push(...events);
  //     console.log(`[EconCalendar] MyFXBook: ${events.length} events, total now ${collectedEvents.length}`);
  //   }
  // } catch (err: any) {
  //   errors.push('MyFXBook: ' + err.message);
  //   console.error('[EconCalendar] MyFXBook failed:', err.message);
  // }
  console.log('[EconCalendar] Skipping MyFXBook (403/404 from CF Workers)');

  // 6. ForexFactory RSS — SKIPPED (returns 403 from CF Workers)
  // try {
  //   const events = await fetchForexFactoryCalendar();
  //   if (events.length > 0) {
  //     if (!primarySource) primarySource = 'ForexFactory (Live)';
  //     collectedEvents.push(...events);
  //     console.log(`[EconCalendar] ForexFactory: ${events.length} events, total now ${collectedEvents.length}`);
  //   }
  // } catch (err: any) {
  //   errors.push('ForexFactory: ' + err.message);
  //   console.error('[EconCalendar] ForexFactory failed:', err.message);
  // }
  console.log('[EconCalendar] Skipping ForexFactory RSS (403 from CF Workers)');

  // If we have API data, deduplicate and return
  if (collectedEvents.length > 0) {
    const seen = new Set<string>();
    const deduped = collectedEvents.filter(e => {
      const key = e.currency + '-' + e.date + '-' + e.event.substring(0, 30);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    console.log(`[EconCalendar] Merged ${deduped.length} events from API sources (from ${collectedEvents.length} total)`);
    return { events: sortEvents(deduped), source: primarySource || 'API (Live)', unavailable: false };
  }

  // 7. DuckDuckGo Web Search — SKIPPED (unreliable, CAPTCHA risk from CF Workers)
  // try {
  //   const webSearchEvents = await fetchWebSearchCalendar();
  //   if (webSearchEvents.length > 0) {
  //     return { events: webSearchEvents, source: 'Web Search (Live)', unavailable: false };
  //   }
  // } catch (err: any) {
  //   errors.push('WebSearch: ' + err.message);
  //   console.error('[EconCalendar] Web search failed:', err.message);
  // }
  console.log('[EconCalendar] Skipping DuckDuckGo (CAPTCHA risk)');

  // 8. Fallback (guaranteed, no external call — only used if ALL sources fail)
  console.warn('[EconCalendar] All live APIs and web search failed, using fallback schedule. Errors:', errors.join('; '));
  const events = await fetchFallbackCalendar();
  return { events, source: 'Fallback Schedule (bukan data live)', unavailable: true };
}

// ─── Sample Data Detection ────────────────────────────────────────────────
function isSampleCalendarData(events: CalendarEvent[]): boolean {
  if (events.length === 0) return true;
  const sampleIndicators = ['unavailable', 'sample', 'placeholder', 'lorem ipsum', 'temporarily unavailable'];
  for (const item of events.slice(0, 5)) {
    for (const indicator of sampleIndicators) {
      if (item.event.toLowerCase().includes(indicator)) return true;
    }
    if (item.id && item.id.startsWith('fb-')) return true;
    if (!item.id || !item.id.match(/^(fh-|te-|fcs-|mfb-|ff-|inv-|ws-|gm-|zai-|fb-|fe-)/)) return true;
  }
  return false;
}

// ─── KV Cache helpers ──────────────────────────────────────────────────────
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

    // Detect and invalidate stale sample/placeholder data
    if (isSampleCalendarData(entry.events)) {
      console.warn('[EconCalendar] KV cache contains stale sample data — invalidating');
      try { await kv.delete('economic_calendar_cache'); } catch {}
      return null;
    }

    // Serve fallback data from cache too — it's better than empty!
    // Only skip if cache is completely stale (older than 30 min for fallback)
    if (entry.unavailable === true && Date.now() - entry.timestamp > CACHE_DURATION_RATE_LIMITED) {
      console.warn('[EconCalendar] KV cache fallback data is stale (>30min) — invalidating');
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
  } catch { /* KV not available */ }
}

// ─── Last-Good KV Cache (outage rescue) ─────────────────────────────────────
// Written on every successful live fetch with a 7-day TTL. Read only when ALL
// live sources fail — serves real (slightly old) data instead of the synthetic
// fallback schedule. Kept separate from the short-term cache key so a long
// outage can never evict the rescue copy.
async function setLastGoodKVCache(entry: CacheEntry): Promise<void> {
  try {
    if (entry.unavailable === true || isSampleCalendarData(entry.events)) return;
    let kv: any = null;
    try {
      const { getCloudflareContext } = await import('@opennextjs/cloudflare');
      const ctx = getCloudflareContext();
      kv = (ctx as any)?.env?.luxtradee_kv;
    } catch {}
    if (!kv) return;
    await kv.put(LASTGOOD_KV_KEY, JSON.stringify(entry), { expirationTtl: LASTGOOD_KV_TTL_SECONDS });
  } catch { /* KV not available */ }
}

async function getLastGoodKVCache(): Promise<CacheEntry | null> {
  try {
    let kv: any = null;
    try {
      const { getCloudflareContext } = await import('@opennextjs/cloudflare');
      const ctx = getCloudflareContext();
      kv = (ctx as any)?.env?.luxtradee_kv;
    } catch {}
    if (!kv) return null;
    const raw = await kv.get(LASTGOOD_KV_KEY, 'text');
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    // Only trust real live data
    if (entry.unavailable === true) return null;
    if (isSampleCalendarData(entry.events)) return null;
    if (!entry.events || entry.events.length === 0) return null;
    return entry;
  } catch { return null; }
}

/** Build a 200 response from the last-good KV cache, or null if unavailable. */
async function buildLastGoodResponse(
  impactFilter: string | null,
  currencyFilter: string | null,
  timezone: string | null,
  serverTime: string
): Promise<NextResponse | null> {
  try {
    const lastGood = await getLastGoodKVCache();
    if (!lastGood) return null;
    let events = lastGood.events;
    if (impactFilter) events = events.filter(e => e.impact === impactFilter);
    if (currencyFilter) events = events.filter(e => e.currency === currencyFilter);
    if (events.length === 0) events = lastGood.events; // never return empty just because of filters
    console.warn(`[EconCalendar] All live sources failed — serving last-good KV cache from ${new Date(lastGood.timestamp).toISOString()} (${lastGood.events.length} events)`);
    return NextResponse.json({
      success: true, cached: true, stale: true, cacheSource: 'kv-lastgood',
      events,
      totalAvailable: lastGood.events.length,
      source: lastGood.source + ' (cached)',
      fetchedAt: new Date(lastGood.timestamp).toISOString(),
      now: serverTime, timezone: timezone || null,
      unavailable: false,
      message: 'Live sources temporarily unavailable — showing saved calendar data (may be a few hours old).',
    });
  } catch { return null; }
}

// ─── GET Handler ────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  // Reset env cache for each request
  _envCache = null;

  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get('refresh') === 'true' || searchParams.get('forceRefresh') === 'true';
  const impactFilter = searchParams.get('impact');
  const currencyFilter = searchParams.get('currency');
  const timezone = searchParams.get('tz');
  const now = new Date();
  const serverTime = now.toISOString();

  // Debug mode: return API key availability without making API calls
  if (searchParams.get('debug') === 'true') {
    const fhKey = await getFinnhubKey();
    const rapKey = await getRapidApiKey();
    const fcsKey = await getFcsApiKey();

    // Check direct globalThis access (most reliable in CF Workers)
    let globalThisEnvAvailable = false;
    let globalThisEnvKeys: string[] = [];
    let globalThisCtxDetail: string = 'not set';
    try {
      const sym = Symbol.for('__cloudflare-context__');
      const ctx = (globalThis as any)[sym];
      if (ctx) {
        globalThisCtxDetail = `set, env=${typeof ctx.env}, cf=${typeof ctx.cf}`;
        if (ctx.env) {
          globalThisEnvAvailable = true;
          globalThisEnvKeys = Object.keys(ctx.env).filter(k => !k.startsWith('NEXT_') && k !== 'ASSETS');
          // Check specific secret keys
          const secretKeys = ['FINNHUB_API_KEY', 'RAPIDAPI_KEY', 'RAPIDAPI_TRADING_ECONOMICS_KEY', 'FCSAPI_KEY'];
          for (const k of secretKeys) {
            const v = (ctx.env as any)[k];
            if (v != null) {
              globalThisEnvKeys.push(`✓ ${k} (${String(v).length} chars)`);
            } else {
              globalThisEnvKeys.push(`✗ ${k} = undefined`);
            }
          }
        }
      }
    } catch (e: any) {
      globalThisCtxDetail = `error: ${e?.message}`;
    }

    // Check getCloudflareContext()
    let cfContextAvailable = false;
    let cfEnvKeys: string[] = [];
    let cfContextError = '';
    try {
      const { getCloudflareContext } = await import('@opennextjs/cloudflare');
      try {
        const ctx = await getCloudflareContext({ async: true });
        cfContextAvailable = !!ctx?.env;
        if (ctx?.env) cfEnvKeys = Object.keys(ctx.env).filter(k => !k.startsWith('NEXT_') && !k.startsWith('ASSETS') && !k.includes('CACHE'));
      } catch (asyncErr: any) {
        cfContextError = `async: ${asyncErr?.message}`;
      }
      if (!cfContextAvailable) {
        try {
          const ctx = getCloudflareContext();
          cfContextAvailable = !!ctx?.env;
          if (ctx?.env) cfEnvKeys = Object.keys(ctx.env).filter(k => !k.startsWith('NEXT_') && !k.startsWith('ASSETS') && !k.includes('CACHE'));
        } catch (syncErr: any) {
          cfContextError += `; sync: ${syncErr?.message}`;
        }
      }
    } catch (importErr: any) {
      cfContextError = `import: ${importErr?.message}`;
    }

    return NextResponse.json({
      environment: process.env.NODE_ENV || 'unknown',
      directGlobalThisAccess: {
        available: globalThisEnvAvailable,
        ctxDetail: globalThisCtxDetail,
        envKeys: globalThisEnvKeys,
      },
      getCloudflareContext: {
        available: cfContextAvailable,
        envKeys: cfEnvKeys,
        error: cfContextError || undefined,
      },
      apiKeys: {
        FINNHUB_API_KEY: fhKey ? `SET (${fhKey.length} chars, starts: ${fhKey.substring(0, 4)}...)` : 'NOT SET',
        RAPIDAPI_KEY: rapKey ? `SET (${rapKey.length} chars, starts: ${rapKey.substring(0, 4)}...)` : 'NOT SET',
        FCSAPI_KEY: fcsKey ? `SET (${fcsKey.length} chars)` : 'NOT SET',
      },
      geminiGrounding: {
        keyConfigured: !!(
          process.env.GEMINI_API_KEY ||
          (Array.isArray(globalThisEnvKeys) && globalThisEnvKeys.includes('GEMINI_API_KEY'))
        ),
      },
      processEnv: {
        FINNHUB_API_KEY: process.env.FINNHUB_API_KEY ? `exists (${process.env.FINNHUB_API_KEY.length} chars)` : 'undefined',
        RAPIDAPI_KEY: process.env.RAPIDAPI_KEY ? `exists (${process.env.RAPIDAPI_KEY.length} chars)` : 'undefined',
      },
      cacheStatus: {
        inMemory: calendarCache ? `${calendarCache.events.length} events, source: ${calendarCache.source}` : 'empty',
      },
      now: serverTime,
    });
  }

  try {
    // 1. Try KV cache
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

    // 2. Try in-memory cache (serve even fallback data — it's better than empty)
    if (!forceRefresh && calendarCache && Date.now() - calendarCache.timestamp < CACHE_DURATION) {
      if (isSampleCalendarData(calendarCache.events)) {
        console.warn('[EconCalendar] In-memory cache contains stale sample data — invalidating');
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

    // 3. Fetch fresh data (with 20s timeout to avoid hanging)
    let fetchResult: { events: CalendarEvent[]; source: string; unavailable: boolean };
    try {
      fetchResult = await Promise.race([
        fetchCalendarEvents(),
        new Promise<{ events: CalendarEvent[]; source: string; unavailable: boolean }>((resolve) =>
          setTimeout(() => {
            console.warn('[EconCalendar] Cascade timed out after 20s, using fallback');
            fetchFallbackCalendar().then(events =>
              resolve({ events, source: 'Fallback Schedule (timeout)', unavailable: true })
            );
          }, 20000)
        ),
      ]);
    } catch (err: any) {
      console.error('[EconCalendar] Cascade error:', err.message);
      const fallbackEvents = await fetchFallbackCalendar();
      fetchResult = { events: fallbackEvents, source: 'Fallback Schedule (error)', unavailable: true };
    }
    const { events: allEvents, source, unavailable } = fetchResult;

    const cacheTTL = (unavailable && allEvents.length === 0) ? 60 * 1000 : CACHE_DURATION;
    const newCache: CacheEntry = { events: allEvents, timestamp: Date.now(), source, unavailable };

    // Only cache live (non-fallback) data to prevent stale fallback from being served
    if (unavailable) {
      console.warn('[EconCalendar] Not caching fallback/unavailable data to prevent stale cache');
      calendarCache = null; // Clear in-memory cache of any previous fallback too
      // Don't write fallback to KV — let next request try live sources again

      // Outage rescue: serve the last-known-good live data from KV (up to 7 days
      // old) instead of the synthetic fallback schedule.
      const rescued = await buildLastGoodResponse(impactFilter, currencyFilter, timezone || null, serverTime);
      if (rescued) return rescued;
    } else {
      calendarCache = newCache;
      await setKVCache(newCache, cacheTTL);
      // Persist a long-lived rescue copy (7-day TTL) for future outages
      await setLastGoodKVCache(newCache);
    }

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

    // Return cached data if available
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

    // Outage rescue via last-good KV before dropping to the synthetic schedule
    const rescued = await buildLastGoodResponse(impactFilter, currencyFilter, timezone || null, serverTime);
    if (rescued) return rescued;

    // NEVER return 500 — always 200 with fallback data
    const fallbackEvents = await fetchFallbackCalendar();
    return NextResponse.json({
      success: true, cached: false, events: fallbackEvents,
      totalAvailable: fallbackEvents.length, source: 'Fallback Schedule (error)',
      fetchedAt: new Date().toISOString(), now: serverTime,
      timezone: timezone || null, unavailable: true,
      message: 'Live data unavailable, showing estimated schedule.',
    });
  }
}
