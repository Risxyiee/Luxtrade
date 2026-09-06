import { NextRequest, NextResponse } from 'next/server';

// In-memory cache
let calendarCache: { events: CalendarEvent[]; timestamp: number; unavailable?: boolean } | null = null;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

// TradingEconomics RapidAPI config for calendar
const TE_CALENDAR_ENDPOINT = 'https://trading-econmics-scraper.p.rapidapi.com/get_calendar_events';

interface CalendarEvent {
  date: string;
  time: string;
  currency: string;
  impact: 'high' | 'medium' | 'low';
  event: string;
  actual?: string;
  forecast: string;
  previous: string;
  flag?: string;
}

interface TECalendarEvent {
  date: string;
  time: string;
  country: string;
  category: string;
  event: string;
  importance: string;
  actual?: string;
  forecast?: string;
  previous?: string;
}

/**
 * Map TradingEconomics importance to our impact level
 */
function mapTeImportance(importance: string): 'high' | 'medium' | 'low' {
  switch (importance) {
    case '3': case 'High': return 'high';
    case '2': case 'Medium': case 'Med': return 'medium';
    default: return 'low';
  }
}

/**
 * Map country to currency code
 */
function mapCountryToCurrency(country: string): string {
  const map: Record<string, string> = {
    'United States': 'USD',
    'United Kingdom': 'GBP',
    'European Union': 'EUR',
    'Eurozone': 'EUR',
    'Japan': 'JPY',
    'Australia': 'AUD',
    'Canada': 'CAD',
    'Switzerland': 'CHF',
    'New Zealand': 'NZD',
    'China': 'CNY',
    'Indonesia': 'IDR',
  };
  return map[country] || country.substring(0, 3).toUpperCase();
}

/**
 * Get TradingEconomics API key at request time
 */
function getTeApiKey(): string {
  return process.env.RAPIDAPI_KEY || process.env.RAPIDAPI_TRADING_ECONOMICS_KEY || '';
}

/**
 * Fetch calendar events from TradingEconomics
 */
async function fetchTECalendar(): Promise<CalendarEvent[]> {
  const apiKey = getTeApiKey();
  if (!apiKey) {
    throw new Error('RAPIDAPI_TRADING_ECONOMICS_KEY not configured');
  }

  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - 1);
  const end = new Date(today);
  end.setDate(today.getDate() + 7);

  const startDate = start.toISOString().split('T')[0];
  const endDate = end.toISOString().split('T')[0];

  const url = `${TE_CALENDAR_ENDPOINT}?country=all&importance=3,2,1&start_date=${startDate}&end_date=${endDate}`;

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'x-rapidapi-host': 'trading-econmics-scraper.p.rapidapi.com',
      'x-rapidapi-key': apiKey,
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('TradingEconomics rate limit (429)');
    }
    throw new Error(`TradingEconomics returned ${response.status}`);
  }

  const data: TECalendarEvent[] = await response.json();
  if (!Array.isArray(data)) {
    throw new Error('TradingEconomics returned invalid data');
  }

  return data.map((item) => ({
    date: item.date || '',
    time: item.time || '',
    currency: mapCountryToCurrency(item.country),
    impact: mapTeImportance(item.importance),
    event: item.event,
    actual: item.actual,
    forecast: item.forecast || '',
    previous: item.previous || '',
  }));
}

/**
 * Fetch calendar events with fallback
 */
async function fetchCalendarEvents(): Promise<{ events: CalendarEvent[]; unavailable: boolean }> {
  const apiKey = getTeApiKey();

  // Try TradingEconomics if API key is available
  if (apiKey) {
    try {
      console.log('[Calendar] Fetching from TradingEconomics...');
      const events = await fetchTECalendar();
      console.log(`[Calendar] Fetched ${events.length} events from TradingEconomics`);
      return { events, unavailable: false };
    } catch (err: any) {
      console.warn(`[Calendar] TradingEconomics failed: ${err.message}`);
    }
  } else {
    console.log('[Calendar] RAPIDAPI_TRADING_ECONOMICS_KEY not set, using fallback data');
  }

  // Fallback: Return empty with unavailable flag
  console.log('[Calendar] Using fallback (no data available)');
  return { events: [], unavailable: true };
}

export async function GET(request: NextRequest) {
  try {
    // Check cache
    if (calendarCache && Date.now() - calendarCache.timestamp < CACHE_DURATION) {
      console.log('[Calendar] Returning cached data');
      return NextResponse.json({
        success: true,
        cached: true,
        events: calendarCache.events,
        fetchedAt: new Date(calendarCache.timestamp).toISOString(),
        unavailable: calendarCache.unavailable || false,
        message: calendarCache.unavailable ? 'Data kalender ekonomi sedang tidak tersedia.' : undefined,
      });
    }

    // Fetch fresh data
    const { events, unavailable } = await fetchCalendarEvents();

    // Update cache
    calendarCache = {
      events,
      timestamp: Date.now(),
      unavailable,
    };

    return NextResponse.json({
      success: true,
      cached: false,
      events,
      fetchedAt: new Date().toISOString(),
      unavailable,
      message: unavailable ? 'Data kalender ekonomi sedang tidak tersedia.' : undefined,
    });
  } catch (error) {
    console.error('[Calendar] API error:', error);

    // Return cached data if available, even if expired
    if (calendarCache && calendarCache.events.length > 0) {
      return NextResponse.json({
        success: true,
        cached: true,
        expired: true,
        events: calendarCache.events,
        fetchedAt: new Date(calendarCache.timestamp).toISOString(),
        message: 'Menggunakan data cache (fresh data tidak tersedia)',
      });
    }

    // Return empty with unavailable flag
    return NextResponse.json({
      success: true,
      cached: false,
      events: [],
      fetchedAt: new Date().toISOString(),
      unavailable: true,
      message: 'Data kalender ekonomi sedang tidak tersedia. Silakan coba beberapa menit lagi.',
    });
  }
}