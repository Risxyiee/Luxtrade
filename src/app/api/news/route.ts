import { NextRequest, NextResponse } from 'next/server';

// In-memory cache
let fullNewsCache: { items: FullNewsItem[]; timestamp: number } | null = null;
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

interface FullNewsItem {
  title: string;
  source: string;
  url: string;
  snippet: string;
  date: string;
  type: 'high' | 'medium' | 'low';
  isMock?: boolean;
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
    'strikes', 'escalat', 'ceasefire', ' Hormuz',
    'rate hike', 'rate cut',
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
    'ppi', 'retail',
    's&p', 'nasdaq', 'dow', 'bond', 'yield', 'treasury',
    'rupee', 'yuan', 'won', 'yen',
    'copper', 'commodity', 'commodit',
    'inflation', 'rate', 'bank',
  ];

  for (const kw of highKeywords) {
    if (text.includes(kw)) return 'high';
  }

  for (const kw of mediumKeywords) {
    if (text.includes(kw)) return 'medium';
  }

  return 'low';
}

/**
 * Parse Bloomberg RSS XML and convert to FullNewsItem[]
 */
function parseBloombergRss(xml: string): FullNewsItem[] {
  const items: FullNewsItem[] = [];

  // Simple regex-based XML parsing (no xml2js dependency needed)
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

    // Skip non-news items (videos, certain opinion pieces, non-market content)
    if (url.includes('/news/videos/')) continue;
    if (url.includes('/news/audio/')) continue;

    let snippet = descMatch?.[1]?.trim() || '';
    // Strip HTML tags from description
    snippet = snippet.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
    if (snippet.length > 200) snippet = snippet.substring(0, 200) + '...';

    const date = dateMatch?.[1] || new Date().toISOString();
    const type = classifyImpact(title, snippet);

    items.push({ title, source: 'Bloomberg', url, snippet, date, type });
  }

  return items;
}

/**
 * Fetch real news from Bloomberg Markets RSS feed
 * Free, no API key needed, real article URLs
 */
async function fetchBloombergNews(): Promise<FullNewsItem[]> {
  const BLOOMBERG_RSS = 'https://feeds.bloomberg.com/markets/news.rss';

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
 * Fetch real news — primary from Bloomberg RSS
 */
async function fetchFullNews(): Promise<FullNewsItem[]> {
  console.log('[News] Fetching from Bloomberg Markets RSS...');

  try {
    const items = await fetchBloombergNews();
    console.log(`[News] Bloomberg returned ${items.length} articles`);
    return items;
  } catch (err: any) {
    console.error('[News] Bloomberg RSS failed:', err.message);
    throw err;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || 'ticker';

  try {
    // Check cache
    if (fullNewsCache && Date.now() - fullNewsCache.timestamp < CACHE_DURATION) {
      console.log('[News] Returning cached news');
      if (format === 'full') {
        return NextResponse.json({
          success: true,
          cached: true,
          news: fullNewsCache.items.slice(0, 30),
          fetchedAt: new Date(fullNewsCache.timestamp).toISOString(),
          totalSources: fullNewsCache.items.length,
        });
      }
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

    const tickerItems = newsItems.map(item => ({
      text: `${impactEmoji(item.type)} ${item.title} — ${item.source}`,
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

    // Fallback: show "unavailable" message instead of fake mock data
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
      { text: '🟡 Kunjungi Bloomberg.com untuk berita pasar terkini', type: 'medium' as const, url: 'https://www.bloomberg.com/markets' },
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