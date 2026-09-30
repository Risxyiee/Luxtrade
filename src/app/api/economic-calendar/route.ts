import { NextRequest, NextResponse } from 'next/server';

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
// In CF Workers, secrets are on (request).env, not process.env
// We store the request reference so helpers can access CF env
let _cfEnv: any = null;

function getFinnhubKey(): string { return process.env.FINNHUB_API_KEY || _cfEnv?.FINNHUB_API_KEY || ''; }
function getRapidApiKey(): string { return process.env.RAPIDAPI_KEY || _cfEnv?.RAPIDAPI_KEY || process.env.RAPIDAPI_TRADING_ECONOMICS_KEY || _cfEnv?.RAPIDAPI_TRADING_ECONOMICS_KEY || ''; }
function getFcsApiKey(): string { return process.env.FCSAPI_KEY || _cfEnv?.FCSAPI_KEY || ''; }

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
  const apiKey = getFinnhubKey();
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
  const fcsKey = getFcsApiKey();
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const url = fcsKey ? `https://fcsapi.com/api-v3/forex/economic_calendar?date=${dateStr}&key=${fcsKey}` : `https://fcsapi.com/api-v3/forex/economic_calendar?date=${dateStr}`;

  const res = await fetch(url, { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error('FCSAPI returned ' + res.status);

  const json = await res.json();
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
  const res = await fetch('https://www.myfxbook.com/calendar/community.json', {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LuxTradeBot/1.0)', 'Accept': 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error('MyFXBook returned ' + res.status);

  const json = await res.json();
  const rawData = json?.calendarEvents || json?.events || json?.data || json;
  if (!Array.isArray(rawData) || rawData.length === 0) throw new Error('Empty data');

  const events: CalendarEvent[] = [];
  for (const item of rawData) {
    const currency = (item.currency || '').toUpperCase();
    if (!currency || currency.length > 4) continue;
    const impactStr = String(item.impact || item.importance || '').toLowerCase();
    const impact: 'high' | 'medium' | 'low' = impactStr === 'high' || impactStr === '3' ? 'high' : impactStr === 'medium' || impactStr === '2' ? 'medium' : 'low';
    const eventTitle = (item.title || item.event || item.name || 'Economic Event') as string;
    const rawDate = (item.date || item.dateTime || '') as string;
    const dateMatch = String(rawDate).match(/^(\d{4}-\d{2}-\d{2})/);
    const eventDate = dateMatch ? dateMatch[1] : todayStr;
    const rawTime = (item.time || '') as string;
    const timeMatch = String(rawTime).match(/(\d{2}:\d{2})/);
    const eventTime = timeMatch ? timeMatch[1] : '08:30';

    const dedupeKey = currency + '-' + eventDate + '-' + eventTitle.substring(0, 30);
    if (events.some(e => (e.currency + '-' + e.date + '-' + e.event.substring(0, 30)) === dedupeKey)) continue;

    events.push({
      id: 'mfb-' + events.length + '-' + currency + '-' + eventDate,
      date: eventDate, time: eventTime,
      dateTime: buildDateTime(eventDate, eventTime),
      currency, impact, event: eventTitle,
      actual: item.actual != null ? String(item.actual) : undefined,
      forecast: item.forecast != null ? String(item.forecast) : '',
      previous: item.previous != null ? String(item.previous) : '',
    });
  }

  console.log('[EconCalendar] MyFXBook: ' + events.length + ' events');
  return sortEvents(events);
}

// ─── 3b. TradingEconomics Calendar (RapidAPI, same key as news) ──────────────
async function fetchTECalendar(): Promise<CalendarEvent[]> {
  const apiKey = getRapidApiKey();
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

  // Use the allorigins CORS proxy to fetch Investing.com economic calendar
  const investingUrl = 'https://www.investing.com/economic-calendar/';
  const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(investingUrl)}`;

  const res = await fetch(proxyUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LuxTradeBot/1.0)' },
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) throw new Error('Investing proxy returned ' + res.status);

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

// ─── Cascade: Real APIs first, fallback last ──────────────────────────────
async function fetchCalendarEvents(): Promise<{ events: CalendarEvent[]; source: string; unavailable: boolean }> {
  const errors: string[] = [];

  // 1. Finnhub (FREE tier: 60 calls/min)
  if (getFinnhubKey()) {
    try {
      const events = await fetchFinnhubCalendar();
      if (events.length > 0) return { events, source: 'Finnhub (Live)', unavailable: false };
    } catch (err: any) {
      errors.push('Finnhub: ' + err.message);
      console.warn('[EconCalendar] Finnhub failed:', err.message);
    }
  }

  // 2. TradingEconomics Calendar (RapidAPI)
  if (getRapidApiKey()) {
    try {
      const events = await fetchTECalendar();
      if (events.length > 0) return { events, source: 'TradingEconomics (Live)', unavailable: false };
    } catch (err: any) {
      errors.push('TE: ' + err.message);
      console.warn('[EconCalendar] TradingEconomics failed:', err.message);
    }
  }

  // 3. FCSAPI (try with or without key)
  try {
    const events = await fetchFcsApiCalendar();
    if (events.length > 0) return { events, source: 'FCSAPI (Live)', unavailable: false };
  } catch (err: any) {
    errors.push('FCSAPI: ' + err.message);
    console.warn('[EconCalendar] FCSAPI failed:', err.message);
  }

  // 4. MyFXBook (free, no key)
  try {
    const events = await fetchMyFXBookCalendar();
    if (events.length > 0) return { events, source: 'MyFXBook (Live)', unavailable: false };
  } catch (err: any) {
    errors.push('MyFXBook: ' + err.message);
    console.warn('[EconCalendar] MyFXBook failed:', err.message);
  }

  // 5. Investing.com (free, via CORS proxy)
  try {
    const events = await fetchInvestingCalendar();
    if (events.length > 0) return { events, source: 'Investing.com (Live)', unavailable: false };
  } catch (err: any) {
    errors.push('Investing: ' + err.message);
    console.warn('[EconCalendar] Investing.com failed:', err.message);
  }

  // 6. Fallback (guaranteed, no external call)
  console.warn('[EconCalendar] All live APIs failed, using fallback schedule. Errors:', errors.join('; '));
  const events = await fetchFallbackCalendar();
  return { events, source: 'Fallback Schedule', unavailable: false };
}

// ─── KV Cache helpers ──────────────────────────────────────────────────────
async function getKVCache(request: NextRequest): Promise<CacheEntry | null> {
  try {
    const { getCloudflareEnv } = await import('@/lib/cloudflare-bindings');
    const env = getCloudflareEnv(request as unknown as Request);
    const kv = env?.luxtradee_kv;
    if (!kv) return null;
    const raw = await kv.get('economic_calendar_cache', 'text');
    if (!raw) return null;
    return JSON.parse(raw) as CacheEntry;
  } catch { return null; }
}

async function setKVCache(request: NextRequest, entry: CacheEntry, ttlMs?: number): Promise<void> {
  try {
    const { getCloudflareEnv } = await import('@/lib/cloudflare-bindings');
    const env = getCloudflareEnv(request as unknown as Request);
    const kv = env?.luxtradee_kv;
    if (!kv) return;
    await kv.put('economic_calendar_cache', JSON.stringify(entry), { expirationTtl: Math.ceil((ttlMs || CACHE_DURATION) / 1000) });
  } catch { /* KV not available */ }
}

// ─── GET Handler ────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  // Expose CF Workers env vars (secrets) to API key helpers
  _cfEnv = (request as any).env || null;

  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get('refresh') === 'true';
  const impactFilter = searchParams.get('impact');
  const currencyFilter = searchParams.get('currency');
  const timezone = searchParams.get('tz');
  const now = new Date();
  const serverTime = now.toISOString();

  try {
    // 1. Try KV cache
    if (!forceRefresh) {
      const kvEntry = await getKVCache(request);
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

    // 2. Try in-memory cache
    if (!forceRefresh && calendarCache && Date.now() - calendarCache.timestamp < CACHE_DURATION) {
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

    // 3. Fetch fresh data
    const { events: allEvents, source, unavailable } = await fetchCalendarEvents();

    const cacheTTL = (unavailable && allEvents.length === 0) ? 60 * 1000 : CACHE_DURATION;
    const newCache: CacheEntry = { events: allEvents, timestamp: Date.now(), source, unavailable };
    calendarCache = newCache;
    await setKVCache(request, newCache, cacheTTL);

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
