import { NextRequest, NextResponse } from 'next/server';

// Lazy accessor for child_process.spawn — not available on Cloudflare Workers
let _spawn: any = undefined; // undefined=not tried, null=unavailable
function getSpawn(): any {
  if (_spawn !== undefined) return _spawn;
  try {
    _spawn = require('child_process').spawn;
  } catch {
    _spawn = null; // CF Workers or other environments without child_process
  }
  return _spawn;
}

export const dynamic = 'force-dynamic'

// In-memory cache
let fullNewsCache: { items: FullNewsItem[]; timestamp: number } | null = null;
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
const CACHE_DURATION_RATE_LIMITED = 60 * 60 * 1000; // 60 min when rate limited

// TradingEconomics RapidAPI config
const TE_API_HOST = 'trading-economics-scraper.p.rapidapi.com';
const TE_ENDPOINT = 'https://trading-economics-scraper.p.rapidapi.com/get_trading_economics_news';

/**
 * Get an API key from environment variables.
 *
 * In OpenNext/CF Workers, the init.js template populates process.env from
 * the CF env (secrets + [vars]) at request time via populateProcessEnv().
 * So process.env.FOO works for both secrets and vars.
 *
 * We also try getCloudflareContext().env as a fallback for edge runtimes
 * where process.env may not be populated yet.
 */
async function getEnvVar(key: string): Promise<string> {
  // 1. process.env — works when OpenNext's populateProcessEnv has run
  const fromProcess = process.env[key];
  if (fromProcess && fromProcess.length > 0) return fromProcess;

  // 2. getCloudflareContext().env — works in CF Workers edge runtime
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = getCloudflareContext();
    const fromCtx = ctx?.env?.[key];
    if (fromCtx && typeof fromCtx === 'string' && fromCtx.length > 0) return fromCtx;
  } catch {
    // @opennextjs/cloudflare not available (local dev without wrangler)
  }

  return '';
}

// Cached env vars per request (resolved lazily on first key access)
let _envCache: Record<string, string> | null = null;

async function getTeApiKey(): Promise<string> {
  _envCache ??= {};
  _envCache.RAPIDAPI_KEY ??= await getEnvVar('RAPIDAPI_KEY');
  _envCache.RAPIDAPI_TRADING_ECONOMICS_KEY ??= await getEnvVar('RAPIDAPI_TRADING_ECONOMICS_KEY');
  return _envCache.RAPIDAPI_KEY || _envCache.RAPIDAPI_TRADING_ECONOMICS_KEY || '';
}

// ==================== RSS FEED URLs ====================
// RELIABLE (verified working):
const INVESTING_RSS = 'https://www.investing.com/rss/news.rss';            // All news (200 OK)
const INVESTING_COMMODITIES_RSS = 'https://www.investing.com/rss/news_11.rss'; // Commodities/Futures (200 OK, forex-relevant)
const INVESTING_FOREX_RSS = 'https://www.investing.com/rss/news_301.rss';   // Forex-specific news (200 OK)
const CNBC_BUSINESS_RSS = 'https://www.cnbc.com/id/10001147/device/rss/rss.html'; // Business news (200 OK)
const BLOOMBERG_RSS = 'https://feeds.bloomberg.com/markets/news.rss';      // Markets (200 OK, follows redirect)
const MARKETWATCH_RSS = 'https://feeds.feedburner.com/Marketwatch-topstories'; // MarketWatch top stories (200 OK)

// UNRELIABLE (dead or blocked — kept as last resort):
// ForexFactory RSS URL is a profile page, not RSS. Calendar XML is Cloudflare-blocked.
// DailyFX returns 403.
// Forexlive returns 403.
// Reuters feeds.reuters.com is dead (connection refused).
// FxStreet RSS returns 403.

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
 * Classify impact level based on title and snippet keywords
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
    'stock', 'shares', 'equity', 'dow', 's&p', 'nasdaq',
    'bitcoin', 'crypto', 'etf', 'hedge fund',
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

