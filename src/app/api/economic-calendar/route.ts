import { NextRequest, NextResponse } from 'next/server';

// Lazy accessor for child_process.spawn — not available on Cloudflare Workers
let _spawn: any = undefined; // undefined=not tried, null=unavailable
function getSpawn(): any {
  if (_spawn !== undefined) return _spawn;
  try {
    _spawn = require('child_process').spawn;
  } catch {
    _spawn = null; // CF Workers or other environments without child_process
  }
  return _spawn;
}

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
const CACHE_DURATION = 10 * 60 * 1000; // 10 min
const CACHE_DURATION_RATE_LIMITED = 30 * 60 * 1000; // 30 min when rate limited

// ─── API Key Helpers ────────────────────────────────────────────────────────
// In OpenNext/CF Workers, the init.js template populates process.env from
// the CF env (secrets + [vars]) at request time via populateProcessEnv().
// So process.env.FOO works for both secrets and vars.
// We also try getCloudflareContext().env as a fallback.
let _envCache: Record<string, string> | null = null;

/** Known placeholder values that should NOT be treated as real API keys */
const PLACEHOLDER_PATTERNS = [
  'your_', 'xxx', 'sk-or-', 'sk-your', 'hf_your',
  're_xxxxxxxxxx', 'BNTL6FFlf', // literal public keys/placeholder patterns
];

function isPlaceholder(value: string): boolean {
  if (!value || value.length < 8) return true; // Real API keys are always 8+ chars
  const lower = value.toLowerCase();
  return PLACEHOLDER_PATTERNS.some(p => lower.startsWith(p));
}

async function getEnvVar(key: string): Promise<string> {
  // 1. process.env — works when OpenNext's populateProcessEnv has run
  const fromProcess = process.env[key];
  if (fromProcess && fromProcess.length > 0 && !isPlaceholder(fromProcess)) {
    return fromProcess;
  }

  // 2. getCloudflareContext().env — works in CF Workers edge runtime
  //    Try both sync and async variants for maximum compatibility
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    // Try async variant first (more reliable in some OpenNext versions)
    try {
      const ctx = await getCloudflareContext({ async: true });
      const fromCtx = ctx?.env?.[key];
      if (fromCtx && typeof fromCtx === 'string' && fromCtx.length > 0 && !isPlaceholder(fromCtx)) {
        return fromCtx;
      }
    } catch {}
    // Fallback to sync variant
    const ctx = getCloudflareContext();
    const fromCtx = ctx?.env?.[key];
    if (fromCtx && typeof fromCtx === 'string' && fromCtx.length > 0 && !isPlaceholder(fromCtx)) {
      return fromCtx;
    }
  } catch {
    // @opennextjs/cloudflare not available (local dev without wrangler)
  }

  return '';
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

// ─── 1. Finnhub Calendar (FREE tier: 60 calls/min) ────────────────────────
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

  console.log('[EconCalendar] Finnhub: ' + events.length + ' events');
  return sortEvents(events);
}

// ─── 2. FCSAPI.com Calendar ────────────────────────────────────────────────
async function fetchFcsApiCalendar(): Promise<CalendarEvent[]> {
  const fcsKey = await getFcsApiKey();
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  // FCSAPI v3 calendar endpoint (economic_calendar was removed, use 'calendar')
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

  console.log('[EconCalendar] FCSAPI: ' + events.length + ' events');
  return sortEvents(events);
}

// ─── 3. MyFXBook Calendar (FREE, no API key) ──────────────────────────────
async function fetchMyFXBookCalendar(): Promise<CalendarEvent[]> {
  const todayStr = new Date().toISOString().split('T')[0];
  // MyFXBook community.json was blocked (403); try the RSS feed instead
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

  // Parse RSS/XML feed from MyFXBook
  const xml = await res.text();
  if (!xml.includes('<item') && !xml.includes('<entry')) throw new Error('MyFXBook response is not RSS/XML');

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
          eventTime = d.toISOString().substring(11, 16); // HH:MM
        }
      } catch {}
    }

    // Extract description for impact/actual/forecast
    const descMatch = itemXml.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i)
      || itemXml.match(/<description>([\s\S]*?)<\/description>/i);
    const desc = descMatch?.[1]?.trim() || '';

    // Determine impact from description
    const impact: 'high' | 'medium' | 'low' =
      /\b(high|critical|3)\b/i.test(desc) || /\bhigh\s*impact\b/i.test(eventTitle) ? 'high' :
      /\b(medium|moderate|2)\b/i.test(desc) ? 'medium' : 'low';

    // Try to extract actual/forecast/previous from description
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

