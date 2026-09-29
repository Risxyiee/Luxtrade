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
const CACHE_DURATION = 30 * 60 * 1000; // 30 min normal
const CACHE_DURATION_RATE_LIMITED = 60 * 60 * 1000; // 60 min when rate limited

// ─── TradingEconomics RapidAPI ────────────────────────────────────────────────
const TE_API_HOST = 'trading-econmics-scraper.p.rapidapi.com';
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
    'Mexico': 'MXN', 'Norway': 'NOK', 'Russia': 'RUB', 'Turkey': 'TRY',
    'South Africa': 'ZAR', 'Thailand': 'THB', 'Philippines': 'PHP',
    'Malaysia': 'MYR', 'Poland': 'PLN', 'Czech Republic': 'CZK',
    'Hungary': 'HUF', 'Romania': 'RON', 'Denmark': 'DKK',
    'Finland': 'EUR', 'Austria': 'EUR', 'Netherlands': 'EUR',
    'Italy': 'EUR', 'Spain': 'EUR', 'Portugal': 'EUR', 'Greece': 'EUR',
    'Ireland': 'EUR', 'Belgium': 'EUR', 'Ukraine': 'UAH',
    'Argentina': 'ARS', 'Chile': 'CLP', 'Colombia': 'COP',
    'Egypt': 'EGP', 'Israel': 'ILS', 'Saudi Arabia': 'SAR',
    'United Arab Emirates': 'AED', 'Kuwait': 'KWD', 'Bahrain': 'BHD',
    'Nigeria': 'NGN', 'Kenya': 'KES', 'Ghana': 'GHS',
    'Pakistan': 'PKR', 'Bangladesh': 'BDT', 'Vietnam': 'VND',
    'Taiwan': 'TWD', 'Hong Kong': 'HKD',
  };
  return map[country] || country.substring(0, 3).toUpperCase();
}

// ─── Fetch TradingEconomics NEWS endpoint and convert to calendar events ──────
async function fetchTECalendar(): Promise<CalendarEvent[]> {
  const apiKey = getTeApiKey();
  if (!apiKey) throw new Error('No API key');

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const day = today.getDate();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-rapidapi-host': TE_API_HOST,
    'x-rapidapi-key': apiKey,
  };

  // Use NEWS endpoint (known working) to derive calendar events
  const url = `${TE_NEWS_ENDPOINT}?year=${year}&month=${month}&day=${day}`;
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
  if (!res.ok) {
    if (res.status === 429) {
      const err = new Error('TradingEconomics rate limit (429)');
      (err as any).isRateLimit = true;
      throw err;
    }
    throw new Error('TradingEconomics returned ' + res.status);
  }

  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('TradingEconomics returned empty data');
  }

  const events = newsToCalendarEvents(data);
  if (events.length === 0) throw new Error('No economic events found in news data');

  console.log('[EconCalendar] TE News→Calendar: ' + events.length + ' events from ' + data.length + ' news');
  return events;
}

