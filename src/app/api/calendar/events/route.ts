import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

// In-memory cache
let cache: { events: CalendarEvent[]; timestamp: number } | null = null;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

interface CalendarEvent {
  id: string;
  title: string;
  country: string;
  date: string;
  time: string;
  impact: 'high' | 'medium' | 'low';
  forecast: string;
  previous: string;
  actual: string;
  category: string;
}

// Country flag emoji mapping
const countryFlags: Record<string, string> = {
  'us': '🇺🇸', 'usa': '🇺🇸', 'united states': '🇺🇸',
  'uk': '🇬🇧', 'gb': '🇬🇧', 'britain': '🇬🇧',
  'eu': '🇪🇺', 'eurozone': '🇪🇺', 'europe': '🇪🇺',
  'jp': '🇯🇵', 'japan': '🇯🇵',
  'au': '🇦🇺', 'australia': '🇦🇺',
  'ca': '🇨🇦', 'canada': '🇨🇦',
  'cn': '🇨🇳', 'china': '🇨🇳',
  'ch': '🇨🇭', 'switzerland': '🇨🇭',
  'nz': '🇳🇿', 'new zealand': '🇳🇿',
  'de': '🇩🇪', 'germany': '🇩🇪',
  'fr': '🇫🇷', 'france': '🇫🇷',
};

function getCountryFlag(text: string): string {
  const lower = text.toLowerCase();
  for (const [key, flag] of Object.entries(countryFlags)) {
    if (lower.includes(key)) return flag;
  }
  return '🌐';
}

function classifyImpact(title: string): 'high' | 'medium' | 'low' {
  const t = title.toLowerCase();
  const high = [
    'nonfarm', 'nfp', 'fomc', 'fed ', 'federal reserve',
    'interest rate', 'rate decision', 'cpi', 'inflation rate',
    'gdp', 'recession', 'ecb', 'boj', 'boe', 'bank of japan',
    'central bank', 'monetary policy', 'unemployment rate',
    'payroll', 'pce', 'core inflation', 'ppi',
    'retail sales', 'trade balance',
  ];
  const medium = [
    'pmi', 'manufacturing', 'consumer confidence',
    'adp', 'jobless claims', 'housing', 'building permits',
    'industrial production', 'trade', 'imports', 'exports',
    'core cpi', 'minutes',
  ];
  for (const kw of high) { if (t.includes(kw)) return 'high'; }
  for (const kw of medium) { if (t.includes(kw)) return 'medium'; }
  return 'low';
}

function categorize(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('rate') || t.includes('monetary') || t.includes('fomc') || t.includes('fed')) return 'Interest Rate';
  if (t.includes('cpi') || t.includes('inflation') || t.includes('ppi') || t.includes('pce')) return 'Inflation';
  if (t.includes('gdp') || t.includes('pmi') || t.includes('manufacturing') || t.includes('industrial')) return 'Growth';
  if (t.includes('employment') || t.includes('unemployment') || t.includes('payroll') || t.includes('jobs') || t.includes('claims')) return 'Employment';
  if (t.includes('retail') || t.includes('consumer')) return 'Consumer';
  if (t.includes('trade') || t.includes('imports') || t.includes('exports') || t.includes('balance')) return 'Trade';
  return 'Other';
}

function extractCountry(text: string): string {
  // Try to extract country from the beginning of the text
  const patterns = [
    /\b(US|USA|United States)\b/i,
    /\b(UK|GB|Britain|United Kingdom)\b/i,
    /\b(EU|Eurozone|EMU)\b/i,
    /\b(JP|Japan)\b/i,
    /\b(AU|Australia)\b/i,
    /\b(CA|Canada)\b/i,
    /\b(CN|China)\b/i,
    /\b(CH|Switzerland)\b/i,
    /\b(NZ|New Zealand)\b/i,
    /\b(DE|Germany)\b/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].toUpperCase();
  }
  return 'GLOBAL';
}

async function fetchCalendarEvents(): Promise<CalendarEvent[]> {
  const zai = await ZAI.create();

  const queries = [
    'forex economic calendar this week high impact events 2025',
    'economic calendar schedule central bank meetings interest rate decisions',
    'forex economic calendar NFP CPI GDP FOMC schedule this week',
  ];

  const results = await Promise.allSettled(
    queries.map(q => zai.functions.invoke('web_search', { query: q, num: 10, recency_days: 7 }))
  );

  const seen = new Set<string>();
  const events: CalendarEvent[] = [];

  for (const result of results) {
    if (result.status !== 'fulfilled' || !Array.isArray(result.value)) continue;
    for (const item of result.value) {
      if (!item?.name || seen.has(item.name)) continue;
      seen.add(item.name);

      const title = item.name;
      const snippet = item.snippet || '';

      events.push({
        id: Buffer.from(title).toString('base64url').slice(0, 20),
        title,
        country: extractCountry(`${title} ${snippet} ${item.host_name || ''}`),
        date: item.date || '',
        time: '',
        impact: classifyImpact(title),
        forecast: '',
        previous: '',
        actual: '',
        category: categorize(title),
      });
    }
  }

  // Sort: high impact first, then by date
  events.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    const diff = order[a.impact] - order[b.impact];
    if (diff !== 0) return diff;
    if (a.date && b.date) return new Date(b.date).getTime() - new Date(a.date).getTime();
    return 0;
  });

  return events;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get('refresh') === 'true';

  try {
    if (!forceRefresh && cache && Date.now() - cache.timestamp < CACHE_DURATION) {
      return NextResponse.json({
        success: true,
        cached: true,
        events: cache.events,
        fetchedAt: new Date(cache.timestamp).toISOString(),
      });
    }

    const events = await fetchCalendarEvents();
    cache = { events, timestamp: Date.now() };

    const high = events.filter(e => e.impact === 'high').length;
    const medium = events.filter(e => e.impact === 'medium').length;
    const low = events.filter(e => e.impact === 'low').length;

    return NextResponse.json({
      success: true,
      cached: false,
      events,
      fetchedAt: new Date().toISOString(),
      summary: { total: events.length, high, medium, low },
    });
  } catch (error) {
    console.error('Calendar API error:', error);
    return NextResponse.json({
      success: true,
      fallback: true,
      events: [],
      fetchedAt: new Date().toISOString(),
      error: 'Failed to fetch economic calendar',
    });
  }
}
