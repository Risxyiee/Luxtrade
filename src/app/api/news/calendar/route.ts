import { NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

// In-memory cache
let calendarCache: { items: CalendarEvent[]; timestamp: number } | null = null;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

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

function classifyEventImpact(event: string, currency: string): 'high' | 'medium' | 'low' {
  const text = event.toLowerCase();
  const high = [
    'interest rate', 'rate decision', 'fomc', 'nonfarm', 'nfp', 'payroll',
    'cpi', 'inflation', 'gdp', 'unemployment', 'employment',
    'monetary policy', 'central bank', 'fed ', 'ecb', 'boj', 'boe',
    'ppi', 'core cpi', 'retail sales', 'trade balance',
  ];
  const medium = [
    'pmi', 'manufacturing', 'services', 'consumer confidence',
    'adp', 'jobless', 'claims', 'housing', 'industrial production',
    'current account', 'budget', 'foreign investment',
  ];

  for (const kw of high) {
    if (text.includes(kw)) return 'high';
  }
  for (const kw of medium) {
    if (text.includes(kw)) return 'medium';
  }
  // Major currencies without specific keywords get medium
  if (['USD', 'EUR', 'GBP', 'JPY'].includes(currency)) return 'medium';
  return 'low';
}

export async function GET() {
  try {
    if (calendarCache && Date.now() - calendarCache.timestamp < CACHE_DURATION) {
      return NextResponse.json({
        success: true,
        cached: true,
        events: calendarCache.items,
        flags: true,
        fetchedAt: new Date(calendarCache.timestamp).toISOString(),
      });
    }

    const zai = await ZAI.create();

    const queries = [
      'forex economic calendar this week 2025',
      'economic calendar high impact events schedule',
      'forex news calendar NFP FOMC CPI schedule this week',
    ];

    const results = await Promise.allSettled(
      queries.map(q =>
        zai.functions.invoke('web_search', {
          query: q,
          num: 10,
          recency_days: 7,
        })
      )
    );

    // Extract structured events from search results
    const events: CalendarEvent[] = [];
    const seen = new Set<string>();

    for (const result of results) {
      if (result.status !== 'fulfilled' || !Array.isArray(result.value)) continue;

      for (const item of result.value) {
        const text = `${item.name || ''} ${item.snippet || ''}`;
        const lower = text.toLowerCase();

        // Try to extract date patterns from title/snippet
        const dayMatch = lower.match(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/);
        const dateMatch = text.match(/(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i);
        const timeMatch = text.match(/(\d{1,2}[:.]\d{2})\s*(am|pm|gmt|est|utc)/i);

        // Extract currency from text
        let currency = 'USD';
        const currencyMatch = text.match(/\b(USD|EUR|GBP|JPY|AUD|NZD|CAD|CHF|CNY|IDR)\b/i);

        if (!currencyMatch) continue; // Skip if no currency found
        currency = (currencyMatch[1] || 'USD').toUpperCase();

        // Extract event type
        let event = item.name || '';
        let impact = classifyEventImpact(event, currency);

        if (seen.has(event) || event.length < 10) continue;
        seen.add(event);

        events.push({
          date: dayMatch ? dayMatch[1].charAt(0).toUpperCase() + dayMatch[1].slice(1) : '',
          time: timeMatch ? timeMatch[1].toUpperCase() : '',
          currency: currency.toUpperCase(),
          impact,
          event: event.replace(/[^\w\s:()-]/g, '').trim(),
          forecast: '',
          previous: '',
        });
      }
    }

    // If no events found from search, generate from known weekly patterns
    if (events.length === 0) {
      const now = new Date();
      const weekEvents = generateWeeklyEvents(now);
      events.push(...weekEvents);
    }

    // Sort: high impact first, then by currency priority
    const currencyPriority = { USD: 0, EUR: 1, GBP: 2, JPY: 3, AUD: 4, CAD: 5, CHF: 6, NZD: 7 };
    events.sort((a, b) => {
      const impactOrder = { high: 0, medium: 1, low: 2 };
      const impactDiff = impactOrder[a.impact] - impactOrder[b.impact];
      if (impactDiff !== 0) return impactDiff;
      return (currencyPriority[a.currency] ?? 99) - (currencyPriority[b.currency] ?? 99);
    });

    // Limit and add flags
    const finalEvents = events.slice(0, 40).map(e => ({
      ...e,
      flag: getCurrencyFlag(e.currency),
    }));

    calendarCache = { items: finalEvents, timestamp: Date.now() };

    return NextResponse.json({
      success: true,
      cached: false,
      events: finalEvents,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Calendar API error:', error);

    // Fallback: generate from known patterns
    const fallbackEvents = generateWeeklyEvents(new Date()).map(e => ({
      ...e,
      flag: getCurrencyFlag(e.currency),
    }));

    return NextResponse.json({
      success: true,
      fallback: true,
      events: fallbackEvents,
      fetchedAt: new Date().toISOString(),
    });
  }
}

function generateWeeklyEvents(now: Date): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const today = now.getDay(); // 0=Sun
  const daysInWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Common weekly events with approximate schedules
  const weeklySchedule: Record<string, CalendarEvent[]> = {
    Monday: [
      { date: 'Monday', time: '', currency: 'EUR', impact: 'medium', event: 'EU Manufacturing PMI', forecast: '', previous: '' },
      { date: 'Monday', time: '', currency: 'GBP', impact: 'medium', event: 'UK Manufacturing PMI', forecast: '', previous: '' },
      { date: 'Monday', time: '', currency: 'USD', impact: 'low', event: 'US ISM Manufacturing PMI', forecast: '', previous: '' },
    ],
    Tuesday: [
      { date: 'Tuesday', time: '', currency: 'AUD', impact: 'medium', event: 'AU RBA Rate Decision', forecast: '', previous: '' },
      { date: 'Tuesday', time: '', currency: 'EUR', impact: 'medium', event: 'EU Services PMI', forecast: '', previous: '' },
      { date: 'Tuesday', time: '', currency: 'USD', impact: 'medium', event: 'US JOLTS Job Openings', forecast: '', previous: '' },
    ],
    Wednesday: [
      { date: 'Wednesday', time: '', currency: 'NZD', impact: 'medium', event: 'NZ GDP q/q', forecast: '', previous: '' },
      { date: 'Wednesday', time: '', currency: 'USD', impact: 'high', event: 'US ADP Nonfarm Employment', forecast: '', previous: '' },
      { date: 'Wednesday', time: '', currency: 'USD', impact: 'high', event: 'US FOMC Meeting Minutes', forecast: '', previous: '' },
    ],
    Thursday: [
      { date: 'Thursday', time: '', currency: 'EUR', impact: 'high', event: 'ECB Interest Rate Decision', forecast: '', previous: '' },
      { date: 'Thursday', time: '', currency: 'GBP', impact: 'medium', event: 'UK Services PMI', forecast: '', previous: '' },
      { date: 'Thursday', time: '', currency: 'USD', impact: 'high', event: 'US CPI (Consumer Price Index)', forecast: '', previous: '' },
      { date: 'Thursday', time: '', currency: 'USD', impact: 'medium', event: 'US Unemployment Claims', forecast: '', previous: '' },
    ],
    Friday: [
      { date: 'Friday', time: '', currency: 'JPY', impact: 'high', event: 'JPY BOJ Interest Rate Decision', forecast: '', previous: '' },
      { date: 'Friday', time: '', currency: 'USD', impact: 'high', event: 'US Nonfarm Payrolls (NFP)', forecast: '', previous: '' },
      { date: 'Friday', time: '', currency: 'USD', impact: 'high', event: 'US Unemployment Rate', forecast: '', previous: '' },
      { date: 'Friday', time: '', currency: 'GBP', impact: 'medium', event: 'UK GDP m/m', forecast: '', previous: '' },
      { date: 'Friday', time: '', currency: 'CAD', impact: 'medium', event: 'CA Employment Change', forecast: '', previous: '' },
    ],
  };

  // Return events for this week
  for (const [day, dayEvents] of Object.entries(weeklySchedule)) {
    const dayIndex = daysInWeek.indexOf(day);
    // Include past days too for reference
    events.push(...dayEvents.map(e => ({
      ...e,
      date: day,
    })));
  }

  return events;
}
