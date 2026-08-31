import { NextRequest, NextResponse } from 'next/server';

// In-memory cache
let fullNewsCache: { items: FullNewsItem[]; timestamp: number } | null = null;
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

// TradingEconomics RapidAPI config
const TE_API_HOST = 'trading-econmics-scraper.p.rapidapi.com';
const TE_ENDPOINT = 'https://trading-econmics-scraper.p.rapidapi.com/get_trading_economics_news';

// Lazy-read API key at request time (CF Workers env vars not available at module load)
function getTeApiKey(): string {
  return process.env.RAPIDAPI_TRADING_ECONOMICS_KEY || '';
}

interface FullNewsItem {
  title: string;
  source: string;
  url: string;
  snippet: string;
  date: string;
  type: 'high' | 'medium' | 'low';
}

// Wider type for ticker items (includes tips)
interface TickerItem {
  text: string;
  type: 'high' | 'medium' | 'low' | 'tip';
  url: string;
}

/**
 * Map TradingEconomics importance (1/2/3) to our type
 */
function mapTeImportance(importance: string): 'high' | 'medium' | 'low' {
  switch (importance) {
    case '3': return 'high';
    case '2': return 'medium';
    default: return 'low';
  }
}

/**
 * Classify impact level based on title and snippet keywords (for RSS fallback)
 */
function classifyImpact(title: string, snippet: string): 'high' | 'medium' | 'low' {
  const text = `${title} ${snippet}`.toLowerCase();

  const highKeywords = [
    'nfp', 'nonfarm', 'non-farm', 'fomc', 'fed ', 'federal reserve',
    'interest rate decision', 'rate hike', 'rate cut', 'cpi', 'inflation',
    'gdp', 'recession', 'ecb', 'boj', 'bank of japan', 'boe',
    'central bank', 'monetary policy', 'quantitative easing',
    'unemployment', 'payroll', 'pce', 'core inflation',
    'flash crash', 'market crash', 'rally', 'surge',
    'brexit', 'trade war', 'sanctions', 'opec',
    'rate decision', 'policy rate', 'hawkish', 'dovish',
    'tariff', 'geopolitical', 'iran', 'war',
    'breaking', 'urgent', 'record high', 'record low',
    'oil rises', 'oil climbs', 'oil surges', 'oil jumps',
    'gold rises', 'gold climbs', 'gold surges',
    'strikes', 'escalat', 'ceasefire', 'hormuz',
  ];

  const mediumKeywords = [
    'pmi', 'manufacturing', 'retail sales', 'consumer confidence',
    'adp', 'jobless claims', 'housing', 'trade balance',
    'oil', 'gold', 'forex', 'dollar', 'euro', 'yen', 'pound', 'sterling',
    'technical analysis', 'support', 'resistance',
    'eur/usd', 'gbp/usd', 'usd/jpy', 'xau/usd', 'aud/usd', 'usd/cad',
    'economic calendar', 'economic data', 'forecast',
    'currency', 'exchange rate', 'fx', 'pip',
    'trading', 'trader', 'strategy', 'outlook',
    'weekly preview', 'daily outlook', 'market wrap',
    'ppi', 'retail', 'bond', 'yield', 'treasury',
    'rupee', 'yuan', 'won', 'copper', 'commodity',
  ];

  for (const kw of highKeywords) {
    if (text.includes(kw)) return 'high';
  }
  for (const kw of mediumKeywords) {
    if (text.includes(kw)) return 'medium';
  }
  return 'low';
}

// ==================== PRIMARY: TradingEconomics RapidAPI ====================

interface TEResponse {
  title: string;
  description: string;
  url: string;
  country: string;
  category: string;
  importance: string;
  date: string;
  time: string;
}

/**
 * Fetch today's news from TradingEconomics via RapidAPI
 */
async function fetchTradingEconomicsNews(): Promise<FullNewsItem[]> {
  const apiKey = getTeApiKey();
  if (!apiKey) {
    throw new Error('RAPIDAPI_TRADING_ECONOMICS_KEY not configured');
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();

  const url = `${TE_ENDPOINT}?year=${year}&month=${month}&day=${day}`;

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'x-rapidapi-host': TE_API_HOST,
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

  const data: TEResponse[] = await response.json();
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('TradingEconomics returned empty data');
  }

  const items: FullNewsItem[] = data
    .filter((item) => item.title && item.url)
    .map((item) => ({
      title: item.title,
      source: `TradingEconomics · ${item.country || 'Global'}`,
      url: item.url,
      snippet: (item.description || '').substring(0, 200) + ((item.description || '').length > 200 ? '...' : ''),
      date: item.date && item.time ? `${item.date}T${item.time}` : new Date().toISOString(),
      type: mapTeImportance(item.importance),
    }));

  // Sort by importance (high→low), then by date (newest)
  const importanceOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  items.sort((a, b) => {
    const aImp = importanceOrder[a.type] ?? 99;
    const bImp = importanceOrder[b.type] ?? 99;
    if (aImp !== bImp) return aImp - bImp;
    return b.date.localeCompare(a.date);
  });

  console.log(`[News] TradingEconomics returned ${items.length} articles`);
  return items;
}

