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
}

// Mock news data for fallback
const mockNewsData: FullNewsItem[] = [
  {
    title: 'Federal Reserve Signals Potential Rate Cuts in 2024',
    source: 'Investing.com',
    url: 'https://www.investing.com/news/fed-rate-cuts-2024',
    snippet: 'The Federal Reserve has indicated that interest rate cuts could be on the horizon for 2024, as inflation shows signs of cooling down. Markets are watching closely for the next FOMC meeting.',
    date: new Date().toISOString(),
    type: 'high'
  },
  {
    title: 'EURUSD Strengthens as Eurozone Economic Data Improves',
    source: 'Investing.com',
    url: 'https://www.investing.com/news/eurusd-strengthens',
    snippet: 'The Euro has gained against the US Dollar following better-than-expected economic data from the Eurozone. Traders are monitoring the currency pair for potential breakout opportunities.',
    date: new Date(Date.now() - 3600000).toISOString(),
    type: 'medium'
  },
  {
    title: 'Gold Prices Surge to Record High Amid Geopolitical Tensions',
    source: 'Investing.com',
    url: 'https://www.investing.com/news/gold-prices-surge',
    snippet: 'XAUUSD has reached a new record high as investors seek safe-haven assets amid rising geopolitical tensions. Technical analysts are watching for resistance levels.',
    date: new Date(Date.now() - 7200000).toISOString(),
    type: 'high'
  },
  {
    title: 'Bank of Japan Maintains Ultra-Loose Monetary Policy',
    source: 'Investing.com',
    url: 'https://www.investing.com/news/boj-monetary-policy',
    snippet: 'The Bank of Japan has decided to maintain its ultra-loose monetary policy stance, despite global central banks tightening. This decision is expected to keep the Yen under pressure.',
    date: new Date(Date.now() - 10800000).toISOString(),
    type: 'high'
  },
  {
    title: 'USDJPY Eyes Key Support Level as Market Sentiment Shifts',
    source: 'FXStreet',
    url: 'https://www.fxstreet.com/news/usdjpy-support-level',
    snippet: 'The USDJPY pair is approaching a critical support level as market sentiment shifts. Technical analysts suggest a breakout could lead to significant moves.',
    date: new Date(Date.now() - 14400000).toISOString(),
    type: 'medium'
  },
  {
    title: 'UK Inflation Data Exceeds Expectations, GBP Gains Momentum',
    source: 'DailyFX',
    url: 'https://www.dailyfx.com/news/uk-inflation-gbp',
    snippet: 'UK inflation data has come in above expectations, giving the British Pound a boost. The Bank of England may need to consider further rate hikes.',
    date: new Date(Date.now() - 18000000).toISOString(),
    type: 'high'
  },
  {
    title: 'Australian Dollar Weakens on Commodity Price Decline',
    source: 'Investing.com',
    url: 'https://www.investing.com/news/audusd-commodities',
    snippet: 'The Australian Dollar has weakened following a decline in commodity prices. AUDUSD traders are monitoring support levels for potential reversals.',
    date: new Date(Date.now() - 21600000).toISOString(),
    type: 'medium'
  },
  {
    title: 'ECB President Lagarde Speech Focuses on Inflation Control',
    source: 'Reuters',
    url: 'https://www.reuters.com/news/ecb-lagarde-inflation',
    snippet: 'European Central Bank President Christine Lagarde has emphasized the importance of controlling inflation in her latest speech. Markets are analyzing the impact on monetary policy.',
    date: new Date(Date.now() - 25200000).toISOString(),
    type: 'high'
  },
  {
    title: 'Technical Analysis: GBPUSD Approaches Major Resistance Zone',
    source: 'Investing.com',
    url: 'https://www.investing.com/analysis/gbpusd-technical',
    snippet: 'Technical analysis suggests GBPUSD is approaching a major resistance zone. Traders should watch for a potential breakout or rejection at this level.',
    date: new Date(Date.now() - 28800000).toISOString(),
    type: 'low'
  },
  {
    title: 'Forex Market Volatility Expected During NFP Release',
    source: 'ForexFactory',
    url: 'https://www.forexfactory.com/news/nfp-volatility',
    snippet: 'Forex traders are bracing for increased volatility during the upcoming Non-Farm Payrolls release. Risk management is crucial during high-impact events.',
    date: new Date(Date.now() - 32400000).toISOString(),
    type: 'high'
  }
];

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
    'tsl', 'tariff', 'geopolitical',
    'breaking', 'urgent', 'record high', 'record low',
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
    'ppi', 'isk', 'retail',
    's&p', 'nasdaq', 'dow',
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
  try {
    // Try to use z-ai-web-dev-sdk for real news
    const ZAI = await import('z-ai-web-dev-sdk');
    const zai = await ZAI.create();

    const queries = [
      'site:investing.com forex market news',
      'forex trading news today',
      'currency market analysis',
      'central bank decision news',
      'economic calendar forex today',
    ];

    const searchResults = await Promise.allSettled(
      queries.map(query =>
        zai.default.functions.invoke('web_search', {
          query,
          num: 10,
          recency_days: 3,
        })
      )
    );

    const seen = new Set<string>();
    const allItems: FullNewsItem[] = [];

    for (const result of searchResults) {
      if (result.status !== 'fulfilled' || !Array.isArray(result.value)) continue;
      const items = result.value as any[];

      for (const item of items) {
        if (!item?.name || !item?.url || seen.has(item.url)) continue;
        seen.add(item.url);

        // Extract source from URL
        let source = 'News';
        try {
          const hostname = new URL(item.url).hostname.replace('www.', '');
          source = hostname;
        } catch {
          source = 'News';
        }

        const type = classifyImpact(item.name, item.snippet || '');

        allItems.push({
          title: item.name,
          source,
          url: item.url,
          snippet: item.snippet || '',
          date: item.date || new Date().toISOString(),
          type,
        });
      }
    }

    if (allItems.length > 0) {
      // Sort by impact and date
      const impactOrder = { high: 0, medium: 1, low: 2 };
      allItems.sort((a, b) => {
        const impactDiff = impactOrder[a.type] - impactOrder[b.type];
        if (impactDiff !== 0) return impactDiff;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });

      return allItems.slice(0, 30);
    }
  } catch (error) {
    console.error('Error fetching news from API:', error);
  }

  // Fallback to mock data
  console.log('Using mock news data as fallback');
  return mockNewsData;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || 'ticker';

  try {
    // Check cache
    if (fullNewsCache && Date.now() - fullNewsCache.timestamp < CACHE_DURATION) {
      console.log('Returning cached news');
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

    console.log(`Fetched ${allResults.length} news items`);

    if (format === 'full') {
      // Return structured news items for dedicated news page
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
        news: mockNewsData,
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
