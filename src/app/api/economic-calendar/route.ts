import { NextRequest, NextResponse } from 'next/server';

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

// ─── In-Memory Cache (fallback when KV not available) ────────────────────────
let calendarCache: CacheEntry | null = null;
const CACHE_DURATION = 30 * 60 * 1000; // 30 min

// ─── TradingEconomics RapidAPI ────────────────────────────────────────────────
const TE_API_HOST = 'trading-econmics-scraper.p.rapidapi.com';
const TE_CALENDAR_ENDPOINT = 'https://trading-econmics-scraper.p.rapidapi.com/get_calendar_events';
const TE_NEWS_ENDPOINT = 'https://trading-econmics-scraper.p.rapidapi.com/get_trading_economics_news';

function getTeApiKey(): string {
  return process.env.RAPIDAPI_KEY || process.env.RAPIDAPI_TRADING_ECONOMICS_KEY || '';
}

function mapTeImportance(importance: string): 'high' | 'medium' | 'low' {
  switch (importance) {
    case '3': case 'High': return 'high';
    case '2': case 'Medium': case 'Med': return 'medium';
    default: return 'low';
  }
}

function mapCountryToCurrency(country: string): string {
  const map: Record<string, string> = {
    'United States': 'USD', 'United Kingdom': 'GBP', 'European Union': 'EUR',
    'Eurozone': 'EUR', 'Japan': 'JPY', 'Australia': 'AUD', 'Canada': 'CAD',
    'Switzerland': 'CHF', 'New Zealand': 'NZD', 'China': 'CNY', 'Indonesia': 'IDR',
    'Germany': 'EUR', 'France': 'EUR', 'South Korea': 'KRW', 'India': 'INR',
    'Brazil': 'BRL', 'Singapore': 'SGD', 'Sweden': 'SEK',
  };
  return map[country] || country.substring(0, 3).toUpperCase();
}