async function fetchTradingEconomicsNews(): Promise<FullNewsItem[]> {
  const apiKey = await getTeApiKey();
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
      const err = new Error('TradingEconomics rate limit (429)');
      (err as any).isRateLimit = true;
      throw err;
    }
    throw new Error('TradingEconomics returned ' + response.status);
  }

  const data: TEResponse[] = await response.json();
  if (!Array.isArray(data) || data.length === 0) {
    console.error('[News] TradingEconomics returned empty data');
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

// ==================== FALLBACK: Finnhub Market News ====================

const FINNHUB_NEWS_URL = 'https://finnhub.io/api/v1/news';

async function getFinnhubApiKey(): Promise<string> {
  _envCache ??= {};
  _envCache.FINNHUB_API_KEY ??= await getEnvVar('FINNHUB_API_KEY');
  return _envCache.FINNHUB_API_KEY || '';
}

async function fetchFinnhubNews(): Promise<FullNewsItem[]> {
  const apiKey = await getFinnhubApiKey();
  if (!apiKey) throw new Error('FINNHUB_API_KEY not configured');

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
    console.error('[News] Finnhub returned empty data');
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

  items.sort((a, b) => b.date.localeCompare(a.date));

  console.log(`[News] Finnhub returned ${items.length} articles`);
  return items;
}

// ==================== RSS PARSERS ====================

/**
 * Generic RSS XML parser — handles both CDATA and plain text elements.
 * Works with Investing.com, Bloomberg, CNBC, SeekingAlpha, etc.
 */
function parseRssXml(xml: string, sourceName: string): FullNewsItem[] {
  const items: FullNewsItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];

    // Title: try CDATA first, then plain
    const titleMatch = itemXml.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i)
      || itemXml.match(/<title>([\s\S]*?)<\/title>/i);
    // Link: try CDATA first, then plain
    const linkMatch = itemXml.match(/<link><!\[CDATA\[([\s\S]*?)\]\]><\/link>/i)
      || itemXml.match(/<link>([\s\S]*?)<\/link>/i);
    // Description: try CDATA first, then plain
    const descMatch = itemXml.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i)
      || itemXml.match(/<description>([\s\S]*?)<\/description>/i);
    // Date: pubDate or any date element
    const dateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
    // Author
    const authorMatch = itemXml.match(/<dc:creator><!\[CDATA\[([\s\S]*?)\]\]><\/dc:creator>/i)
      || itemXml.match(/<author>([\s\S]*?)<\/author>/i);
    // Investing.com-specific: <author> tag
    const investingAuthorMatch = itemXml.match(/<author>([\s\S]*?)<\/author>/i);

    if (!titleMatch?.[1] || !linkMatch?.[1]) continue;

    const title = titleMatch[1].trim();
    const url = linkMatch[1].trim();

    // Skip non-news items
    if (url.includes('/news/videos/')) continue;
    if (url.includes('/news/audio/')) continue;
    if (!url.startsWith('http')) continue;

    let snippet = descMatch?.[1]?.trim() || '';
    // Strip HTML tags from snippet
    snippet = snippet.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&#\d+;/g, ' ').trim();
    if (snippet.length > 200) snippet = snippet.substring(0, 200) + '...';

    // Parse date
    let date = dateMatch?.[1]?.trim() || '';
    // Investing.com uses "2026-10-01 15:18:54" format (no timezone) — treat as UTC
    if (date && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(date)) {
      date = date.replace(' ', 'T') + 'Z';
    }
    if (!date) date = new Date().toISOString();

    // Build source label
    const author = authorMatch?.[1]?.trim() || investingAuthorMatch?.[1]?.trim() || '';
    const source = author ? `${sourceName} · ${author}` : sourceName;

    const type = classifyImpact(title, snippet);

    items.push({ title, source, url, snippet, date, type });
  }

  return items;
}

/**
 * Fetch and parse an RSS feed. Returns empty array on failure (never throws).
 */
