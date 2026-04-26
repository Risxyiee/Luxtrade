import { NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

// In-memory cache: { data, timestamp }
let newsCache: { items: NewsItem[]; timestamp: number } | null = null;
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

interface NewsItem {
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

function getImpactEmoji(type: 'high' | 'medium' | 'low'): string {
  switch (type) {
    case 'high': return '🔴';
    case 'medium': return '🟡';
    case 'low': return '🟢';
  }
}

export async function GET() {
  try {
    // Return cached news if still fresh
    if (newsCache && Date.now() - newsCache.timestamp < CACHE_DURATION) {
      return NextResponse.json({
        success: true,
        cached: true,
        news: newsCache.items,
        fetchedAt: new Date(newsCache.timestamp).toISOString(),
      });
    }

    const zai = await ZAI.create();

    // Search for latest forex trading news
    const queries = [
      'forex market news today',
      'currency trading news latest',
      'economic calendar forex',
    ];

    // Run searches in parallel
    const searchResults = await Promise.allSettled(
      queries.map(query =>
        zai.functions.invoke('web_search', {
          query,
          num: 8,
          recency_days: 3,
        })
      )
    );

    // Merge and deduplicate results
    const seen = new Set<string>();
    const allResults: NewsItem[] = [];

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

    // Sort by impact priority, then by date descending
    allResults.sort((a, b) => {
      const impactOrder = { high: 0, medium: 1, low: 2 };
      const impactDiff = impactOrder[a.type] - impactOrder[b.type];
      if (impactDiff !== 0) return impactDiff;
      if (a.date && b.date) {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
      return 0;
    });

    // Take top 12 for ticker
    const newsItems = allResults.slice(0, 12);

    // Add a random trading tip
    const tips = [
      { title: '💡 TIP: Selalu gunakan Stop Loss untuk mengelola risiko', type: 'low' as const },
      { title: '💡 TIP: Jangan overtrade — kualitas lebih penting dari kuantitas', type: 'low' as const },
      { title: '💡 TIP: Perhatikan economic calendar sebelum open posisi', type: 'low' as const },
      { title: '💡 TIP: Risk-to-reward ratio minimal 1:2 untuk entry yang baik', type: 'low' as const },
    ];
    const randomTip = tips[Math.floor(Math.random() * tips.length)];

    // Format for ticker display
    const tickerItems = newsItems.map(item => ({
      text: `${getImpactEmoji(item.type)} ${item.title} — ${item.source}`,
      type: item.type,
      url: item.url,
    }));
    tickerItems.push({ text: randomTip.title, type: 'tip', url: '' });

    // Update cache
    newsCache = {
      items: tickerItems,
      timestamp: Date.now(),
    };

    return NextResponse.json({
      success: true,
      cached: false,
      news: tickerItems,
      fetchedAt: new Date().toISOString(),
      totalSources: allResults.length,
    });
  } catch (error) {
    console.error('News API error:', error);

    // Fallback: return static tips if API fails
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