// ─── 3b. TradingEconomics Calendar (RapidAPI, same key as news) ──────────────
async function fetchTECalendar(): Promise<CalendarEvent[]> {
  const apiKey = await getRapidApiKey();
  if (!apiKey) throw new Error('No RAPIDAPI_KEY');

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  // Get this week's data
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

  console.log('[EconCalendar] TradingEconomics: ' + events.length + ' events');
  return sortEvents(events);
}

// ─── 3c. Investing.com Calendar via scraping (FREE, no API key) ─────────────
async function fetchInvestingCalendar(): Promise<CalendarEvent[]> {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // Try multiple CORS proxies since allorigins.win is unreliable
  const investingUrl = 'https://www.investing.com/economic-calendar/';
  const proxyUrls = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(investingUrl)}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(investingUrl)}`,
  ];

  let res: Response | null = null;
  for (const proxyUrl of proxyUrls) {
    try {
      const attempt = await fetch(proxyUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          'Accept': 'text/html, application/xhtml+xml, */*;',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(8000),
      });
      if (attempt.ok) { res = attempt; break; }
    } catch { /* try next proxy */ }
  }
  if (!res) throw new Error('All Investing.com proxies failed');

  const html = await res.text();

  // Parse the HTML table for economic events
  const events: CalendarEvent[] = [];
  const currencyMap: Record<string, string> = {
    'USD': 'USD', 'EUR': 'EUR', 'GBP': 'GBP', 'JPY': 'JPY',
    'AUD': 'AUD', 'CAD': 'CAD', 'CHF': 'CHF', 'NZD': 'NZD',
    'CNY': 'CNY', 'KRW': 'KRW',
  };

  // Try to extract event rows from the HTML
  const rowRegex = /<tr[^>]*data-event-id[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;

  while ((rowMatch = rowRegex.exec(html)) !== null && events.length < 80) {
    const rowHtml = rowMatch[1];

    // Extract currency
    const currMatch = rowHtml.match(/class="[^"]*flagCur[^"]*"[^>]*>([A-Z]{3})<\/span>/i)
      || rowHtml.match(/>(USD|EUR|GBP|JPY|AUD|CAD|CHF|NZD)</i);
    const currency = currMatch ? currencyMap[currMatch[1]] || currMatch[1] : '';
    if (!currency) continue;

    // Extract event name
    const nameMatch = rowHtml.match(/class="[^"]*event[^"]*"[^>]*>([^<]+)/i)
      || rowHtml.match(/<td[^>]*>\s*<a[^>]*>([^<]+)/i);
    const eventTitle = nameMatch ? nameMatch[1].trim() : '';
    if (!eventTitle || eventTitle.length < 3) continue;

    // Extract impact
    const highImp = rowHtml.includes('highVol') || rowHtml.includes('highImp') || rowHtml.match(/class="[^"]*sentiment[^"]*bullish[^"]*3/i);
    const medImp = rowHtml.includes('medVol') || rowHtml.includes('medImp') || rowHtml.match(/class="[^"]*sentiment[^"]*bullish[^"]*2/i);
    const impact: 'high' | 'medium' | 'low' = highImp ? 'high' : medImp ? 'medium' : 'low';

    // Extract date/time
    const timeMatch = rowHtml.match(/(\d{2}:\d{2})/);
    const eventTime = timeMatch ? timeMatch[1] : '08:30';

    // Extract actual/forecast/previous
    const tdValues: string[] = [];
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let tdMatch;
    while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
      const val = tdMatch[1].replace(/<[^>]*>/g, '').trim();
      tdValues.push(val);
    }

    const dedupeKey = currency + '-' + todayStr + '-' + eventTitle.substring(0, 30);
    if (events.some(e => (e.currency + '-' + e.date + '-' + e.event.substring(0, 30)) === dedupeKey)) continue;

    events.push({
      id: 'inv-' + events.length + '-' + currency + '-' + todayStr,
      date: todayStr, time: eventTime,
      dateTime: buildDateTime(todayStr, eventTime),
      currency, impact, event: eventTitle,
      actual: tdValues[0] || undefined,
      forecast: tdValues[1] || '',
      previous: tdValues[2] || '',
    });
  }

  if (events.length === 0) throw new Error('No events parsed from Investing.com');
  console.log('[EconCalendar] Investing.com: ' + events.length + ' events');
  return sortEvents(events);
}

// ─── 5. Web Search Calendar (z-ai-web-dev-sdk) ────────────────────────────

interface WebSearchResult {
  url: string;
  name: string;
  snippet: string;
  host_name: string;
  date: string;
}

/**
 * Fetch real-time economic calendar data via z-ai-web-dev-sdk web-search.
 * Searches for current/upcoming high-impact economic events and parses them
 * into CalendarEvent format.
 */
async function fetchWebSearchCalendar(): Promise<CalendarEvent[]> {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const query = `NFP nonfarm payrolls CPI FOMC ISM PMI economic data release this week ${dateStr} USD EUR GBP`;

  // Currency detection from text
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

  // Helper to parse web search results into calendar events
  function parseSearchResultsToEvents(results: { name?: string; snippet?: string; url?: string; date?: string }[]): CalendarEvent[] {
    const events: CalendarEvent[] = [];

    for (const r of results) {
      if (!r.name && !r.snippet) continue;
      const text = `${r.name} ${r.snippet}`.toLowerCase();

      // Detect currency
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

      // Detect impact
      let impact: 'high' | 'medium' | 'low' = 'low';
      for (const kw of highImpactKeywords) { if (text.includes(kw)) { impact = 'high'; break; } }
      if (impact === 'low') { for (const kw of mediumImpactKeywords) { if (text.includes(kw)) { impact = 'medium'; break; } } }

      // Extract event name
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
        if (timeMatch[2]?.toLowerCase() === 'pm' && !eventTime.startsWith('12')) { const [h, m] = eventTime.split(':'); eventTime = `${Number(h) + 12}:${m}`; }
      }

      const normalizedTitle = eventTitle.replace(/non-?farm\s+payrolls?s?/i, 'NFP').replace(/unemployment\s+rate/i, 'Unemployment Rate').replace(/consumer\s+price\s+index/i, 'CPI').replace(/purchasing\s+managers'??\s+index/i, 'PMI').replace(/gross\s+domestic\s+product/i, 'GDP').replace(/federal\s+open\s+market\s+committee/i, 'FOMC').substring(0, 30);
      const dedupeKey = currency + '-' + eventDate + '-' + normalizedTitle;
      if (events.some(e => (e.currency + '-' + e.date + '-' + e.event.substring(0, 30)) === dedupeKey)) continue;

      events.push({ id: 'ws-' + events.length + '-' + currency + '-' + eventDate, date: eventDate, time: eventTime, dateTime: buildDateTime(eventDate, eventTime), currency, impact, event: eventTitle, forecast: '', previous: '' });
    }
    return sortEvents(events);
  }

  // Strategy 1: z-ai-web-dev-sdk CLI (Node.js only)
  try {
    const spawnFn = getSpawn();
    if (spawnFn) {
      console.log('[EconCalendar] Invoking z-ai-web-dev-sdk web-search...');
      const argsJson = JSON.stringify({ query, num: 15 });
      const result = await new Promise<string>((resolve, reject) => {
        const proc = spawnFn('npx', ['z-ai-web-dev-sdk', 'function', '--name', 'web_search', '--args', argsJson], { timeout: 15000 });
        let stdout = ''; let stderr = '';
        proc.stdout.on('data', (d) => { stdout += d; });
        proc.stderr.on('data', (d) => { stderr += d; });
        proc.on('close', (code) => { if (code === 0) resolve(stdout); else reject(new Error(`Exit code ${code}: ${stderr.slice(0, 200)}`)); });
        proc.on('error', reject);
      });

      let jsonStr = ''; let inArray = false; let bracketDepth = 0;
      for (const line of result.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.includes('🚀') || trimmed.includes('🎉')) continue;
        if (!inArray && trimmed.startsWith('[')) { inArray = true; jsonStr = trimmed; bracketDepth = (trimmed.match(/\[/g) || []).length - (trimmed.match(/\]/g) || []).length; if (bracketDepth === 0) break; continue; }
        if (inArray) { jsonStr += '\n' + line; bracketDepth += (line.match(/\[/g) || []).length - (line.match(/\]/g) || []).length; if (bracketDepth <= 0) break; }
      }

      if (jsonStr) {
        const data = JSON.parse(jsonStr) as WebSearchResult[];
        if (Array.isArray(data) && data.length > 0) {
          const events = parseSearchResultsToEvents(data);
          if (events.length > 0) {
            console.log('[EconCalendar] Web search (CLI): ' + events.length + ' events');
            return events;
          }
        }
      }
    }
  } catch (err: any) {
    console.error('[EconCalendar] Web search CLI failed: ' + err.message);
  }

  // Strategy 2: DuckDuckGo HTML search (works in CF Workers/Edge via fetch)
  try {
    console.log('[EconCalendar] Trying DuckDuckGo search as edge-compatible fallback...');
    const ddgResp = await fetch('https://lite.duckduckgo.com/lite/?q=' + encodeURIComponent(query), {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36', 'Accept': 'text/html' },
      signal: AbortSignal.timeout(10000),
      redirect: 'follow',
    });

    if (ddgResp.ok) {
      const html = await ddgResp.text();
      const linkRegex = /<a[^>]*class="result-link"[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi;
      const snippetRegex = /<td[^>]*class="result-snippet"[^>]*>(.*?)<\/td>/gi;
      const ddgResults: { name: string; snippet: string; url: string }[] = [];

      let linkMatch; let idx = 0;
      while ((linkMatch = linkRegex.exec(html)) !== null && idx < 15) {
        const url = linkMatch[1]; const titleRaw = linkMatch[2].replace(/<[^>]*>/g, '').trim();
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

  console.warn('[EconCalendar] All web search strategies failed');
  return [];
}

// ─── 4. Fallback Calendar (guaranteed, no API needed) ─────────────────────
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

// ─── Cascade: Real APIs first, web search, fallback last ──────────────────
async function fetchCalendarEvents(): Promise<{ events: CalendarEvent[]; source: string; unavailable: boolean }> {
  const errors: string[] = [];

  // Log API key availability at start of cascade
  const fhKey = await getFinnhubKey();
  const rapKey = await getRapidApiKey();
  console.log(`[EconCalendar] API keys available: Finnhub=${fhKey ? 'YES(' + fhKey.substring(0, 6) + '...)' : 'NO'}, RapidAPI=${rapKey ? 'YES(' + rapKey.substring(0, 6) + '...)' : 'NO'}`);

  // 1. Finnhub (FREE tier: 60 calls/min)
  if (fhKey) {
    try {
      const events = await fetchFinnhubCalendar();
      if (events.length > 0) return { events, source: 'Finnhub (Live)', unavailable: false };
    } catch (err: any) {
      errors.push('Finnhub: ' + err.message);
      console.error('[EconCalendar] Finnhub failed:', err.message);
    }
  } else {
    console.info('[EconCalendar] FINNHUB_API_KEY not set, skipping');
  }

  // 2. TradingEconomics Calendar (RapidAPI)
  if (rapKey) {
    try {
      const events = await fetchTECalendar();
      if (events.length > 0) return { events, source: 'TradingEconomics (Live)', unavailable: false };
    } catch (err: any) {
      errors.push('TE: ' + err.message);
      console.error('[EconCalendar] TradingEconomics failed:', err.message);
    }
  } else {
    console.info('[EconCalendar] RAPIDAPI_KEY not set, skipping');
  }

  // 3. Web Search via z-ai-web-dev-sdk (real-time economic calendar data)
  try {
    const webSearchEvents = await fetchWebSearchCalendar();
    if (webSearchEvents.length > 0) {
      return { events: webSearchEvents, source: 'Web Search (Live)', unavailable: false };
    }
  } catch (err: any) {
    errors.push('WebSearch: ' + err.message);
    console.error('[EconCalendar] Web search failed:', err.message);
  }

  // 3. Investing.com calendar (free, via CORS proxy — skip by default, very slow)
  // Skip Investing.com scraping — the CORS proxy is unreliable and adds 12s+ latency.
  // If a reliable proxy becomes available, re-enable this.

  // 4. FCSAPI (dead endpoint — skip, saves 8s timeout)
  // FCSAPI v3 /economic_calendar endpoint returns 404. Skip to avoid timeout.

  // 5. MyFXBook (blocked 403 — skip, saves 8s timeout)
  // MyFXBook calendar.community.json returns 403. Skip to avoid timeout.

  // 6. Fallback (guaranteed, no external call)
  console.warn('[EconCalendar] All live APIs and web search failed, using fallback schedule. Errors:', errors.join('; '));
  const events = await fetchFallbackCalendar();
  return { events, source: 'Fallback Schedule (bukan data live)', unavailable: true };
}

// ─── Sample Data Detection ────────────────────────────────────────────────

/**
 * Detect if cached calendar events are stale sample/placeholder data.
 * This catches old cached data that was generated when all sources failed.
 */
function isSampleCalendarData(events: CalendarEvent[]): boolean {
  if (events.length === 0) return true; // Empty = came from "all sources failed" fallback
  // Check for fallback schedule indicators (source contains 'Fallback')
  // and for placeholder patterns in event names
  const sampleIndicators = [
    'unavailable',
    'sample',
    'placeholder',
    'lorem ipsum',
    'temporarily unavailable',
  ];
  for (const item of events.slice(0, 5)) { // Check first 5 items
    for (const indicator of sampleIndicators) {
      if (item.event.toLowerCase().includes(indicator)) return true;
    }
    // fb- prefix = hardcoded fallback data (not live API data)
    // Live API data has prefixes: fh- (Finnhub), te- (TradingEconomics),
    // ws- (Web Search), inv- (Investing.com)
    if (item.id && item.id.startsWith('fb-')) return true;
    // Events with no id prefix at all are likely from a broken fallback
    if (!item.id || !item.id.match(/^(fh-|te-|fcs-|mfb-|inv-|ws-|fb-)/)) return true;
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

    // Also invalidate if source indicates fallback data
    if (entry.source && (entry.source.includes('Fallback') || entry.unavailable === true)) {
      console.warn('[EconCalendar] KV cache contains fallback data (source: ' + entry.source + ') — invalidating');
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
    // Also check if CF context is available
    let cfContextAvailable = false;
    let cfEnvKeys: string[] = [];
    try {
      const { getCloudflareContext } = await import('@opennextjs/cloudflare');
      try {
        const ctx = await getCloudflareContext({ async: true });
        cfContextAvailable = !!ctx?.env;
        if (ctx?.env) cfEnvKeys = Object.keys(ctx.env).filter(k => !k.startsWith('NEXT_') && !k.startsWith('ASSETS') && !k.includes('CACHE'));
      } catch {}
      if (!cfContextAvailable) {
        const ctx = getCloudflareContext();
        cfContextAvailable = !!ctx?.env;
        if (ctx?.env) cfEnvKeys = Object.keys(ctx.env).filter(k => !k.startsWith('NEXT_') && !k.startsWith('ASSETS') && !k.includes('CACHE'));
      }
    } catch {}
    return NextResponse.json({
      environment: process.env.NODE_ENV || 'unknown',
      cfContextAvailable,
      cfEnvKeys,
      apiKeys: {
        FINNHUB_API_KEY: fhKey ? `SET (${fhKey.length} chars, starts: ${fhKey.substring(0, 4)}...)` : 'NOT SET',
        RAPIDAPI_KEY: rapKey ? `SET (${rapKey.length} chars, starts: ${rapKey.substring(0, 4)}...)` : 'NOT SET',
        FCSAPI_KEY: fcsKey ? `SET (${fcsKey.length} chars)` : 'NOT SET',
        RAPIDAPI_TRADING_ECONOMICS_KEY: (await getEnvVar('RAPIDAPI_TRADING_ECONOMICS_KEY')) ? 'SET' : 'NOT SET',
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

    // 2. Try in-memory cache (also detect stale sample data)
    if (!forceRefresh && calendarCache && Date.now() - calendarCache.timestamp < CACHE_DURATION) {
      // Detect stale sample data in memory cache
      if (isSampleCalendarData(calendarCache.events)) {
        console.warn('[EconCalendar] In-memory cache contains stale sample data — invalidating');
        calendarCache = null;
      } else if (calendarCache.source && (calendarCache.source.includes('Fallback') || calendarCache.unavailable === true)) {
        // Also invalidate if cached data is from fallback
        console.warn('[EconCalendar] In-memory cache contains fallback data — invalidating');
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

    // 3. Fetch fresh data (with 25s timeout to avoid hanging on slow web searches)
    let fetchResult: { events: CalendarEvent[]; source: string; unavailable: boolean };
    try {
      fetchResult = await Promise.race([
        fetchCalendarEvents(),
        new Promise<{ events: CalendarEvent[]; source: string; unavailable: boolean }>((resolve) =>
          setTimeout(() => {
            console.warn('[EconCalendar] Cascade timed out after 25s, using fallback');
            fetchFallbackCalendar().then(events =>
              resolve({ events, source: 'Fallback Schedule (timeout)', unavailable: true })
            );
          }, 25000)
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

    // NEVER return 500 — always 200 with empty array + unavailable flag
    return NextResponse.json({
      success: true, cached: false, events: [],
      totalAvailable: 0, source: 'Unavailable',
      fetchedAt: new Date().toISOString(), now: serverTime,
      timezone: timezone || null, unavailable: true,
      message: 'Calendar data temporarily unavailable. Please try again in a few minutes.',
    });
  }
}
