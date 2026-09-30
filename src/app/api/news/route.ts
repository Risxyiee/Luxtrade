import { NextRequest, NextResponse } from 'next/server';

// In-memory cache
let fullNewsCache: { items: FullNewsItem[]; timestamp: number } | null = null;
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
const CACHE_DURATION_RATE_LIMITED = 60 * 60 * 1000; // 60 min when rate limited

// TradingEconomics RapidAPI config
const TE_API_HOST = 'trading-economics-scraper.p.rapidapi.com';
const TE_ENDPOINT = 'https://trading-economics-scraper.p.rapidapi.com/get_trading_economics_news';

// Lazy-read API key at request time (CF Workers env vars not available at module load)
function getTeApiKey(): string {
  return process.env.RAPIDAPI_KEY || process.env.RAPIDAPI_TRADING_ECONOMICS_KEY || '';
}

// Bloomberg RSS (free fallback, no key needed)
const BLOOMBERG_RSS = 'https://feeds.bloomberg.com/markets/news.rss';

// ForexFactory RSS (free, forex-focused)
const FOREXFACTORY_RSS = 'https://www.forexfactory.com/rss';

// DailyFX RSS (free, forex-focused by IG)
const DAILYFX_RSS = 'https://www.dailyfx.com/feeds/market-news';

interface FullNewsItem {
  title: string;
  source: string;
  url: string;
  snippet: string;
  date: string;
  type: 'high' | 'medium' | 'low';
}

interface TickerNewsItem {
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
 * Classify impact level based on title and snippet keywords (for Bloomberg fallback)
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
 * Returns forex-relevant news sorted by importance (high first)
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
    // 429 = rate limit, don't retry immediately
    if (response.status === 429) {
      const err = new Error('TradingEconomics rate limit (429)');
      (err as any).isRateLimit = true;
      throw err;
    }
    throw new Error(`TradingEconomics returned ${response.status}`);
  }

  const data: TEResponse[] = await response.json();
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('TradingEconomics returned empty data');
  }

  // Map to FullNewsItem, prioritize forex-relevant categories
  const FOREX_RELEVANT_CATEGORIES = new Set([
    'Currency', 'Interest Rate', 'Inflation Rate', 'Central Bank',
    'Balance of Trade', 'Consumer Confidence', 'Employment',
    'Producer Prices Change', 'Retail Sales', 'GDP Growth Rate',
  ]);

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

  // Sort: forex-relevant categories first, then by importance (high→low), then by date (newest)
  const importanceOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  items.sort((a, b) => {
    const aForex = a.source.toLowerCase().includes('currency') ||
      a.source.toLowerCase().includes('interest rate') ||
      a.source.toLowerCase().includes('inflation');
    const bForex = b.source.toLowerCase().includes('currency') ||
      b.source.toLowerCase().includes('interest rate') ||
      b.source.toLowerCase().includes('inflation');
    if (aForex !== bForex) return aForex ? -1 : 1;

    const aImp = importanceOrder[a.type] ?? 99;
    const bImp = importanceOrder[b.type] ?? 99;
    if (aImp !== bImp) return aImp - bImp;

    return b.date.localeCompare(a.date);
  });

  console.log(`[News] TradingEconomics returned ${items.length} articles`);
  return items;
}

// ==================== FALLBACK: Bloomberg RSS ====================

/**
 * Parse Bloomberg RSS XML and convert to FullNewsItem[]
 */
function parseBloombergRss(xml: string): FullNewsItem[] {
  const items: FullNewsItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];

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
    snippet = snippet.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
    if (snippet.length > 200) snippet = snippet.substring(0, 200) + '...';

    const date = dateMatch?.[1] || new Date().toISOString();
    const type = classifyImpact(title, snippet);

    items.push({ title, source: 'Bloomberg', url, snippet, date, type });
  }

  return items;
}

/**
 * Fetch news from Bloomberg Markets RSS feed
 * Free, no API key needed, no quota limit
 */
const REUTERS_RSS = 'https://feeds.reuters.com/reuters/businessNews';

