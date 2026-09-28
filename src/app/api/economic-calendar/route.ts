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

// ─── In-Memory Cache ──────────────────────────────────────────────────────────
let calendarCache: CacheEntry | null = null;
const CACHE_DURATION = 30 * 60 * 1000; // 30 min

// ─── TradingEconomics RapidAPI ────────────────────────────────────────────────
const TE_ENDPOINT = 'https://trading-econmics-scraper.p.rapidapi.com/get_calendar_events';

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

  const url = `${TE_ENDPOINT}?country=all&importance=3,2,1&start_date=${startDate}&end_date=${endDate}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'x-rapidapi-host': 'trading-econmics-scraper.p.rapidapi.com',
      'x-rapidapi-key': apiKey,
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) throw new Error('TE returned ' + response.status);
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error('Invalid TE data');

  return data.map((item: any, i: number) => {
    const date = item.date || startDate;
    const time = item.time || '00:00';
    const currency = mapCountryToCurrency(item.country || '');
    return {
      id: 'te-' + i + '-' + currency + '-' + date + '-' + time,
      date, time, dateTime: buildDateTime(date, time),
      currency, impact: mapTeImportance(item.importance || '1'),
      event: item.event || 'Unknown Event',
      actual: item.actual, forecast: item.forecast || '', previous: item.previous || '',
    };
  });
}

// ─── Finnhub Calendar (fallback) ─────────────────────────────────────────────
async function fetchFinnhubCalendar(): Promise<CalendarEvent[]> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) throw new Error('No Finnhub key');

  const res = await fetch('https://finnhub.io/api/v1/calendar/economic?token=' + apiKey, {
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error('Finnhub returned ' + res.status);

  const data = await res.json();
  const events: any[] = data?.economicCalendar || [];
  if (!Array.isArray(events)) throw new Error('Invalid Finnhub data');

  return events.map((item: any, i: number) => {
    const date = item.date || '';
    const time = item.time || '';
    const currency = (item.country || '').substring(0, 3).toUpperCase();
    return {
      id: 'fh-' + i + '-' + currency + '-' + date,
      date, time, dateTime: buildDateTime(date, time),
      currency: currency || 'USD',
      impact: item.impact === 'high' ? 'high' : item.impact === 'medium' ? 'medium' : 'low',
      event: item.event || 'Economic Event',
      actual: item.actual?.toString(), forecast: item.forecast?.toString() || '',
      previous: item.prev?.toString() || '',
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
  // 1. TradingEconomics
  if (getTeApiKey()) {
    try {
      const events = await fetchTECalendar();
      console.log('[EconCalendar] Fetched ' + events.length + ' events from TradingEconomics');
      return { events, source: 'TradingEconomics', unavailable: false };
    } catch (err: any) {
      console.info('[EconCalendar] TE failed: ' + err.message);
    }
  }

  // 2. Finnhub
  if (process.env.FINNHUB_API_KEY) {
    try {
      const events = await fetchFinnhubCalendar();
      console.log('[EconCalendar] Fetched ' + events.length + ' events from Finnhub');
      return { events, source: 'Finnhub', unavailable: false };
    } catch (err: any) {
      console.info('[EconCalendar] Finnhub failed: ' + err.message);
    }
  }

  // 3. Sample data
  console.info('[EconCalendar] Using sample data');
  return { events: getSampleEvents(), source: 'Sample Data', unavailable: false };
}

// ─── GET Handler ─────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get('refresh') === 'true';
  const impactFilter = searchParams.get('impact');
  const currencyFilter = searchParams.get('currency');

  try {
    // Check cache
    if (!forceRefresh && calendarCache && Date.now() - calendarCache.timestamp < CACHE_DURATION) {
      let events = calendarCache.events;
      if (impactFilter) events = events.filter(e => e.impact === impactFilter);
      if (currencyFilter) events = events.filter(e => e.currency === currencyFilter);

      return NextResponse.json({
        success: true, cached: true, events,
        totalAvailable: calendarCache.events.length,
        source: calendarCache.source,
        fetchedAt: new Date(calendarCache.timestamp).toISOString(),
        now: new Date().toISOString(),
        unavailable: calendarCache.unavailable || false,
        message: calendarCache.unavailable ? 'Calendar data temporarily unavailable.' : undefined,
      });
    }

    // Fetch fresh data
    const { events: allEvents, source, unavailable } = await fetchCalendarEvents();
    calendarCache = { events: allEvents, timestamp: Date.now(), source, unavailable };

    let events = allEvents;
    if (impactFilter) events = events.filter(e => e.impact === impactFilter);
    if (currencyFilter) events = events.filter(e => e.currency === currencyFilter);

    return NextResponse.json({
      success: true, cached: false, events,
      totalAvailable: allEvents.length, source,
      fetchedAt: new Date().toISOString(),
      now: new Date().toISOString(),
      unavailable,
      message: unavailable ? 'Calendar data temporarily unavailable.' : undefined,
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
        now: new Date().toISOString(),
        message: 'Using cached data (fresh data unavailable)',
      });
    }

    const sampleEvents = getSampleEvents();
    return NextResponse.json({
      success: true, cached: false, events: sampleEvents,
      totalAvailable: sampleEvents.length, source: 'Sample Data (fallback)',
      fetchedAt: new Date().toISOString(), now: new Date().toISOString(),
      unavailable: true,
      message: 'Calendar data temporarily unavailable. Showing sample data.',
    });
  }
}
