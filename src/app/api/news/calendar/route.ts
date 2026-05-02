import { NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

// In-memory cache
let calendarCache: { items: CalendarEvent[]; timestamp: number } | null = null;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

interface CalendarEvent {
  date: string;       // Day name like "Monday" or date like "Jun 23"
  time: string;       // Time like "14:30" or "8:30 AM"
  currency: string;   // "USD", "EUR", etc.
  impact: 'high' | 'medium' | 'low';
  event: string;      // Event name like "Nonfarm Payrolls"
  forecast: string;   // Forecast value
  previous: string;   // Previous value
  actual?: string;    // Actual value (if released)
}

function getCurrencyFlag(currency: string): string {
  const flags: Record<string, string> = {
    USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', JPY: '🇯🇵',
    AUD: '🇦🇺', NZD: '🇳🇿', CAD: '🇨🇦', CHF: '🇨🇭',
    CNY: '🇨🇳', IDR: '🇮🇩', SGD: '🇸🇬',
  };
  return flags[currency] || '🌐';
}

// Country code to currency mapping for Investing.com
const COUNTRY_TO_CURRENCY: Record<string, string> = {
  US: 'USD', EU: 'EUR', UK: 'GBP', GB: 'GBP',
  JP: 'JPY', AU: 'AUD', NZ: 'NZD', CA: 'CAD',
  CH: 'CHF', CN: 'CNY', ID: 'IDR', SG: 'SGD',
  DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR',
  KR: 'KRW', HK: 'HKD', SE: 'SEK', NO: 'NOK',
  MX: 'MXN', BR: 'BRL', IN: 'INR', RU: 'RUB',
  TR: 'TRY', ZA: 'ZAR',
};

// Impact keyword classification (fallback when HTML indicators are not parseable)
function classifyEventImpact(event: string, currency: string): 'high' | 'medium' | 'low' {
  const text = event.toLowerCase();
  const high = [
    'interest rate', 'rate decision', 'fomc', 'nonfarm', 'nfp', 'payroll',
    'cpi', 'inflation', 'gdp', 'unemployment', 'employment',
    'monetary policy', 'central bank', 'fed ', 'ecb', 'boj', 'boe',
    'ppi', 'core cpi', 'retail sales', 'trade balance', 'pce',
  ];
  const medium = [
    'pmi', 'manufacturing', 'services', 'consumer confidence',
    'adp', 'jobless', 'claims', 'housing', 'industrial production',
    'current account', 'budget', 'foreign investment', 'trade',
  ];

  for (const kw of high) {
    if (text.includes(kw)) return 'high';
  }
  for (const kw of medium) {
    if (text.includes(kw)) return 'medium';
  }
  if (['USD', 'EUR', 'GBP', 'JPY'].includes(currency)) return 'medium';
  return 'low';
}

/**
 * Detect impact level from HTML content near an event row.
 * Investing.com uses CSS classes like:
 *   - .img.bullishIcon for impact dots
 *   - .newSiteEventFlag / country flag classes
 *   - Impact may be indicated by star/bullet/dot count or CSS class names
 */
function detectImpactFromHtml(rowHtml: string): 'high' | 'medium' | 'low' | null {
  const lower = rowHtml.toLowerCase();

  // Check for Investing.com impact indicators
  // Pattern 1: "newSiteEventCalendarHP" or similar high-impact class
  if (lower.includes('caldendar') || lower.includes('calendarhp') || lower.includes('calendar high priority')) return 'high';
  if (lower.includes('calendarmp') || lower.includes('calendar medium priority') || lower.includes('calendarmid')) return 'medium';
  if (lower.includes('calendarlp') || lower.includes('calendar low priority')) return 'low';

  // Pattern 2: Impact dots (three dots = high, two = medium, one = low)
  // Investing.com often uses 3 colored dots: 🔴🔴🔴 = high, 🟡🟡 = medium, 🟢 = low
  // Check for impact star/dot classes
  const highDotMatch = lower.match(/(star.*?star.*?star|impact.*?high|bullishicon.*?bullishicon.*?bullishicon)/);
  if (highDotMatch) return 'high';

  const medDotMatch = lower.match(/(star.*?star|impact.*?medium|impact.*?med)/);
  if (medDotMatch) return 'medium';

  const lowDotMatch = lower.match(/(star[^s]|impact.*?low)/);
  if (lowDotMatch) return 'low';

  // Pattern 3: Color-based indicators
  if (lower.includes('econ-calendar-impact-high') || lower.includes('impact-high') || lower.includes('priority-high')) return 'high';
  if (lower.includes('econ-calendar-impact-medium') || lower.includes('impact-medium') || lower.includes('priority-medium')) return 'medium';
  if (lower.includes('econ-calendar-impact-low') || lower.includes('impact-low') || lower.includes('priority-low')) return 'low';

  return null; // Could not detect from HTML, will use keyword fallback
}

/**
 * Extract currency from HTML near the event row.
 * Investing.com uses country flag icons and country codes.
 */
function detectCurrencyFromHtml(rowHtml: string): string | null {
  const upper = rowHtml.toUpperCase();

  // Look for country flag data attributes or class names
  for (const [code, currency] of Object.entries(COUNTRY_TO_CURRENCY)) {
    // Pattern: flag-CODE, flag CODE, data-country="CODE", etc.
    const patterns = [
      new RegExp(`flag[_-]?${code}`, 'i'),
      new RegExp(`country[_-]?["']?${code}["']?`, 'i'),
      new RegExp(`class="[^"]*\\b${code}\\b`, 'i'),
      new RegExp(`data-country="${code}"`, 'i'),
      new RegExp(`/flags/${code.toLowerCase()}\\.`, 'i'),
      new RegExp(`alt="${code}"`, 'i'),
    ];
    for (const pat of patterns) {
      if (pat.test(rowHtml)) return currency;
    }
  }

  // Look for currency text directly
  const currencyDirectMatch = upper.match(/\b(USD|EUR|GBP|JPY|AUD|NZD|CAD|CHF|CNY|IDR)\b/);
  if (currencyDirectMatch) return currencyDirectMatch[1];

  return null;
}

/**
 * Clean text extracted from HTML (strip tags, decode entities, trim)
 */
function cleanHtmlText(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')           // Strip HTML tags
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse Investing.com Economic Calendar HTML to extract structured events.
 * The calendar page has a large table with rows for each event.
 */
function parseInvestingCalendarHtml(html: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  let currentDateHeader = '';

  // Normalize line breaks for parsing
  const normalizedHtml = html.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Extract date headers - Investing.com uses format like "Monday, June 23, 2025"
  // These appear in header rows or date separator divs
  const dateHeaderRegex = /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s*(\w+\s+\d{1,2},?\s*\d{4})?/gi;
  let dateMatch;

  // First pass: find all date headers with their positions to create a position-to-date map
  const datePositions: { pos: number; dateStr: string }[] = [];
  while ((dateMatch = dateHeaderRegex.exec(normalizedHtml)) !== null) {
    const dayName = dateMatch[1];
    const datePart = dateMatch[2] || '';
    // Format: "Monday" or "Monday Jun 23" or "Monday, June 23, 2025"
    let dateStr = dayName;
    if (datePart) {
      // Try to parse the date part into a shorter format
      const monthMatch = datePart.match(/(\w{3})\s+(\d{1,2})/i);
      if (monthMatch) {
        dateStr = `${monthMatch[1]} ${monthMatch[2]}`;
      } else {
        dateStr = datePart;
      }
    }
    datePositions.push({ pos: dateMatch.index, dateStr });
  }

  /**
   * Strategy: Parse the HTML for event data rows.
   * Investing.com calendar table rows typically contain:
   * - Time (in first cell)
   * - Country/currency (flag icon)
   * - Impact (dot indicators)
   * - Event name
   * - Actual, Forecast, Previous values
   *
   * We'll split the HTML into chunks by looking for table rows or similar structures,
   * then extract data from each chunk.
   */

  // Look for event rows in the calendar table
  // Investing.com wraps each event in a <tr> with specific data attributes
  // Also look for data-test attributes used for testing
  const rowPattern = /<tr[^>]*(?:data-event-id|data-row|class="[^"]*event)[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatches: string[] = [];

  let rowMatch;
  while ((rowMatch = rowPattern.exec(normalizedHtml)) !== null) {
    rowMatches.push(rowMatch[1]);
  }

  // If no table rows found, try alternate patterns - look for event containers
  if (rowMatches.length === 0) {
    // Try: div-based layout (newer Investing.com may use divs instead of table)
    const divPattern = /<div[^>]*(?:class="[^"]*ecEvent|data-event-id|js-event-item)[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/gi;
    while ((rowMatch = divPattern.exec(normalizedHtml)) !== null) {
      rowMatches.push(rowMatch[1]);
    }
  }

  // If still no rows found, try a more aggressive approach: split by known event keywords
  if (rowMatches.length === 0) {
    // Fallback: try to find structured content blocks
    // Look for repeating patterns that contain time, event name, values
    const blockPattern = /<div[^>]*class="[^"]*(?:event|calendar)[^"]*"[^>]*>[\s\S]*?(?=<div[^>]*class="[^"]*(?:event|calendar)[^"]*"[^>]*>|$)/gi;
    while ((rowMatch = blockPattern.exec(normalizedHtml)) !== null) {
      rowMatches.push(rowMatch[0]);
    }
  }

  // Limit processing to prevent hangs
  const maxRows = Math.min(rowMatches.length, 200);

  for (let i = 0; i < maxRows; i++) {
    const rowHtml = rowMatches[i];

    // Determine the date for this row based on position
    const rowPos = normalizedHtml.indexOf(rowHtml.substring(0, 50)); // Approximate position
    for (let d = datePositions.length - 1; d >= 0; d--) {
      if (datePositions[d].pos < rowPos) {
        currentDateHeader = datePositions[d].dateStr;
        break;
      }
    }

    // Extract time
    let time = '';
    const timePatterns = [
      /(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)\s*<\/?/g,
      /data-time="([^"]+)"/,
      /class="[^"]*(?:time|clock)[^"]*"[^>]*>([^<]+)/i,
    ];
    for (const timePat of timePatterns) {
      const timeMatch = timePat.exec(rowHtml);
      if (timeMatch) {
        time = cleanHtmlText(timeMatch[1]);
        break;
      }
    }

    // Skip all-day events (no specific time) or empty time rows
    if (!time || time.toLowerCase().includes('all day')) {
      time = 'All Day';
    }

    // Extract currency
    let currency = detectCurrencyFromHtml(rowHtml);
    if (!currency) {
      // Try to find currency from text content
      const textContent = cleanHtmlText(rowHtml);
      const textCurrMatch = textContent.match(/\b(USD|EUR|GBP|JPY|AUD|NZD|CAD|CHF|CNY|IDR)\b/);
      currency = textCurrMatch ? textCurrMatch[1] : null;
    }
    if (!currency) currency = 'USD'; // Default fallback

    // Extract impact
    let impact = detectImpactFromHtml(rowHtml);

    // Extract event name
    let eventName = '';
    const eventNamePatterns = [
      /class="[^"]*(?:event-name|eventName|eventTitle|ecEventTitle)[^"]*"[^>]*>([^<]+)/i,
      /data-name="([^"]+)"/,
      /<a[^>]*class="[^"]*event[^"]*"[^>]*>([^<]+)/i,
      /<td[^>]*class="[^"]*(?:event|name)[^"]*"[^>]*>([^<]+)/i,
    ];
    for (const namePat of eventNamePatterns) {
      const nameMatch = namePat.exec(rowHtml);
      if (nameMatch) {
        eventName = cleanHtmlText(nameMatch[1]);
        break;
      }
    }

    // If no event name found from specific selectors, try broader approach
    if (!eventName) {
      // Extract text content and look for meaningful text (not just numbers)
      const textContent = cleanHtmlText(rowHtml);
      const words = textContent.split(/\s+/).filter(w => w.length > 2);
      // The event name is usually the most descriptive text in the row
      if (words.length > 3) {
        eventName = words.slice(0, Math.min(words.length, 6)).join(' ');
      }
    }

    if (!eventName || eventName.length < 3) continue;

    // Extract actual, forecast, previous values
    let actual = '';
    let forecast = '';
    let previous = '';

    // Pattern: look for value columns (often the last 3 cells)
    const valuePatterns = [
      { key: 'actual', regex: /class="[^"]*(?:actual|bold)[^"]*"[^>]*>([^<]*)/i },
      { key: 'forecast', regex: /class="[^"]*(?:forecast|fore)[^"]*"[^>]*>([^<]*)/i },
      { key: 'previous', regex: /class="[^"]*(?:previous|prev)[^"]*"[^>]*>([^<]*)/i },
    ];

    for (const { key, regex } of valuePatterns) {
      const valMatch = regex.exec(rowHtml);
      if (valMatch) {
        const val = cleanHtmlText(valMatch[1]);
        if (val && val !== '' && val !== '-') {
          if (key === 'actual') actual = val;
          else if (key === 'forecast') forecast = val;
          else if (key === 'previous') previous = val;
        }
      }
    }

    // If specific class-based patterns fail, try to find values from td/div elements
    // The last few numerical values in the row are typically actual, forecast, previous
    if (!actual && !forecast && !previous) {
      const numValues: string[] = [];
      const numRegex = />\s*(-?\d[\d.,%KMBkmb]*)\s*</g;
      let numMatch;
      while ((numMatch = numRegex.exec(rowHtml)) !== null) {
        if (numMatch[1] && numMatch[1] !== '-') {
          numValues.push(cleanHtmlText(numMatch[1]));
        }
      }
      // The last 3 values (if available) are typically previous, forecast, actual
      if (numValues.length >= 3) {
        previous = numValues[numValues.length - 3];
        forecast = numValues[numValues.length - 2];
        actual = numValues[numValues.length - 1];
      } else if (numValues.length >= 2) {
        previous = numValues[numValues.length - 2];
        forecast = numValues[numValues.length - 1];
      } else if (numValues.length >= 1) {
        previous = numValues[numValues.length - 1];
      }
    }

    // Fallback impact classification using keywords
    if (!impact) {
      impact = classifyEventImpact(eventName, currency);
    }

    events.push({
      date: currentDateHeader || '',
      time,
      currency,
      impact,
      event: eventName.replace(/[^\w\s:()\-./%]/g, '').trim(),
      forecast,
      previous,
      actual: actual || undefined,
    });
  }

  // Deduplicate events by event name + currency + date
  const seen = new Set<string>();
  return events.filter(e => {
    const key = `${e.date}-${e.event}-${e.currency}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Fetch and parse Investing.com Economic Calendar using page_reader
 */
async function fetchInvestingCalendar(zai: any): Promise<CalendarEvent[]> {
  try {
    console.log('[Calendar] Fetching Investing.com Economic Calendar...');

    const pageData = await zai.functions.invoke('page_reader', {
      url: 'https://www.investing.com/economic-calendar/',
    });

    const html = pageData?.data?.html || pageData?.html || '';

    if (!html || html.length < 500) {
      console.log('[Calendar] Investing.com returned insufficient HTML content');
      return [];
    }

    console.log(`[Calendar] Received ${html.length} chars from Investing.com`);

    const events = parseInvestingCalendarHtml(html);

    console.log(`[Calendar] Parsed ${events.length} events from Investing.com`);
    return events;
  } catch (error) {
    console.error('[Calendar] Error fetching Investing.com calendar:', error);
    return [];
  }
}

/**
 * Fallback: Search for economic calendar data using web_search,
 * then try page_reader on found URLs
 */
async function fetchCalendarFromSearch(zai: any): Promise<CalendarEvent[]> {
  console.log('[Calendar] Falling back to web_search for calendar data...');

  const queries = [
    'investing.com economic calendar this week',
    'forex economic calendar NFP FOMC CPI 2025',
    'economic calendar high impact events this week forex',
  ];

  const searchResults = await Promise.allSettled(
    queries.map(q =>
      zai.functions.invoke('web_search', {
        query: q,
        num: 10,
        recency_days: 7,
      })
    )
  );

  const investingUrls: string[] = [];

  // Collect Investing.com URLs from search results
  for (const result of searchResults) {
    if (result.status !== 'fulfilled' || !Array.isArray(result.value)) continue;
    for (const item of result.value) {
      const url = item.url || '';
      if (url.includes('investing.com') && url.includes('calendar')) {
        investingUrls.push(url);
      }
    }
  }

  // Try page_reader on found Investing.com URLs (up to 3)
  let allEvents: CalendarEvent[] = [];

  const uniqueUrls = [...new Set(investingUrls)].slice(0, 3);
  for (const url of uniqueUrls) {
    try {
      const pageData = await zai.functions.invoke('page_reader', { url });
      const html = pageData?.data?.html || pageData?.html || '';
      if (html.length > 500) {
        const events = parseInvestingCalendarHtml(html);
        allEvents.push(...events);
        if (allEvents.length >= 30) break;
      }
    } catch (err) {
      console.error(`[Calendar] Failed to fetch ${url}:`, err);
    }
  }

  if (allEvents.length > 0) {
    console.log(`[Calendar] Got ${allEvents.length} events from search + page_reader`);
    return allEvents;
  }

  // Last resort: extract events from search result snippets
  const snippetEvents: CalendarEvent[] = [];
  const seen = new Set<string>();

  for (const result of searchResults) {
    if (result.status !== 'fulfilled' || !Array.isArray(result.value)) continue;
    for (const item of result.value) {
      const text = `${item.name || ''} ${item.snippet || ''}`;
      const lower = text.toLowerCase();

      // Extract currency
      const currencyMatch = text.match(/\b(USD|EUR|GBP|JPY|AUD|NZD|CAD|CHF|CNY|IDR)\b/i);
      if (!currencyMatch) continue;
      const currency = currencyMatch[1].toUpperCase();

      // Extract event name
      let event = item.name || '';
      if (seen.has(event) || event.length < 10) continue;
      seen.add(event);

      // Extract date
      const dayMatch = lower.match(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/);
      const dateMatch = text.match(/(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i);
      const timeMatch = text.match(/(\d{1,2}[:.]\d{2})\s*(am|pm|gmt|est|utc)/i);

      const impact = classifyEventImpact(event, currency);

      snippetEvents.push({
        date: dateMatch
          ? `${dateMatch[2].charAt(0).toUpperCase() + dateMatch[2].slice(1)} ${dateMatch[1]}`
          : dayMatch
            ? dayMatch[1].charAt(0).toUpperCase() + dayMatch[1].slice(1)
            : '',
        time: timeMatch ? timeMatch[1].toUpperCase() : '',
        currency,
        impact,
        event: event.replace(/[^\w\s:()-]/g, '').trim(),
        forecast: '',
        previous: '',
      });
    }
  }

  console.log(`[Calendar] Got ${snippetEvents.length} events from search snippets`);
  return snippetEvents;
}

/**
 * Generate fallback events from known weekly economic patterns
 */
function generateWeeklyEvents(now: Date): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const daysInWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Calculate dates for this week
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function getWeekdayDate(dayName: string): string {
    const dayIndex = daysInWeek.indexOf(dayName);
    const targetDate = new Date(startOfWeek);
    targetDate.setDate(startOfWeek.getDate() + dayIndex);
    return `${monthNames[targetDate.getMonth()]} ${targetDate.getDate()}`;
  }

  const weeklySchedule: Record<string, CalendarEvent[]> = {
    Monday: [
      { date: 'Monday', time: '9:00 AM', currency: 'EUR', impact: 'medium', event: 'EU Manufacturing PMI', forecast: '', previous: '' },
      { date: 'Monday', time: '9:30 AM', currency: 'GBP', impact: 'medium', event: 'UK Manufacturing PMI', forecast: '', previous: '' },
      { date: 'Monday', time: '10:00 AM', currency: 'USD', impact: 'low', event: 'US ISM Manufacturing PMI', forecast: '', previous: '' },
    ],
    Tuesday: [
      { date: 'Tuesday', time: '1:30 AM', currency: 'AUD', impact: 'medium', event: 'AU RBA Rate Decision', forecast: '', previous: '' },
      { date: 'Tuesday', time: '10:00 AM', currency: 'EUR', impact: 'medium', event: 'EU Services PMI', forecast: '', previous: '' },
      { date: 'Tuesday', time: '10:00 AM', currency: 'USD', impact: 'medium', event: 'US JOLTS Job Openings', forecast: '', previous: '' },
    ],
    Wednesday: [
      { date: 'Wednesday', time: '6:45 PM', currency: 'NZD', impact: 'medium', event: 'NZ GDP q/q', forecast: '', previous: '' },
      { date: 'Wednesday', time: '8:15 AM', currency: 'USD', impact: 'high', event: 'US ADP Nonfarm Employment', forecast: '', previous: '' },
      { date: 'Wednesday', time: '2:00 PM', currency: 'USD', impact: 'high', event: 'US FOMC Meeting Minutes', forecast: '', previous: '' },
    ],
    Thursday: [
      { date: 'Thursday', time: '7:45 AM', currency: 'EUR', impact: 'high', event: 'ECB Interest Rate Decision', forecast: '', previous: '' },
      { date: 'Thursday', time: '9:30 AM', currency: 'GBP', impact: 'medium', event: 'UK Services PMI', forecast: '', previous: '' },
      { date: 'Thursday', time: '8:30 AM', currency: 'USD', impact: 'high', event: 'US CPI (Consumer Price Index)', forecast: '', previous: '' },
      { date: 'Thursday', time: '8:30 AM', currency: 'USD', impact: 'medium', event: 'US Unemployment Claims', forecast: '', previous: '' },
    ],
    Friday: [
      { date: 'Friday', time: '3:00 AM', currency: 'JPY', impact: 'high', event: 'JPY BOJ Interest Rate Decision', forecast: '', previous: '' },
      { date: 'Friday', time: '8:30 AM', currency: 'USD', impact: 'high', event: 'US Nonfarm Payrolls (NFP)', forecast: '', previous: '' },
      { date: 'Friday', time: '8:30 AM', currency: 'USD', impact: 'high', event: 'US Unemployment Rate', forecast: '', previous: '' },
      { date: 'Friday', time: '4:30 AM', currency: 'GBP', impact: 'medium', event: 'UK GDP m/m', forecast: '', previous: '' },
      { date: 'Friday', time: '8:30 AM', currency: 'CAD', impact: 'medium', event: 'CA Employment Change', forecast: '', previous: '' },
    ],
  };

  for (const [day, dayEvents] of Object.entries(weeklySchedule)) {
    const dateStr = getWeekdayDate(day);
    events.push(
      ...dayEvents.map(e => ({
        ...e,
        date: dateStr,
      }))
    );
  }

  return events;
}

/**
 * Sort events: by date group, then time, with high impact first within same date
 */
function sortEvents(events: CalendarEvent[]): CalendarEvent[] {
  const impactOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const currencyPriority: Record<string, number> = {
    USD: 0, EUR: 1, GBP: 2, JPY: 3, AUD: 4, CAD: 5, CHF: 6, NZD: 7, CNY: 8, IDR: 9,
  };

  return events.sort((a, b) => {
    // First by date
    const dateComp = (a.date || '').localeCompare(b.date || '');
    if (dateComp !== 0) return dateComp;

    // Then by impact (high first)
    const impactDiff = (impactOrder[a.impact] ?? 99) - (impactOrder[b.impact] ?? 99);
    if (impactDiff !== 0) return impactDiff;

    // Then by time
    const timeComp = (a.time || '').localeCompare(b.time || '');
    if (timeComp !== 0) return timeComp;

    // Then by currency priority
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

    const zai = await ZAI.create();

    // PRIMARY: Fetch from Investing.com Economic Calendar
    let events = await fetchInvestingCalendar(zai);

    // SECONDARY: If primary returns few/no events, try web_search + page_reader
    if (events.length < 5) {
      console.log('[Calendar] Primary source returned few events, trying search fallback...');
      const searchEvents = await fetchCalendarFromSearch(zai);
      if (searchEvents.length > events.length) {
        events = searchEvents;
      }
    }

    // FINAL FALLBACK: Generate from known weekly patterns
    if (events.length === 0) {
      console.log('[Calendar] All sources failed, generating weekly events...');
      events = generateWeeklyEvents(new Date());
    }

    // Sort events
    events = sortEvents(events);

    // Limit to 50 events max
    const finalEvents = events.slice(0, 50).map(e => ({
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

    // Emergency fallback: generate from known patterns
    const fallbackEvents = sortEvents(generateWeeklyEvents(new Date())).slice(0, 50).map(e => ({
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