async function fetchRssFeed(url: string, sourceName: string, timeoutMs = 12000): Promise<FullNewsItem[]> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, text/html, */*;',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'follow',  // Follow redirects (Bloomberg 301→200)
    });

    if (!response.ok) {
      console.error(`[News] ${sourceName} RSS returned ${response.status} from ${url}`);
      console.warn(`[News] ${sourceName} RSS returned ${response.status} from ${url}`);
      return [];
    }

    const xml = await response.text();

    // Validate it looks like RSS/XML
    if (!xml.includes('<item') && !xml.includes('<entry')) {
      console.warn(`[News] ${sourceName} response doesn't look like RSS/XML`);
      return [];
    }

    const items = parseRssXml(xml, sourceName);
    console.log(`[News] ${sourceName} RSS returned ${items.length} articles`);
    return items;
  } catch (err: any) {
    console.error(`[News] ${sourceName} RSS fetch failed: ${err.message}`);
    return [];
  }
}

// ==================== Web Search Fallback (z-ai-web-dev-sdk) ====================

interface WebSearchResult {
  url: string;
  name: string;
  snippet: string;
  host_name: string;
  date: string;
}

/**
 * Fetch real-time forex/trading news via z-ai-web-dev-sdk web-search.
 * This is used as a fallback when all RSS feeds and API sources fail.
 */
async function fetchWebSearchNews(): Promise<FullNewsItem[]> {
  try {
    const spawnFn = getSpawn();
    if (!spawnFn) {
      console.warn('[News] child_process not available (CF Workers) — skipping web-search fallback');
      return [];
    }
    console.log('[News] Invoking z-ai-web-dev-sdk web-search...');
    // Use spawn with promise wrapper for non-blocking execution
    const newsArgsJson = JSON.stringify({ query: 'forex trading news today USD EUR GBP JPY', num: 15 });
    const result = await new Promise<string>((resolve, reject) => {
      const proc = spawnFn('npx', ['z-ai-web-dev-sdk', 'function', '--name', 'web_search', '--args', newsArgsJson], {
        timeout: 15000,
      });
      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', (d) => { stdout += d; });
      proc.stderr.on('data', (d) => { stderr += d; });
      proc.on('close', (code) => {
        if (code === 0) resolve(stdout);
        else reject(new Error(`Exit code ${code}: ${stderr.slice(0, 200)}`));
      });
      proc.on('error', reject);
    });

    // Extract JSON from output (CLI prints emoji status lines before/after JSON)
    // The JSON array is the main content, everything else is status messages
    let jsonStr = '';
    let inArray = false;
    let bracketDepth = 0;
    for (const line of result.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.includes('🚀') || trimmed.includes('🎉')) continue;
      if (!inArray && trimmed.startsWith('[')) {
        inArray = true;
        jsonStr = trimmed;
        bracketDepth = (trimmed.match(/\[/g) || []).length - (trimmed.match(/\]/g) || []).length;
        if (bracketDepth === 0) break; // Single-line JSON
        continue;
      }
      if (inArray) {
        jsonStr += '\n' + line;
        bracketDepth += (line.match(/\[/g) || []).length - (line.match(/\]/g) || []).length;
        if (bracketDepth <= 0) break;
      }
    }

    if (!jsonStr) {
      console.warn('[News] Web search: no JSON found in output');
      return [];
    }

    const data = JSON.parse(jsonStr) as WebSearchResult[];
    if (!Array.isArray(data) || data.length === 0) {
      console.warn('[News] Web search: empty results');
      return [];
    }

    const items: FullNewsItem[] = data
      .filter((r) => r.name && r.url)
      .map((r) => ({
        title: r.name,
        source: r.host_name || 'Web Search',
        url: r.url,
        snippet: (r.snippet || '').substring(0, 200) + ((r.snippet || '').length > 200 ? '...' : ''),
        date: r.date || new Date().toISOString(),
        type: classifyImpact(r.name, r.snippet || ''),
      }));

    // Sort by impact then by date
    const importanceOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    items.sort((a, b) => {
      const aImp = importanceOrder[a.type] ?? 99;
      const bImp = importanceOrder[b.type] ?? 99;
      if (aImp !== bImp) return aImp - bImp;
      return b.date.localeCompare(a.date);
    });

    console.log(`[News] Web search returned ${items.length} articles`);
    return items;
  } catch (err: any) {
    console.error(`[News] Web search failed: ${err.message}`);
    return [];
  }
}

// ==================== MAIN FETCH LOGIC ====================