async function fetchBloombergNews(): Promise<FullNewsItem[]> {
  const response = await fetch(BLOOMBERG_RSS, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; LuxTradeBot/1.0)',
      'Accept': 'application/rss+xml, application/xml, text/xml, */*',
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Bloomberg RSS returned ${response.status}`);
  }

  const xml = await response.text();
  return parseBloombergRss(xml);
}

/**
 * Fetch from Reuters RSS (more CF Workers friendly than Bloomberg)
 */
async function fetchReutersNews(): Promise<FullNewsItem[]> {
  const response = await fetch(REUTERS_RSS, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; LuxTradeBot/1.0)',
      'Accept': 'application/rss+xml, application/xml, text/xml, */*',
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Reuters RSS returned ${response.status}`);
  }

  const xml = await response.text();
  return parseBloombergRss(xml); // Same XML structure
}

// ==================== FALLBACK 2b: ForexFactory News (FREE, forex-focused) ====================

async function fetchForexFactoryNews(): Promise<FullNewsItem[]> {
  const response = await fetch(FOREXFACTORY_RSS, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; LuxTradeBot/1.0)',
      'Accept': 'application/rss+xml, application/xml, text/xml, */*',
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`ForexFactory RSS returned ${response.status}`);
  }

  const xml = await response.text();
  const items = parseBloombergRss(xml);
  // Mark source as ForexFactory
  return items.map(item => ({ ...item, source: 'ForexFactory' }));
}

// ==================== FALLBACK 2c: DailyFX News (FREE, forex-focused) ====================

async function fetchDailyFXNews(): Promise<FullNewsItem[]> {
  const response = await fetch(DAILYFX_RSS, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; LuxTradeBot/1.0)',
      'Accept': 'application/rss+xml, application/xml, text/xml, */*',
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`DailyFX RSS returned ${response.status}`);
  }

  const xml = await response.text();
  const items = parseBloombergRss(xml);
  return items.map(item => ({ ...item, source: 'DailyFX' }));
}

// ==================== FALLBACK 3: Finnhub Market News (FREE: 60 calls/min) ====================

const FINNHUB_NEWS_URL = 'https://finnhub.io/api/v1/news';

function getFinnhubApiKey(): string {
  return process.env.FINNHUB_API_KEY || '';
}

async function fetchFinnhubNews(): Promise<FullNewsItem[]> {
  const apiKey = getFinnhubApiKey();
  if (!apiKey) throw new Error('FINNHUB_API_KEY not configured');

  // Finnhub market news for forex category
  const url = `${FINNHUB_NEWS_URL}?category=forex&token=${apiKey}`;

  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    if (response.status === 429) {
      const err = new Error('Finnhub rate limit (429)');
      (err as any).isRateLimit = true;
      throw err;
    }
    throw new Error(`Finnhub returned ${response.status}`);
  }

  const data = await response.json();
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Finnhub returned empty data');
  }

  const items: FullNewsItem[] = data
    .filter((item: any) => item.headline && item.url)
    .slice(0, 30)
    .map((item: any) => ({
      title: item.headline,
      source: item.source || 'Finnhub',
      url: item.url,
      snippet: (item.summary || '').substring(0, 200) + ((item.summary || '').length > 200 ? '...' : ''),
      date: item.datetime ? new Date(item.datetime * 1000).toISOString() : new Date().toISOString(),
      type: classifyImpact(item.headline, item.summary || ''),
    }));

  // Sort by date (newest first)
  items.sort((a, b) => b.date.localeCompare(a.date));

  console.log(`[News] Finnhub returned ${items.length} articles`);
  return items;
}

// ==================== MAIN FETCH LOGIC ====================

/**
 * Fetch news with cascade: TradingEconomics → Finnhub → ForexFactory RSS → DailyFX RSS → Reuters RSS → Bloomberg RSS → unavailable
 */