// ==================== RSS FALLBACKS ====================

/**
 * Parse RSS XML and convert to FullNewsItem[]
 * Handles both CDATA and plain text, multiple RSS formats
 */
function parseRssXml(xml: string, sourceName: string): FullNewsItem[] {
  const items: FullNewsItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];

    // Try CDATA first, then plain text
    const titleMatch = itemXml.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i)
      || itemXml.match(/<title>([\s\S]*?)<\/title>/i);
    const linkMatch = itemXml.match(/<link><!\[CDATA\[([\s\S]*?)\]\]><\/link>/i)
      || itemXml.match(/<link>([\s\S]*?)<\/link>/i);
    const descMatch = itemXml.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i)
      || itemXml.match(/<description>([\s\S]*?)<\/description>/i);
    const dateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);

    if (!titleMatch?.[1] || !linkMatch?.[1]) continue;

    const title = titleMatch[1].trim();
    const url = linkMatch[1].trim();

    // Skip non-news items
    if (url.includes('/news/videos/')) continue;
    if (url.includes('/news/audio/')) continue;

    let snippet = descMatch?.[1]?.trim() || '';
    snippet = snippet.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
    if (snippet.length > 200) snippet = snippet.substring(0, 200) + '...';

    const date = dateMatch?.[1] || new Date().toISOString();
    const type = classifyImpact(title, snippet);

    items.push({ title, source: sourceName, url, snippet, date, type });
  }

  return items;
}

// RSS source list — try multiple, return first that works
const RSS_SOURCES = [
  {
    name: 'CNBC Markets',
    url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114',
  },
  {
    name: 'Reuters Business',
    url: 'https://feeds.reuters.com/reuters/businessNews',
  },
  {
    name: 'MarketWatch Top Stories',
    url: 'https://feeds.marketwatch.com/marketwatch/topstories/',
  },
  {
    name: 'Bloomberg Markets',
    url: 'https://feeds.bloomberg.com/markets/news.rss',
  },
];

async function fetchRssNews(source: { name: string; url: string }): Promise<FullNewsItem[]> {
  const response = await fetch(source.url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; LuxTradeBot/1.0)',
      'Accept': 'application/rss+xml, application/xml, text/xml, */*',
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`${source.name} RSS returned ${response.status}`);
  }

  const xml = await response.text();
  if (xml.length < 100) {
    throw new Error(`${source.name} RSS returned empty content`);
  }

  return parseRssXml(xml, source.name);
}

// ==================== MAIN FETCH LOGIC ====================

async function fetchFullNews(): Promise<FullNewsItem[]> {
  const apiKey = getTeApiKey();

  // PRIMARY: TradingEconomics RapidAPI (forex-focused, with importance)
  if (apiKey) {
    try {
      console.log('[News] Fetching from TradingEconomics RapidAPI...');
      const items = await fetchTradingEconomicsNews();
      if (items.length > 0) return items;
    } catch (err: any) {
      console.warn(`[News] TradingEconomics failed: ${err.message}, falling back to RSS...`);
    }
  } else {
    console.log('[News] RAPIDAPI_TRADING_ECONOMICS_KEY not set, using RSS feeds');
  }

  // FALLBACK: Try multiple RSS sources sequentially until one works
  for (const source of RSS_SOURCES) {
    try {
      console.log(`[News] Fetching from ${source.name} RSS...`);
      const items = await fetchRssNews(source);
      if (items.length > 0) {
        console.log(`[News] ${source.name} returned ${items.length} articles`);
        return items;
      }
    } catch (err: any) {
      console.warn(`[News] ${source.name} RSS failed: ${err.message}`);
    }
  }

  throw new Error('All news sources failed');
}

