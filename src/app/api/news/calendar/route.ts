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

// Sample calendar events for when API is not available
const SAMPLE_EVENTS: CalendarEvent[] = [
  { date: 'Monday', time: '08:30', currency: 'USD', impact: 'high', event: 'US Non-Farm Payrolls', forecast: '200K', previous: '175K' },
  { date: 'Monday', time: '10:00', currency: 'EUR', impact: 'high', event: 'ECB Interest Rate Decision', forecast: '4.50%', previous: '4.50%' },
  { date: 'Monday', time: '14:00', currency: 'GBP', impact: 'medium', event: 'UK GDP m/m', forecast: '0.2%', previous: '0.1%' },
  { date: 'Tuesday', time: '03:00', currency: 'JPY', impact: 'medium', event: 'Japan Manufacturing PMI', forecast: '49.5', previous: '49.2' },
  { date: 'Tuesday', time: '08:30', currency: 'USD', impact: 'high', event: 'US CPI m/m', forecast: '0.3%', previous: '0.2%' },
  { date: 'Tuesday', time: '10:00', currency: 'AUD', impact: 'medium', event: 'Australia Employment Change', forecast: '20K', previous: '15K' },
  { date: 'Wednesday', time: '02:00', currency: 'CNY', impact: 'high', event: 'China CPI y/y', forecast: '0.5%', previous: '0.4%' },
  { date: 'Wednesday', time: '09:00', currency: 'EUR', impact: 'low', event: 'Germany Industrial Production m/m', forecast: '0.1%', previous: '-0.2%' },
  { date: 'Wednesday', time: '14:00', currency: 'USD', impact: 'high', event: 'US Retail Sales m/m', forecast: '0.4%', previous: '0.3%' },
  { date: 'Thursday', time: '08:30', currency: 'USD', impact: 'medium', event: 'US Initial Jobless Claims', forecast: '215K', previous: '210K' },
  { date: 'Thursday', time: '10:00', currency: 'CHF', impact: 'low', event: 'Switzerland Unemployment Rate', forecast: '2.2%', previous: '2.1%' },
  { date: 'Thursday', time: '15:00', currency: 'CAD', impact: 'high', event: 'Canada CPI m/m', forecast: '0.2%', previous: '0.1%' },
  { date: 'Friday', time: '02:00', currency: 'JPY', impact: 'medium', event: 'Japan PPI y/y', forecast: '2.5%', previous: '2.3%' },
  { date: 'Friday', time: '09:00', currency: 'EUR', impact: 'low', event: 'Eurozone Trade Balance', forecast: '15.0B', previous: '14.5B' },
  { date: 'Friday', time: '14:00', currency: 'USD', impact: 'high', event: 'US Consumer Sentiment', forecast: '72.0', previous: '70.5' },
]

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
    console.log('[Calendar] RAPIDAPI_TRADING_ECONOMICS_KEY not set, using sample data');
  }

  // Fallback: Return sample data
  console.log('[Calendar] Using sample calendar data');
  return { events: SAMPLE_EVENTS, unavailable: false };
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