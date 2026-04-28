import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

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
}

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
  ];

  const mediumKeywords = [
    'pmi', 'manufacturing', 'retail sales', 'consumer confidence',
    'adp', 'jobless claims', 'housing', 'trade balance',
    'oil', 'gold', 'forex', 'dollar', 'euro', 'yen',
    'technical analysis', 'support', 'resistance',
    'eur/usd', 'gbp/usd', 'usd/jpy', 'xau/usd',
    'economic calendar', 'economic data', 'forecast',
  ];

  for (const kw of highKeywords) {
    if (text.includes(kw)) return 'high';
  }

  for (const kw of mediumKeywords) {
    if (text.includes(kw)) return 'medium';
  }

  return 'low';
}

async function fetchFullNews(): Promise<FullNewsItem[]> {
  const zai = await ZAI.create();

  const queries = [
    'forex market news today high impact',
    'currency trading news latest',
    'central bank interest rate decision forex',
    'economic calendar high impact events',
  ];

  const searchResults = await Promise.allSettled(
    queries.map(query =>
      zai.functions.invoke('web_search', {
        query,
        num: 8,
        recency_days: 3,
      })
    )
  );

  const seen = new Set<string>();
  const allResults: FullNewsItem[] = [];

  for (const result of searchResults) {
    if (result.status !== 'fulfilled' || !Array.isArray(result.value)) continue;
    for (const item of result.value) {
      if (!item?.name || seen.has(item.url)) continue;
      seen.add(item.url);

      const type = classifyImpact(item.name || '', item.snippet || '');
      allResults.push({
        title: item.name,
        source: item.host_name || 'News',
        url: item.url,
        snippet: item.snippet || '',
        date: item.date || '',
        type,
      });
    }
  }

  // Sort: high impact first, then by date
  allResults.sort((a, b) => {
    const impactOrder = { high: 0, medium: 1, low: 2 };
    const impactDiff = impactOrder[a.type] - impactOrder[b.type];
    if (impactDiff !== 0) return impactDiff;
    if (a.date && b.date) {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    }
    return 0;
  });

  return allResults;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || 'ticker';

  try {
    // Check cache
    if (fullNewsCache && Date.now() - fullNewsCache.timestamp < CACHE_DURATION) {
      if (format === 'full') {
        return NextResponse.json({
          success: true,
          cached: true,
          news: fullNewsCache.items,
          fetchedAt: new Date(fullNewsCache.timestamp).toISOString(),
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

    if (format === 'full') {
      // Return structured news items for the dedicated news page
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
    console.error('News API error:', error);

    if (format === 'full') {
      return NextResponse.json({
        success: true,
        fallback: true,
        news: [],
        fetchedAt: new Date().toISOString(),
      });
    }

    const fallbackNews = [
      { text: '🔴 HIGH IMPACT: Perhatikan jadwal economic calendar hari ini', type: 'high' as const, url: '' },
      { text: '🟡 MEDIUM: Pantau pergerakan major currency pairs', type: 'medium' as const, url: '' },
      { text: '💡 TIP: Gunakan Stop Loss di setiap trade untuk proteksi modal', type: 'low' as const, url: '' },
    ];

    return NextResponse.json({
      success: true,
      fallback: true,
      news: fallbackNews,
      fetchedAt: new Date().toISOString(),
    });
  }
}