// ==================== API ROUTE ====================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || 'ticker';

  try {
    // Check cache
    if (fullNewsCache && Date.now() - fullNewsCache.timestamp < CACHE_DURATION) {
      console.log('[News] Returning cached news');
      const cachedItems = fullNewsCache.items;

      if (format === 'full') {
        return NextResponse.json({
          success: true,
          cached: true,
          news: cachedItems.slice(0, 30),
          fetchedAt: new Date(fullNewsCache.timestamp).toISOString(),
          totalSources: cachedItems.length,
        });
      }

      // Ticker format
      const newsItems = cachedItems.slice(0, 12);
      const tips = [
        { title: '💡 TIP: Selalu gunakan Stop Loss untuk mengelola risiko', type: 'low' as const },
        { title: '💡 TIP: Jangan overtrade — kualitas lebih penting dari kuantitas', type: 'low' as const },
        { title: '💡 TIP: Perhatikan economic calendar sebelum open posisi', type: 'low' as const },
        { title: '💡 TIP: Risk-to-reward ratio minimal 1:2 untuk entry yang baik', type: 'low' as const },
      ];
      const randomTip = tips[Math.floor(Math.random() * tips.length)];
      const impactEmoji = (type: string) => {
        switch (type) {
          case 'high': return '🔴';
          case 'medium': return '🟡';
          default: return '🟢';
        }
      };
      const tickerItems: TickerItem[] = newsItems.map(item => ({
        text: `${impactEmoji(item.type)} ${item.title} — ${item.source.split('·')[0].trim()}`,
        type: item.type,
        url: item.url,
      }));
      tickerItems.push({ text: randomTip.title, type: 'tip', url: '' });

      return NextResponse.json({
        success: true,
        cached: true,
        news: tickerItems,
        fetchedAt: new Date(fullNewsCache.timestamp).toISOString(),
        totalSources: cachedItems.length,
      });
    }

    // Fetch fresh data
    const allResults = await fetchFullNews();

    // Update cache
    fullNewsCache = {
      items: allResults,
      timestamp: Date.now(),
    };

    console.log(`[News] Fetched ${allResults.length} news items`);

    if (format === 'full') {
      return NextResponse.json({
        success: true,
        cached: false,
        news: allResults.slice(0, 30),
        fetchedAt: new Date().toISOString(),
        totalSources: allResults.length,
      });
    }

    // Legacy ticker format
    const newsItems = allResults.slice(0, 12);
    const tips = [
      { title: '💡 TIP: Selalu gunakan Stop Loss untuk mengelola risiko', type: 'low' as const },
      { title: '💡 TIP: Jangan overtrade — kualitas lebih penting dari kuantitas', type: 'low' as const },
      { title: '💡 TIP: Perhatikan economic calendar sebelum open posisi', type: 'low' as const },
      { title: '💡 TIP: Risk-to-reward ratio minimal 1:2 untuk entry yang baik', type: 'low' as const },
    ];
    const randomTip = tips[Math.floor(Math.random() * tips.length)];

    const impactEmoji = (type: string) => {
      switch (type) {
        case 'high': return '🔴';
        case 'medium': return '🟡';
        default: return '🟢';
      }
    };

    const tickerItems: TickerItem[] = newsItems.map(item => ({
      text: `${impactEmoji(item.type)} ${item.title} — ${item.source.split('·')[0].trim()}`,
      type: item.type,
      url: item.url,
    }));
    tickerItems.push({ text: randomTip.title, type: 'tip', url: '' });

    return NextResponse.json({
      success: true,
      cached: false,
      news: tickerItems,
      fetchedAt: new Date().toISOString(),
      totalSources: allResults.length,
    });
  } catch (error) {
    console.error('[News] API error:', error);

    if (format === 'full') {
      return NextResponse.json({
        success: true,
        fallback: true,
        unavailable: true,
        news: [],
        message: 'Data berita sedang tidak tersedia. Silakan coba beberapa menit lagi.',
        fetchedAt: new Date().toISOString(),
      });
    }

    const fallbackNews = [
      { text: '🔴 Berita forex sedang tidak tersedia — coba beberapa menit lagi', type: 'high' as const, url: '' },
      { text: '🟡 Kunjungi TradingEconomics.com untuk berita terkini', type: 'medium' as const, url: 'https://tradingeconomics.com' },
      { text: '💡 TIP: Gunakan Stop Loss di setiap trade untuk proteksi modal', type: 'low' as const, url: '' },
    ];

    return NextResponse.json({
      success: true,
      fallback: true,
      unavailable: true,
      news: fallbackNews,
      message: 'Data berita sedang tidak tersedia.',
      fetchedAt: new Date().toISOString(),
    });
  }
}