async function fetchFullNews(): Promise<FullNewsItem[]> {
  const apiKey = getTeApiKey();

  // PRIMARY: TradingEconomics RapidAPI (forex-focused, with importance)
  if (apiKey) {
    try {
      console.log('[News] Fetching from TradingEconomics RapidAPI...');
      const items = await fetchTradingEconomicsNews();
      if (items.length > 0) return items;
    } catch (err: any) {
      const isRateLimit = err?.isRateLimit === true;
      if (isRateLimit) {
        console.warn('[News] ⚠️ TradingEconomics rate limited (429) — falling back to RSS with extended cache');
        (fetchFullNews as any)._lastRateLimited = true;
      } else {
        console.warn(`[News] TradingEconomics failed: ${err.message}, falling back...`);
      }
    }
  } else {
    console.info('[News] RAPIDAPI_TRADING_ECONOMICS_KEY not set, trying Finnhub');
  }

  // FALLBACK 1: Finnhub (FREE, 60 calls/min, real market news) — try early because it's most reliable
  const finnhubKey = getFinnhubApiKey();
  if (finnhubKey) {
    try {
      console.log('[News] Fetching from Finnhub...');
      const items = await fetchFinnhubNews();
      if (items.length > 0) return items;
    } catch (err: any) {
      console.info(`[News] Finnhub unavailable: ${err.message}`);
    }
  }

  // FALLBACK 2: ForexFactory RSS (free, forex-focused — most relevant for traders)
  try {
    console.log('[News] Fetching from ForexFactory RSS...');
    const items = await fetchForexFactoryNews();
    if (items.length > 0) return items;
  } catch (err: any) {
    console.info(`[News] ForexFactory RSS unavailable, trying DailyFX...`);
  }

  // FALLBACK 3: DailyFX RSS (free, forex-focused by IG)
  try {
    console.log('[News] Fetching from DailyFX RSS...');
    const items = await fetchDailyFXNews();
    if (items.length > 0) return items;
  } catch (err: any) {
    console.info(`[News] DailyFX RSS unavailable, trying Reuters...`);
  }

  // FALLBACK 4: Reuters RSS (free, more reliable than Bloomberg on CF Workers)
  try {
    console.log('[News] Fetching from Reuters Markets RSS...');
    const items = await fetchReutersNews();
    if (items.length > 0) return items;
  } catch (err: any) {
    console.info(`[News] Reuters RSS unavailable, trying Bloomberg...`);
  }

  // FALLBACK 5: Bloomberg RSS
  try {
    console.log('[News] Fetching from Bloomberg Markets RSS...');
    const items = await fetchBloombergNews();
    if (items.length > 0) return items;
  } catch (err: any) {
    console.info('[News] Bloomberg RSS unavailable');
  }

  throw new Error('All news sources failed');
}

// ==================== Helper functions ====================

function impactEmoji(type: string): string {
  switch (type) {
    case 'high': return '🔴';
    case 'medium': return '🟡';
    case 'low': return '🟢';
    case 'tip': return '💡';
    default: return '⚪';
  }
}

function getRandomTip(): { title: string; type: 'low' } {
  const tips = [
    { title: '💡 TIP: Selalu gunakan Stop Loss untuk mengelola risiko', type: 'low' as const },
    { title: '💡 TIP: Jangan overtrade — kualitas lebih penting dari kuantitas', type: 'low' as const },
    { title: '💡 TIP: Perhatikan economic calendar sebelum open posisi', type: 'low' as const },
    { title: '💡 TIP: Risk-to-reward ratio minimal 1:2 untuk entry yang baik', type: 'low' as const },
  ];
  return tips[Math.floor(Math.random() * tips.length)];
}

// ==================== KV Cache helpers ====================

interface NewsCacheEntry {
  items: FullNewsItem[];
  timestamp: number;
}

async function getNewsKVCache(request: NextRequest): Promise<NewsCacheEntry | null> {
  try {
    const { getCloudflareEnv } = await import('@/lib/cloudflare-bindings');
    const env = getCloudflareEnv(request as unknown as Request);
    const kv = env?.luxtradee_kv;
    if (!kv) return null;
    const raw = await kv.get('news_cache', 'text');
    if (!raw) return null;
    return JSON.parse(raw) as NewsCacheEntry;
  } catch {
    return null;
  }
}

async function setNewsKVCache(request: NextRequest, entry: NewsCacheEntry, ttlMs?: number): Promise<void> {
  try {
    const { getCloudflareEnv } = await import('@/lib/cloudflare-bindings');
    const env = getCloudflareEnv(request as unknown as Request);
    const kv = env?.luxtradee_kv;
    if (!kv) return;
    await kv.put('news_cache', JSON.stringify(entry), { expirationTtl: Math.ceil((ttlMs || CACHE_DURATION) / 1000) });
  } catch {
    // KV not available, in-memory cache still works
  }
}

