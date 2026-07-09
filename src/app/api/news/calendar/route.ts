import { NextResponse } from 'next/server';

// In-memory cache
let calendarCache: { items: CalendarEvent[]; timestamp: number } | null = null;
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

interface CalendarEvent {
  date: string;
  time: string;
  currency: string;
  impact: 'high' | 'medium' | 'low';
  event: string;
  forecast: string;
  previous: string;
  actual?: string;
}

function getCurrencyFlag(currency: string): string {
  const flags: Record<string, string> = {
    USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', JPY: '🇯🇵',
    AUD: '🇦🇺', NZD: '🇳🇿', CAD: '🇨🇦', CHF: '🇨🇭',
    CNY: '🇨🇳', IDR: '🇮🇩', SGD: '🇸🇬',
  };
  return flags[currency] || '🌐';
}

// ForexFactory JSON impact field values
function mapImpact(ffImpact: string): 'high' | 'medium' | 'low' {
  switch (ffImpact?.toLowerCase()) {
    case 'high': return 'high';
    case 'medium': return 'medium';
    case 'low': return 'low';
    case 'holiday': return 'low';
    default: return 'low';
  }
}

// ForexFactory JSON date format: "2026-07-05T21:00:00-04:00"
function formatDate(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[d.getMonth()]} ${d.getDate()}`;
  } catch {
    return '';
  }
}

function formatTime(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    let hours = d.getUTCHours();
    const minutes = d.getUTCMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  } catch {
    return '';
  }
}

/**
 * Fetch economic calendar from ForexFactory free JSON feed
 * Source: https://nfs.faireconomy.media/ff_calendar_thisweek.json
 * No API key needed, free, returns structured data
 */
async function fetchForexFactoryCalendar(): Promise<CalendarEvent[]> {
  const FF_CALENDAR_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';

  const response = await fetch(FF_CALENDAR_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; LuxTradeBot/1.0)',
      'Accept': 'application/json',
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`ForexFactory calendar returned ${response.status}`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error('ForexFactory returned unexpected data format');
  }

  // Map ForexFactory JSON to our CalendarEvent interface
  const events: CalendarEvent[] = data
    .filter((item: any) => item.title && item.country) // Skip items without essential data
    .map((item: any) => ({
      date: formatDate(item.date),
      time: formatTime(item.date),
      currency: item.country || '',
      impact: mapImpact(item.impact),
      event: item.title || '',
      forecast: item.forecast || '',
      previous: item.previous || '',
      actual: item.actual || undefined,
    }));

  console.log(`[Calendar] ForexFactory returned ${events.length} events`);
  return events;
}

/**
 * Sort events: by date group, then time, with high impact first within same time
 */
function sortEvents(events: CalendarEvent[]): CalendarEvent[] {
  const impactOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const currencyPriority: Record<string, number> = {
    USD: 0, EUR: 1, GBP: 2, JPY: 3, AUD: 4, CAD: 5, CHF: 6, NZD: 7, CNY: 8, IDR: 9,
  };

  return events.sort((a, b) => {
    const dateComp = (a.date || '').localeCompare(b.date || '');
    if (dateComp !== 0) return dateComp;

    const timeComp = (a.time || '').localeCompare(b.time || '');
    if (timeComp !== 0) return timeComp;

    const impactDiff = (impactOrder[a.impact] ?? 99) - (impactOrder[b.impact] ?? 99);
    if (impactDiff !== 0) return impactDiff;

    return (currencyPriority[a.currency] ?? 99) - (currencyPriority[b.currency] ?? 99);
  });
}

export async function GET() {
  try {
    // Return cached data if available
    if (calendarCache && Date.now() - calendarCache.timestamp < CACHE_DURATION) {
      return NextResponse.json({
        success: true,
        cached: true,
        events: calendarCache.items,
        flags: true,
        fetchedAt: new Date(calendarCache.timestamp).toISOString(),
      });
    }

    // Fetch from ForexFactory
    let events = await fetchForexFactoryCalendar();

    // Sort events
    events = sortEvents(events);

    // Limit to 60 events max, add currency flags
    const finalEvents = events.slice(0, 60).map(e => ({
      ...e,
      flag: getCurrencyFlag(e.currency),
    }));

    // Update cache
    calendarCache = { items: finalEvents, timestamp: Date.now() };

    return NextResponse.json({
      success: true,
      cached: false,
      events: finalEvents,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Calendar] API error:', error);

    // Return "unavailable" instead of fake data
    return NextResponse.json({
      success: true,
      fallback: true,
      unavailable: true,
      events: [],
      message: 'Data kalender ekonomi sedang tidak tersedia. Silakan coba beberapa menit lagi.',
      fetchedAt: new Date().toISOString(),
    });
  }
}