// ─── News → Calendar Events converter ────────────────────────────────────────
function newsToCalendarEvents(newsItems: Record<string, unknown>[]): CalendarEvent[] {
  const HIGH_KW = [
    'cpi', 'inflation rate', 'gdp', 'nfp', 'nonfarm', 'non-farm',
    'interest rate decision', 'rate decision', 'fomc', 'rate hike', 'rate cut',
    'retail sales', 'jobless claims', 'unemployment rate',
    'consumer sentiment', 'consumer confidence', 'producer price', 'ppi',
    'payroll', 'employment change',
  ];
  const MED_KW = [
    'pmi', 'manufacturing', 'industrial production', 'trade balance',
    'housing starts', 'building permits', 'durable goods', 'factory orders',
    'wage', 'income', 'spending', 'services pmi', 'composite pmi',
    'producer inflation', 'consumer inflation', 'retail',
  ];
  const ECON_CATS = new Set([
    'interest rate', 'inflation rate', 'balance of trade',
    'employment', 'consumer confidence', 'gdp growth rate',
    'retail sales', 'producer prices change',
  ]);
  const COUNTRY_TIME: Record<string, string> = {
    'United States': '08:30', 'European Union': '10:00', 'Eurozone': '10:00',
    'United Kingdom': '07:00', 'Japan': '00:50', 'Australia': '01:30',
    'Canada': '08:30', 'Switzerland': '08:15', 'New Zealand': '22:45',
    'China': '02:00', 'Indonesia': '04:00', 'Germany': '08:00',
    'France': '08:45', 'South Korea': '01:00', 'India': '06:00',
    'Brazil': '10:00', 'Singapore': '01:00', 'Sweden': '08:30',
    'Mexico': '08:30', 'Norway': '08:00', 'Russia': '08:00',
  };

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const events: CalendarEvent[] = [];

  for (const item of newsItems) {
    const title = ((item.title as string) || '').toLowerCase();
    const category = ((item.category as string) || '').toLowerCase();
    const country = (item.country as string) || '';

    let isEconEvent = false;
    let impactLevel: 'high' | 'medium' | 'low' = 'low';

    if (HIGH_KW.some(kw => title.includes(kw))) { isEconEvent = true; impactLevel = 'high'; }
    else if (MED_KW.some(kw => title.includes(kw))) { isEconEvent = true; impactLevel = 'medium'; }
    else if (ECON_CATS.has(category)) {
      isEconEvent = true;
      impactLevel = (category.includes('interest rate') || category.includes('inflation') || category.includes('gdp')) ? 'high' : 'medium';
    }

    if (!isEconEvent) continue;

    const rawDate = (item.date as string) || '';
    const dateMatch = rawDate.match(/^(\d{4}-\d{2}-\d{2})/);
    const eventDate = dateMatch ? dateMatch[1] : todayStr;
    const eventTime = COUNTRY_TIME[country] || '08:30';
    const currency = mapCountryToCurrency(country);
    const eventTitle = (item.title as string) || 'Economic Event';

    // Override impact from API importance if available
    const apiImp = (item.importance as string) || '';
    if (apiImp === '3') impactLevel = 'high';
    else if (apiImp === '2' && impactLevel !== 'high') impactLevel = 'medium';

    // Dedupe
    const dedupeKey = currency + '-' + eventDate + '-' + eventTitle.substring(0, 30);
    if (events.some(e => (e.currency + '-' + e.date + '-' + e.event.substring(0, 30)) === dedupeKey)) continue;

    events.push({
      id: 'ten-' + events.length + '-' + currency + '-' + eventDate,
      date: eventDate, time: eventTime,
      dateTime: buildDateTime(eventDate, eventTime),
      currency, impact: impactLevel, event: eventTitle,
      actual: item.actual as string | undefined,
      forecast: (item.forecast as string) || '',
      previous: (item.previous as string) || '',
    });
  }

  const impactOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  events.sort((a, b) => {
    const dc = a.date.localeCompare(b.date);
    if (dc !== 0) return dc;
    return (impactOrder[a.impact] ?? 99) - (impactOrder[b.impact] ?? 99);
  });

  return events;
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
async function fetchCalendarEvents(): Promise<{ events: CalendarEvent[]; source: string; unavailable: boolean; rateLimited?: boolean }> {
  const teKey = getTeApiKey();

  // 1. TradingEconomics News → Calendar Events (the only strategy that works)
  if (teKey) {
    try {
      console.log('[EconCalendar] Trying TradingEconomics News→Calendar (key: ' + teKey.substring(0, 6) + '...)');
      const events = await fetchTECalendar();
      console.log('[EconCalendar] ✓ ' + events.length + ' events from TradingEconomics (News)');
      return { events, source: 'TradingEconomics (News)', unavailable: false };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const isRateLimit = (err as any)?.isRateLimit === true;
      if (isRateLimit) {
        console.warn('[EconCalendar] ⚠️ Rate limited (429) — returning cached/sample data with extended cache');
        return { events: getSampleEvents(), source: 'Sample Data (rate limited)', unavailable: false, rateLimited: true };
      }
      console.error('[EconCalendar] ✗ TE News failed: ' + msg);
    }
  } else {
    console.warn('[EconCalendar] RAPIDAPI_KEY not set, skipping TradingEconomics');
  }

  // 2. Sample data
  console.warn('[EconCalendar] Using sample data (no API key or TE News failed)');
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

async function setKVCache(request: NextRequest, entry: CacheEntry, ttlMs?: number): Promise<void> {
  try {
    const { getCloudflareEnv } = await import('@/lib/cloudflare-bindings');
    const env = getCloudflareEnv(request as unknown as Request);
    const kv = env?.luxtradee_kv;
    if (!kv) return;
    await kv.put('economic_calendar_cache', JSON.stringify(entry), { expirationTtl: Math.ceil((ttlMs || CACHE_DURATION) / 1000) });
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
  const timezone = searchParams.get('tz');

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
    const { events: allEvents, source, unavailable, rateLimited } = await fetchCalendarEvents();

    // Use extended cache TTL when rate limited to reduce API calls
    const cacheTTL = rateLimited ? CACHE_DURATION_RATE_LIMITED : CACHE_DURATION;
    const newCache: CacheEntry = { events: allEvents, timestamp: Date.now(), source, unavailable };
    calendarCache = newCache;
    // On rate limit, cache with longer TTL in KV
    await setKVCache(request, newCache, cacheTTL);

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
      rateLimited: rateLimited || undefined,
      message: rateLimited
        ? 'API rate limited. Showing sample data. Try again later.'
        : unavailable ? 'Calendar data temporarily unavailable.' : undefined,
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

    const sampleEvents = getSampleEvents();
    return NextResponse.json({
      success: true, cached: false, events: sampleEvents,
      totalAvailable: sampleEvents.length, source: 'Sample Data (fallback)',
      fetchedAt: new Date().toISOString(), now: serverTime,
      timezone: timezone || null, unavailable: true,
      message: 'Calendar data temporarily unavailable. Showing sample data.',
    });
  }
}