async function fetchTECalendar(): Promise<CalendarEvent[]> {
  const apiKey = getTeApiKey();
  if (!apiKey) throw new Error('No API key');

  const today = new Date();
  const start = new Date(today); start.setDate(today.getDate() - 1);
  const end = new Date(today); end.setDate(today.getDate() + 7);
  const startDate = start.toISOString().split('T')[0];
  const endDate = end.toISOString().split('T')[0];

  const headers = {
    'Content-Type': 'application/json',
    'x-rapidapi-host': TE_API_HOST,
    'x-rapidapi-key': apiKey,
  };

  // Strategy 1: Try with start_date/end_date params
  try {
    const url1 = `${TE_CALENDAR_ENDPOINT}?country=all&importance=3,2,1&start_date=${startDate}&end_date=${endDate}`;
    const res1 = await fetch(url1, { headers, signal: AbortSignal.timeout(15000) });

    if (res1.ok) {
      const data = await res1.json();
      if (Array.isArray(data) && data.length > 0) {
        console.log('[EconCalendar] TE Strategy 1 (start_date/end_date) returned ' + data.length + ' events');
        return mapTEEvents(data, startDate);
      }
      console.warn('[EconCalendar] TE Strategy 1 returned empty/non-array, trying next...');
    } else {
      const body = await res1.text().catch(() => '');
      console.warn(`[EconCalendar] TE Strategy 1 returned ${res1.status}: ${body.substring(0, 200)}`);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[EconCalendar] TE Strategy 1 failed: ' + msg);
  }

  // Strategy 2: Try with year/month/day params (same as news endpoint)
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const day = today.getDate();

  try {
    const url2 = `${TE_CALENDAR_ENDPOINT}?year=${year}&month=${month}&day=${day}`;
    const res2 = await fetch(url2, { headers, signal: AbortSignal.timeout(15000) });

    if (res2.ok) {
      const data = await res2.json();
      if (Array.isArray(data) && data.length > 0) {
        console.log('[EconCalendar] TE Strategy 2 (year/month/day) returned ' + data.length + ' events');
        return mapTEEvents(data, startDate);
      }
      console.warn('[EconCalendar] TE Strategy 2 returned empty/non-array');
    } else {
      const body = await res2.text().catch(() => '');
      console.warn(`[EconCalendar] TE Strategy 2 returned ${res2.status}: ${body.substring(0, 200)}`);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[EconCalendar] TE Strategy 2 failed: ' + msg);
  }

  // Strategy 3: Try with no params at all (some endpoints return defaults)
  try {
    const url3 = `${TE_CALENDAR_ENDPOINT}`;
    const res3 = await fetch(url3, { headers, signal: AbortSignal.timeout(15000) });

    if (res3.ok) {
      const data = await res3.json();
      if (Array.isArray(data) && data.length > 0) {
        console.log('[EconCalendar] TE Strategy 3 (no params) returned ' + data.length + ' events');
        return mapTEEvents(data, startDate);
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[EconCalendar] TE Strategy 3 failed: ' + msg);
  }

  // Strategy 4: Use the NEWS endpoint (which works!) to derive calendar events
  // News from TradingEconomics contains economic event data with dates/times/importance
  try {
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    const url4 = `${TE_NEWS_ENDPOINT}?year=${year}&month=${month}&day=${day}`;
    const res4 = await fetch(url4, { headers, signal: AbortSignal.timeout(15000) });

    if (res4.ok) {
      const data = await res4.json();
      if (Array.isArray(data) && data.length > 0) {
        const events = newsToCalendarEvents(data);
        if (events.length > 0) {
          console.log('[EconCalendar] TE Strategy 4 (news→calendar) derived ' + events.length + ' events from ' + data.length + ' news items');
          return events;
        }
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[EconCalendar] TE Strategy 4 failed: ' + msg);
  }

  throw new Error('All TE calendar strategies failed');
}

/**
 * Convert TradingEconomics news items into calendar events.
 * News articles about economic indicators contain date/time/importance
 * that can be repurposed as calendar events.
 */
function newsToCalendarEvents(newsItems: Record<string, unknown>[]): CalendarEvent[] {
  // Keywords that indicate this news IS about an economic event/indicator
  const EVENT_KEYWORDS = [
    'cpi', 'inflation', 'gdp', 'pmi', 'nfp', 'nonfarm', 'non-farm',
    'interest rate', 'rate decision', 'fomc', 'fed ', 'ecb', 'boj', 'boe',
    'retail sales', 'jobless claims', 'unemployment', 'employment change',
    'consumer sentiment', 'consumer confidence', 'producer price', 'ppi',
    'trade balance', 'industrial production', 'housing starts', 'building permits',
    'durable goods', 'factory orders', 'leading indicators',
    'payroll', 'wage', 'income', 'spending',
    'manufacturing', 'services pmi', 'composite pmi',
  ];

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const events: CalendarEvent[] = [];

  for (const item of newsItems) {
    const title = ((item.title as string) || '').toLowerCase();
    const category = ((item.category as string) || '').toLowerCase();

    // Check if this news item is about an economic event
    const isEconEvent = EVENT_KEYWORDS.some(kw => title.includes(kw)) ||
      category.includes('interest rate') ||
      category.includes('inflation') ||
      category.includes('employment') ||
      category.includes('consumer') ||
      category.includes('balance of trade');

    if (!isEconEvent) continue;

    const date = (item.date as string) || todayStr;
    const time = (item.time as string) || '08:30'; // Default US market time
    const country = (item.country as string) || '';
    const currency = mapCountryToCurrency(country);
    const importance = (item.importance as string) || '2';
    const eventTitle = (item.title as string) || 'Economic Event';

    // Avoid duplicates
    const dedupeKey = currency + '-' + date + '-' + eventTitle.substring(0, 30);
    if (events.some(e => (e.currency + '-' + e.date + '-' + e.event.substring(0, 30)) === dedupeKey)) continue;

    events.push({
      id: 'ten-' + events.length + '-' + currency + '-' + date,
      date,
      time,
      dateTime: buildDateTime(date, time),
      currency,
      impact: mapTeImportance(importance),
      event: eventTitle,
      actual: item.actual as string | undefined,
      forecast: (item.forecast as string) || '',
      previous: (item.previous as string) || '',
    });
  }

  // Sort by impact (high first) then date
  const impactOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  events.sort((a, b) => {
    const aImp = impactOrder[a.impact] ?? 99;
    const bImp = impactOrder[b.impact] ?? 99;
    if (aImp !== bImp) return aImp - bImp;
    return a.dateTime.localeCompare(b.dateTime);
  });

  return events;
}

function mapTEEvents(data: Record<string, unknown>[], fallbackDate: string): CalendarEvent[] {
  return data.map((item, i) => {
    const date = (item.date as string) || fallbackDate;
    const time = (item.time as string) || '00:00';
    const currency = mapCountryToCurrency((item.country as string) || '');
    return {
      id: 'te-' + i + '-' + currency + '-' + date + '-' + time,
      date, time, dateTime: buildDateTime(date, time),
      currency, impact: mapTeImportance((item.importance as string) || '1'),
      event: (item.event as string) || 'Unknown Event',
      actual: item.actual as string | undefined,
      forecast: (item.forecast as string) || '',
      previous: (item.previous as string) || '',
    };
  });
}

// ─── Finnhub Calendar (fallback #1) ──────────────────────────────────────────
async function fetchFinnhubCalendar(): Promise<CalendarEvent[]> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) throw new Error('No Finnhub key');

  const res = await fetch('https://finnhub.io/api/v1/calendar/economic?token=' + apiKey, {
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error('Finnhub returned ' + res.status);

  const data = await res.json();
  const events: unknown[] = data?.economicCalendar || [];
  if (!Array.isArray(events)) throw new Error('Invalid Finnhub data');

  return events.map((item: Record<string, unknown>, i: number) => {
    const date = (item.date as string) || '';
    const time = (item.time as string) || '';
    const currency = ((item.country as string) || '').substring(0, 3).toUpperCase();
    return {
      id: 'fh-' + i + '-' + currency + '-' + date,
      date, time, dateTime: buildDateTime(date, time),
      currency: currency || 'USD',
      impact: item.impact === 'high' ? 'high' : item.impact === 'medium' ? 'medium' : 'low',
      event: (item.event as string) || 'Economic Event',
      actual: item.actual?.toString(),
      forecast: item.forecast?.toString() || '',
      previous: (item.prev as string)?.toString() || '',
    };
  });
}

// ─── Alpha Vantage Calendar (fallback #2) ─────────────────────────────────────
async function fetchAlphaVantageCalendar(): Promise<CalendarEvent[]> {
  const apiKey = process.env.ALPHAVANTAGE_API_KEY;
  if (!apiKey) throw new Error('No Alpha Vantage key');

  const res = await fetch(
    `https://www.alphavantage.co/query?function=ECONOMIC_CALENDAR&apikey=${apiKey}`,
    { signal: AbortSignal.timeout(10000) }
  );
  if (!res.ok) throw new Error('Alpha Vantage returned ' + res.status);

  const data = await res.json();
  const events: unknown[] = data?.data || data?.events || [];
  if (!Array.isArray(events)) throw new Error('Invalid Alpha Vantage data');

  return events.map((item: Record<string, unknown>, i: number) => {
    const date = (item.date as string) || '';
    const time = (item.time as string) || '';
    const currency = ((item.country as string) || '').substring(0, 3).toUpperCase();
    const importance = (item.importance as string) || (item.priority as string) || '1';
    let impact: 'high' | 'medium' | 'low' = 'low';
    if (importance === '3' || importance === 'HIGH' || importance === 'high') impact = 'high';
    else if (importance === '2' || importance === 'MEDIUM' || importance === 'medium') impact = 'medium';

    return {
      id: 'av-' + i + '-' + currency + '-' + date,
      date, time, dateTime: buildDateTime(date, time),
      currency: currency || 'USD',
      impact,
      event: (item.event as string) || (item.name as string) || 'Economic Event',
      actual: item.actual?.toString(),
      forecast: item.forecast?.toString() || '',
      previous: item.prev?.toString() || (item.previous as string)?.toString() || '',
    };
  });
}

// ─── Helper: Build ISO datetime ───────────────────────────────────────────────
function buildDateTime(date: string, time: string): string {
  try {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayIndex = dayNames.findIndex(d => date.startsWith(d));

    if (dayIndex >= 0) {
      const now = new Date();
      const todayDay = now.getDay();
      let diff = dayIndex - todayDay;
      if (diff < -1) diff += 7;
      const targetDate = new Date(now);
      targetDate.setDate(now.getDate() + diff);
      const dateStr = targetDate.toISOString().split('T')[0];
      const parts = time.split(':');
      const h = (parts[0] || '0').padStart(2, '0');
      const m = (parts[1] || '0').padStart(2, '0');
      return dateStr + 'T' + h + ':' + m + ':00Z';
    }

    if (date.includes('T')) return date;
    if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const parts = time.split(':');
      const h = (parts[0] || '0').padStart(2, '0');
      const m = (parts[1] || '0').padStart(2, '0');
      return date + 'T' + h + ':' + m + ':00Z';
    }

    return new Date().toISOString();
  } catch {
    return new Date().toISOString();
  }
}

// ─── Sample Data with Real Dates ─────────────────────────────────────────────
function getSampleEvents(): CalendarEvent[] {
  const now = new Date();
  const d = (offset: number) => new Date(now.getTime() + offset * 86400000).toISOString().split('T')[0];
  const today = d(0), tomorrow = d(1), day3 = d(2), day4 = d(3), day5 = d(4);

  return [
    { id: 's-1', date: today, time: '08:30', dateTime: today + 'T08:30:00Z', currency: 'USD', impact: 'high', event: 'Non-Farm Payrolls', forecast: '200K', previous: '175K' },
    { id: 's-2', date: today, time: '10:00', dateTime: today + 'T10:00:00Z', currency: 'EUR', impact: 'high', event: 'ECB Interest Rate Decision', forecast: '4.50%', previous: '4.50%' },
    { id: 's-3', date: today, time: '14:00', dateTime: today + 'T14:00:00Z', currency: 'GBP', impact: 'medium', event: 'UK GDP m/m', forecast: '0.2%', previous: '0.1%' },
    { id: 's-4', date: tomorrow, time: '03:00', dateTime: tomorrow + 'T03:00:00Z', currency: 'JPY', impact: 'medium', event: 'Japan Manufacturing PMI', forecast: '49.5', previous: '49.2' },
    { id: 's-5', date: tomorrow, time: '08:30', dateTime: tomorrow + 'T08:30:00Z', currency: 'USD', impact: 'high', event: 'CPI m/m', forecast: '0.3%', previous: '0.2%' },
    { id: 's-6', date: tomorrow, time: '10:00', dateTime: tomorrow + 'T10:00:00Z', currency: 'AUD', impact: 'medium', event: 'Employment Change', forecast: '20K', previous: '15K' },
    { id: 's-7', date: day3, time: '02:00', dateTime: day3 + 'T02:00:00Z', currency: 'CNY', impact: 'high', event: 'China CPI y/y', forecast: '0.5%', previous: '0.4%' },
    { id: 's-8', date: day3, time: '09:00', dateTime: day3 + 'T09:00:00Z', currency: 'EUR', impact: 'low', event: 'Germany Industrial Production m/m', forecast: '0.1%', previous: '-0.2%' },
    { id: 's-9', date: day3, time: '14:00', dateTime: day3 + 'T14:00:00Z', currency: 'USD', impact: 'high', event: 'Retail Sales m/m', forecast: '0.4%', previous: '0.3%' },
    { id: 's-10', date: day4, time: '08:30', dateTime: day4 + 'T08:30:00Z', currency: 'USD', impact: 'medium', event: 'Initial Jobless Claims', forecast: '215K', previous: '210K' },
    { id: 's-11', date: day4, time: '10:00', dateTime: day4 + 'T10:00:00Z', currency: 'CHF', impact: 'low', event: 'Switzerland Unemployment Rate', forecast: '2.2%', previous: '2.1%' },
    { id: 's-12', date: day4, time: '15:00', dateTime: day4 + 'T15:00:00Z', currency: 'CAD', impact: 'high', event: 'Canada CPI m/m', forecast: '0.2%', previous: '0.1%' },
    { id: 's-13', date: day5, time: '02:00', dateTime: day5 + 'T02:00:00Z', currency: 'JPY', impact: 'medium', event: 'Japan PPI y/y', forecast: '2.5%', previous: '2.3%' },
    { id: 's-14', date: day5, time: '09:00', dateTime: day5 + 'T09:00:00Z', currency: 'EUR', impact: 'low', event: 'Eurozone Trade Balance', forecast: '15.0B', previous: '14.5B' },
    { id: 's-15', date: day5, time: '14:00', dateTime: day5 + 'T14:00:00Z', currency: 'USD', impact: 'high', event: 'Consumer Sentiment (U of Mich)', forecast: '72.0', previous: '70.5' },
    { id: 's-16', date: today, time: '19:00', dateTime: today + 'T19:00:00Z', currency: 'USD', impact: 'high', event: 'FOMC Meeting Minutes', forecast: '', previous: '' },
    { id: 's-17', date: tomorrow, time: '12:00', dateTime: tomorrow + 'T12:00:00Z', currency: 'IDR', impact: 'medium', event: 'Indonesia Interest Rate Decision', forecast: '6.00%', previous: '6.25%' },
    { id: 's-18', date: day3, time: '08:30', dateTime: day3 + 'T08:30:00Z', currency: 'USD', impact: 'high', event: 'Core CPI m/m', forecast: '0.3%', previous: '0.2%' },
  ];
}

// ─── Fetch with Cascade Fallback ─────────────────────────────────────────────
async function fetchCalendarEvents(): Promise<{ events: CalendarEvent[]; source: string; unavailable: boolean }> {
  const teKey = getTeApiKey();

  // 1. TradingEconomics (with multi-strategy)
  if (teKey) {
    try {
      console.log('[EconCalendar] Trying TradingEconomics RapidAPI (key found: ' + teKey.substring(0, 6) + '...)');
      const events = await fetchTECalendar();
      console.log('[EconCalendar] ✓ Fetched ' + events.length + ' events from TradingEconomics');
      const source = events.some(e => e.id.startsWith('ten-')) ? 'TradingEconomics (via News)' : 'TradingEconomics';
      return { events, source, unavailable: false };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[EconCalendar] ✗ TE calendar failed: ' + msg);
    }
  } else {
    console.warn('[EconCalendar] RAPIDAPI_KEY not set, skipping TradingEconomics');
  }

  // 2. Finnhub
  if (process.env.FINNHUB_API_KEY) {
    try {
      const events = await fetchFinnhubCalendar();
      console.log('[EconCalendar] ✓ Fetched ' + events.length + ' events from Finnhub');
      return { events, source: 'Finnhub', unavailable: false };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[EconCalendar] ✗ Finnhub failed: ' + msg);
    }
  }

  // 3. Alpha Vantage
  if (process.env.ALPHAVANTAGE_API_KEY) {
    try {
      const events = await fetchAlphaVantageCalendar();
      console.log('[EconCalendar] ✓ Fetched ' + events.length + ' events from Alpha Vantage');
      return { events, source: 'Alpha Vantage', unavailable: false };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[EconCalendar] ✗ Alpha Vantage failed: ' + msg);
    }
  }

  // 4. Sample data
  console.warn('[EconCalendar] Using sample data (no API keys configured or all failed)');
  return { events: getSampleEvents(), source: 'Sample Data', unavailable: false };
}

// ─── KV Cache helpers ─────────────────────────────────────────────────────────
async function getKVCache(request: NextRequest): Promise<CacheEntry | null> {
  try {
    const { getCloudflareEnv } = await import('@/lib/cloudflare-bindings');
    const env = getCloudflareEnv(request as unknown as Request);
    const kv = env?.luxtradee_kv;
    if (!kv) return null;
    const raw = await kv.get('economic_calendar_cache', 'text');
    if (!raw) return null;
    return JSON.parse(raw) as CacheEntry;
  } catch {
    return null;
  }
}

async function setKVCache(request: NextRequest, entry: CacheEntry): Promise<void> {
  try {
    const { getCloudflareEnv } = await import('@/lib/cloudflare-bindings');
    const env = getCloudflareEnv(request as unknown as Request);
    const kv = env?.luxtradee_kv;
    if (!kv) return;
    // TTL: 30 minutes
    await kv.put('economic_calendar_cache', JSON.stringify(entry), { expirationTtl: 1800 });
  } catch {
    // KV not available, in-memory cache still works
  }
}

// ─── GET Handler ─────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get('refresh') === 'true';
  const impactFilter = searchParams.get('impact');
  const currencyFilter = searchParams.get('currency');
  const timezone = searchParams.get('tz'); // Client timezone offset e.g. "+07:00"

  const now = new Date();
  const serverTime = now.toISOString();

  try {
    // 1. Try KV cache first (Cloudflare Workers)
    if (!forceRefresh) {
      const kvEntry = await getKVCache(request);
      if (kvEntry && Date.now() - kvEntry.timestamp < CACHE_DURATION) {
        let events = kvEntry.events;
        if (impactFilter) events = events.filter(e => e.impact === impactFilter);
        if (currencyFilter) events = events.filter(e => e.currency === currencyFilter);

        return NextResponse.json({
          success: true, cached: true, cacheSource: 'kv', events,
          totalAvailable: kvEntry.events.length,
          source: kvEntry.source,
          fetchedAt: new Date(kvEntry.timestamp).toISOString(),
          now: serverTime,
          timezone: timezone || null,
          unavailable: kvEntry.unavailable || false,
          message: kvEntry.unavailable ? 'Calendar data temporarily unavailable.' : undefined,
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
        totalAvailable: calendarCache.events.length,
        source: calendarCache.source,
        fetchedAt: new Date(calendarCache.timestamp).toISOString(),
        now: serverTime,
        timezone: timezone || null,
        unavailable: calendarCache.unavailable || false,
        message: calendarCache.unavailable ? 'Calendar data temporarily unavailable.' : undefined,
      });
    }

    // 3. Fetch fresh data
    const { events: allEvents, source, unavailable } = await fetchCalendarEvents();
    const newCache: CacheEntry = { events: allEvents, timestamp: Date.now(), source, unavailable };
    calendarCache = newCache;

    // Also store in KV for cross-isolate consistency
    await setKVCache(request, newCache);

    let events = allEvents;
    if (impactFilter) events = events.filter(e => e.impact === impactFilter);
    if (currencyFilter) events = events.filter(e => e.currency === currencyFilter);

    return NextResponse.json({
      success: true, cached: false, events,
      totalAvailable: allEvents.length, source,
      fetchedAt: new Date().toISOString(),
      now: serverTime,
      timezone: timezone || null,
      unavailable,
      message: unavailable ? 'Calendar data temporarily unavailable.' : undefined,
    });
  } catch (error) {
    console.error('[EconCalendar] API error:', error);

    // Return stale cache if available
    if (calendarCache && calendarCache.events.length > 0) {
      let events = calendarCache.events;
      if (impactFilter) events = events.filter(e => e.impact === impactFilter);
      if (currencyFilter) events = events.filter(e => e.currency === currencyFilter);
      return NextResponse.json({
        success: true, cached: true, expired: true, events,
        totalAvailable: calendarCache.events.length,
        source: calendarCache.source + ' (stale)',
        fetchedAt: new Date(calendarCache.timestamp).toISOString(),
        now: serverTime,
        timezone: timezone || null,
        message: 'Using cached data (fresh data unavailable)',
      });
    }

    // Ultimate fallback: sample data
    const sampleEvents = getSampleEvents();
    return NextResponse.json({
      success: true, cached: false, events: sampleEvents,
      totalAvailable: sampleEvents.length, source: 'Sample Data (fallback)',
      fetchedAt: new Date().toISOString(), now: serverTime,
      timezone: timezone || null,
      unavailable: true,
      message: 'Calendar data temporarily unavailable. Showing sample data.',
    });
  }
}