/**
 * Fetch news with cascade:
 * 1. TradingEconomics RapidAPI (if key available)
 * 2. Finnhub (if key available)
 * 3. Investing.com All News RSS (free, reliable)
 * 4. Investing.com Commodities RSS (free, forex-relevant)
 * 5. Bloomberg Markets RSS (free, reliable)
 * 6. CNBC Business RSS (free, reliable)
 * 7. Investing.com Forex RSS (free, reliable)
 * 8. MarketWatch RSS (free, reliable)
 * 9. z-ai-web-dev-sdk web-search (real-time search)
 * 10. Throw if all fail
 */
async function fetchFullNews(): Promise<FullNewsItem[]> {
  const collectedItems: FullNewsItem[] = [];
  let primarySource = '';

  // PRIMARY: TradingEconomics RapidAPI (forex-focused, with importance)
  const teKey = await getTeApiKey();
  const finnhubKeyCheck = await getFinnhubApiKey();
  console.log(`[News] API keys available: TE=${teKey ? 'YES(' + teKey.substring(0, 6) + '...)' : 'NO'}, Finnhub=${finnhubKeyCheck ? 'YES(' + finnhubKeyCheck.substring(0, 6) + '...)' : 'NO'}`);
  if (teKey) {
    try {
      console.log('[News] Fetching from TradingEconomics RapidAPI...');
      const items = await fetchTradingEconomicsNews();
      if (items.length > 0) {
        primarySource = 'TradingEconomics';
        return items;
      }
    } catch (err: any) {
      const isRateLimit = err?.isRateLimit === true;
      if (isRateLimit) {
        console.warn('[News] TradingEconomics rate limited (429) — falling back');
        (fetchFullNews as any)._lastRateLimited = true;
      } else {
        console.warn(`[News] TradingEconomics failed: ${err.message}`);
      }
    }
  } else {
    console.info('[News] RAPIDAPI_TRADING_ECONOMICS_KEY not set, trying Finnhub');
  }

  // FALLBACK 1: Finnhub (FREE, 60 calls/min, real market news)
  const finnhubKey = await getFinnhubApiKey();
  if (finnhubKey) {
    try {
      console.log('[News] Fetching from Finnhub...');
      const items = await fetchFinnhubNews();
      if (items.length > 0) {
        primarySource = 'Finnhub';
        return items;
      }
    } catch (err: any) {
      console.info(`[News] Finnhub unavailable: ${err.message}`);
    }
  }

  // FALLBACK 2: RSS feeds — try multiple sources and MERGE results
  // This gives us more articles than any single RSS source
  console.log('[News] Trying free RSS feeds...');
  const rssSources = [
    { url: INVESTING_RSS, name: 'Investing.com' },
    { url: INVESTING_COMMODITIES_RSS, name: 'Investing.com-Commodities' },
    { url: BLOOMBERG_RSS, name: 'Bloomberg' },
    { url: CNBC_BUSINESS_RSS, name: 'CNBC' },
    { url: INVESTING_FOREX_RSS, name: 'Investing.com-Forex' },
    { url: MARKETWATCH_RSS, name: 'MarketWatch' },
  ];

  for (const src of rssSources) {
    const items = await fetchRssFeed(src.url, src.name);
    if (items.length > 0) {
      collectedItems.push(...items);
    } else {
      console.error(`[News] RSS source ${src.name} returned 0 items`);
    }
  }

  if (collectedItems.length > 0) {
    // Deduplicate by URL (keep first occurrence = highest priority source)
    const seen = new Set<string>();
    const deduped = collectedItems.filter(item => {
      if (seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    });

    // Sort: high impact first, then by date (newest)
    const importanceOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    deduped.sort((a, b) => {
      const aImp = importanceOrder[a.type] ?? 99;
      const bImp = importanceOrder[b.type] ?? 99;
      if (aImp !== bImp) return aImp - bImp;
      return b.date.localeCompare(a.date);
    });

    console.log(`[News] Merged ${deduped.length} articles from RSS feeds (from ${collectedItems.length} total before dedup)`);
    return deduped;
  }

  // FALLBACK 3: z-ai-web-dev-sdk web-search (real-time search results)
  console.log('[News] Trying web-search via z-ai-web-dev-sdk...');
  const webSearchItems = await fetchWebSearchNews();
  if (webSearchItems.length > 0) {
    console.log(`[News] Web search returned ${webSearchItems.length} articles`);
    return webSearchItems;
  }

  console.error('[News] All news sources failed (TradingEconomics, Finnhub, RSS, Web Search)');
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

// ==================== Sample Data Detection ====================

/**
 * Detect if cached news items are stale sample/placeholder data.
 * This catches old cached data that was generated when all sources failed.
 */
function isSampleData(items: FullNewsItem[]): boolean {
  if (items.length === 0) return true; // Empty = came from "all sources failed" fallback

  // Check for known placeholder patterns
  const sampleIndicators = [
    'sedang tidak tersedia',  // Indonesian "currently unavailable"
    'coba beberapa menit lagi', // Indonesian "try again in a few minutes"
    'Kunjungi TradingEconomics.com untuk berita terkini', // Old fallback text
    'News unavailable',
    'sample',
    'placeholder',
    'lorem ipsum',
  ];

  for (const item of items.slice(0, 5)) { // Check first 5 items
    for (const indicator of sampleIndicators) {
      if (item.title.toLowerCase().includes(indicator.toLowerCase()) ||
          item.snippet.toLowerCase().includes(indicator.toLowerCase())) {
        return true;
      }
    }
    // Check for URLs that are empty or non-http (sign of fallback data)
    if (!item.url || (!item.url.startsWith('http') && item.url !== '')) {
      return true;
    }
  }

  return false;
}

// ==================== KV Cache helpers ====================

interface NewsCacheEntry {
  items: FullNewsItem[];
  timestamp: number;
}

async function getNewsKVCache(): Promise<NewsCacheEntry | null> {
  try {
    let kv: any = null;
    try {
      const { getCloudflareContext } = await import('@opennextjs/cloudflare');
      const ctx = getCloudflareContext();
      kv = (ctx as any)?.env?.luxtradee_kv;
    } catch {}
    if (!kv) return null;
    const raw = await kv.get('news_cache', 'text');
    if (!raw) return null;
    const entry = JSON.parse(raw) as NewsCacheEntry;

    // Detect and invalidate stale sample/placeholder data
    if (isSampleData(entry.items)) {
      console.warn('[News] KV cache contains stale sample data — invalidating');
      try { await kv.delete('news_cache'); } catch {}
      return null;
    }

    return entry;
  } catch {
    return null;
  }
}

async function setNewsKVCache(entry: NewsCacheEntry, ttlMs?: number): Promise<void> {
  try {
    let kv: any = null;
    try {
      const { getCloudflareContext } = await import('@opennextjs/cloudflare');
      const ctx = getCloudflareContext();
      kv = (ctx as any)?.env?.luxtradee_kv;
    } catch {}
    if (!kv) return;
    await kv.put('news_cache', JSON.stringify(entry), { expirationTtl: Math.ceil((ttlMs || CACHE_DURATION) / 1000) });
  } catch {
    // KV not available, in-memory cache still works
  }
}

// ==================== API ROUTE ====================

export async function GET(request: NextRequest) {
  // Reset env cache for each request (secrets may differ per request in theory)
  _envCache = null;

  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || 'ticker';
  const forceRefresh = searchParams.get('refresh') === 'true' || searchParams.get('forceRefresh') === 'true';

  try {
    // 1. Try KV cache first (Cloudflare Workers)
    if (!forceRefresh) {
      const kvEntry = await getNewsKVCache();
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

    // 2. Check in-memory cache (also detect stale sample data)
    if (!forceRefresh && fullNewsCache && Date.now() - fullNewsCache.timestamp < CACHE_DURATION) {
      // Detect stale sample data in memory cache
      if (isSampleData(fullNewsCache.items)) {
        console.warn('[News] In-memory cache contains stale sample data — invalidating');
        fullNewsCache = null;
      } else {
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
    }

    // Fetch fresh data
    const allResults = await fetchFullNews();
    const isRateLimited = (fetchFullNews as any)._lastRateLimited === true;
    const cacheTTL = isRateLimited ? CACHE_DURATION_RATE_LIMITED : CACHE_DURATION;

    // Update caches
    const newCache: NewsCacheEntry = { items: allResults, timestamp: Date.now() };
    fullNewsCache = newCache;
    await setNewsKVCache(newCache, cacheTTL);
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
      { text: '🟡 Kunjungi Investing.com untuk berita terkini', type: 'medium' as const, url: 'https://www.investing.com/news' },
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