// ==================== API ROUTE ====================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || 'ticker';
  const forceRefresh = searchParams.get('refresh') === 'true';

  try {
    // 1. Try KV cache first (Cloudflare Workers)
    if (!forceRefresh) {
      const kvEntry = await getNewsKVCache(request);
      if (kvEntry && Date.now() - kvEntry.timestamp < CACHE_DURATION) {
        const cachedItems = kvEntry.items;
        if (format === 'full') {
          return NextResponse.json({
            success: true, cached: true, cacheSource: 'kv',
            news: cachedItems.slice(0, 30),
            fetchedAt: new Date(kvEntry.timestamp).toISOString(),
            totalSources: cachedItems.length,
          });
        }
        const newsItems = cachedItems.slice(0, 12);
        const tickerItems: TickerNewsItem[] = newsItems.map(item => ({
          text: `${impactEmoji(item.type)} ${item.title} — ${item.source.split('·')[0].trim()}`,
          type: item.type, url: item.url,
        }));
        tickerItems.push({ text: getRandomTip().title, type: 'tip', url: '' });
        return NextResponse.json({
          success: true, cached: true, cacheSource: 'kv',
          news: tickerItems,
          fetchedAt: new Date(kvEntry.timestamp).toISOString(),
          totalSources: cachedItems.length,
        });
      }
    }

    // 2. Check in-memory cache
    if (!forceRefresh && fullNewsCache && Date.now() - fullNewsCache.timestamp < CACHE_DURATION) {
      console.log('[News] Returning cached news');
      const cachedItems = fullNewsCache.items;

      if (format === 'full') {
        return NextResponse.json({
          success: true, cached: true, cacheSource: 'memory',
          news: cachedItems.slice(0, 30),
          fetchedAt: new Date(fullNewsCache.timestamp).toISOString(),
          totalSources: cachedItems.length,
        });
      }

      const newsItems = cachedItems.slice(0, 12);
      const tickerItems: TickerNewsItem[] = newsItems.map(item => ({
        text: `${impactEmoji(item.type)} ${item.title} — ${item.source.split('·')[0].trim()}`,
        type: item.type, url: item.url,
      }));
      tickerItems.push({ text: getRandomTip().title, type: 'tip', url: '' });

      return NextResponse.json({
        success: true, cached: true, cacheSource: 'memory',
        news: tickerItems,
        fetchedAt: new Date(fullNewsCache.timestamp).toISOString(),
        totalSources: cachedItems.length,
      });
    }

    // Fetch fresh data
    const allResults = await fetchFullNews();
    const isRateLimited = (fetchFullNews as any)._lastRateLimited === true;
    const cacheTTL = isRateLimited ? CACHE_DURATION_RATE_LIMITED : CACHE_DURATION;

    // Update caches
    const newCache: NewsCacheEntry = { items: allResults, timestamp: Date.now() };
    fullNewsCache = newCache;
    await setNewsKVCache(request, newCache, cacheTTL);
    if (isRateLimited) delete (fetchFullNews as any)._lastRateLimited;

    console.log(`[News] Fetched ${allResults.length} news items`);

    if (format === 'full') {
      return NextResponse.json({
        success: true, cached: false,
        news: allResults.slice(0, 30),
        fetchedAt: new Date().toISOString(),
        totalSources: allResults.length,
        rateLimited: isRateLimited || undefined,
      });
    }

    // Legacy ticker format
    const newsItems = allResults.slice(0, 12);
    const tickerItems: TickerNewsItem[] = newsItems.map(item => ({
      text: `${impactEmoji(item.type)} ${item.title} — ${item.source.split('·')[0].trim()}`,
      type: item.type, url: item.url,
    }));
    tickerItems.push({ text: getRandomTip().title, type: 'tip', url: '' });

    return NextResponse.json({
      success: true, cached: false,
      news: tickerItems,
      fetchedAt: new Date().toISOString(),
      totalSources: allResults.length,
      rateLimited: isRateLimited || undefined,
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

    const fallbackNews: TickerNewsItem[] = [
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