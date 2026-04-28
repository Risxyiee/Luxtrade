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

interface RawSearchResult {
  name?: string;
  url?: string;
  snippet?: string;
  host_name?: string;
  date?: string;
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
    'rate decision', 'policy rate', 'hawkish', 'dovish',
    'tsl', 'tariff', 'geopolitical',
    'breaking', 'urgent',
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

function isInvestingCom(url: string): boolean {
  return url?.includes('investing.com') ?? false;
}

function extractSourceFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    // Map known domains to friendly names
    const sourceMap: Record<string, string> = {
      'investing.com': 'Investing.com',
      'forexfactory.com': 'ForexFactory',
      'dailyfx.com': 'DailyFX',
      'fxstreet.com': 'FXStreet',
      'bloomberg.com': 'Bloomberg',
      'reuters.com': 'Reuters',
      'cnbc.com': 'CNBC',
      'marketwatch.com': 'MarketWatch',
      'fxempire.com': 'FXEmpire',
      'actionforex.com': 'ActionForex',
    };
    return sourceMap[hostname] || hostname;
  } catch {
    return 'News';
  }
}

function isKnownTradingSource(url: string): boolean {
  const knownSources = [
    'investing.com', 'forexfactory.com', 'dailyfx.com', 'fxstreet.com',
    'bloomberg.com', 'reuters.com', 'cnbc.com', 'marketwatch.com',
    'fxempire.com', 'actionforex.com', 'tradingview.com',
    'economist.com', 'financialtimes.com', 'wsj.com',
    'coinmarketcap.com', 'coindesk.com',
  ];
  return knownSources.some(s => url?.includes(s));
}

// Filter out non-article/tool pages that aren't real news
function isArticleUrl(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  
  // Exclude non-article URL patterns
  const excludePatterns = [
    '/currencies/',       // Currency pair pages (e.g., /currencies/eur-usd)
    '/technical/',        // Technical analysis tool pages
    '/technical-summary', // Technical summary pages
    '/currencies-summary',// Currencies summary page
    '-historical-data',   // Historical data pages
    '-options',           // Options pages
    '/converter',         // Converter pages
    '/charts/',           // Chart pages
    '/rates',             // Rate listing pages
    '/brokers/',          // Broker listing pages
    '/economic-calendar', // Calendar tool page (not news)
    '/news/',             // Generic news index pages (catch /news/ without article slug)
  ];
  
  // Allow specific news article patterns
  const allowPatterns = [
    '/news/forex-news/',
    '/analysis/',
    '/news/economic-news/',
    '/opinion/',
  ];
  
  // Check exclude patterns (but allow if it matches an allow pattern)
  const isExcluded = excludePatterns.some(p => lower.includes(p));
  const isAllowed = allowPatterns.some(p => lower.includes(p));
  
  if (isAllowed) return true;
  if (isExcluded) return false;
  
  // Must contain actual article-like paths
  // Generic /news/ without specific article is an index page
  if (lower === 'https://www.investing.com/news' || lower === 'https://www.investing.com/news/') return false;
  if (lower === 'https://www.investing.com/analysis/forex' || lower === 'https://www.investing.com/analysis/forex/') return false;
  if (lower === 'https://www.investing.com/economic-calendar' || lower === 'https://www.investing.com/economic-calendar/') return false;
  
  return true;
}

async function fetchFullNews(): Promise<FullNewsItem[]> {
  const zai = await ZAI.create();

  // Primary queries: Investing.com focused
  const investingQueries = [
    'site:investing.com forex market news today',
    'site:investing.com currency trading news',
    'site:investing.com EUR USD analysis',
    'site:investing.com central bank interest rate',
    'site:investing.com economic calendar forex',
    'investing.com economic news forex',
    'investing.com currency market analysis',
    'investing.com forex trading latest',
  ];

  // Secondary queries: other major trading news sources
  const secondaryQueries = [
    'forexfactory.com market news forex',
    'dailyfx.com forex analysis today',
    'fxstreet.com currency news',
    'bloomberg forex currency market news',
    'reuters forex currency trading news',
    'forex market news today high impact events',
    'currency trading news central bank decision',
  ];

  const allQueries = [...investingQueries, ...secondaryQueries];

  // Execute all searches in parallel
  const searchResults = await Promise.allSettled(
    allQueries.map(query =>
      zai.functions.invoke('web_search', {
        query,
        num: 10,
        recency_days: 3,
      })
    )
  );

  const seen = new Set<string>();
  const allItems: FullNewsItem[] = [];
  const investingComUrls: string[] = [];
  const otherKeyUrls: string[] = [];

  for (const result of searchResults) {
    if (result.status !== 'fulfilled' || !Array.isArray(result.value)) continue;
    const items = result.value as RawSearchResult[];

    for (const item of items) {
      if (!item?.name || !item?.url || seen.has(item.url)) continue;
      // Skip non-article URLs (tool pages, converter, historical data, etc.)
      if (!isArticleUrl(item.url)) continue;
      seen.add(item.url);

      const source = extractSourceFromUrl(item.url);
      const type = classifyImpact(item.name, item.snippet || '');

      const newsItem: FullNewsItem = {
        title: item.name,
        source,
        url: item.url,
        snippet: item.snippet || '',
        date: item.date || '',
        type,
      };

      allItems.push(newsItem);

      // Track Investing.com URLs and other key source URLs for page_reader enrichment
      if (isInvestingCom(item.url)) {
        investingComUrls.push(item.url);
      } else if (isKnownTradingSource(item.url)) {
        otherKeyUrls.push(item.url);
      }
    }
  }

  // Use page_reader to enrich snippets for top Investing.com articles (max 5)
  const enrichableUrls = investingComUrls.slice(0, 5);
  if (enrichableUrls.length > 0) {
    const enrichedResults = await Promise.allSettled(
      enrichableUrls.map(url =>
        zai.functions.invoke('page_reader', { url })
      )
    );

    const enrichedSnippets = new Map<string, string>();

    for (let i = 0; i < enrichedResults.length; i++) {
      const result = enrichedResults[i];
      if (result.status !== 'fulfilled' || !result.value?.data) continue;

      try {
        const pageData = result.value.data as { html?: string; text?: string; title?: string };
        let betterSnippet = '';

        if (pageData.text) {
          // Use text content if available (cleaner)
          betterSnippet = pageData.text.substring(0, 300).trim();
          // Clean up whitespace
          betterSnippet = betterSnippet.replace(/\s+/g, ' ').trim();
        } else if (pageData.html) {
          // Strip HTML tags for a plain text snippet
          betterSnippet = pageData.html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 300);
        }

        if (betterSnippet && betterSnippet.length > 50) {
          enrichedSnippets.set(enrichableUrls[i], betterSnippet);
        }
      } catch {
        // Silently skip enrichment failures
      }
    }

    // Apply enriched snippets to news items
    for (const item of allItems) {
      if (enrichedSnippets.has(item.url)) {
        item.snippet = enrichedSnippets.get(item.url)!;
      }
    }
  }

  // Also try page_reader for a couple of other key source articles (max 2)
  const otherEnrichable = otherKeyUrls.slice(0, 2);
  if (otherEnrichable.length > 0) {
    const otherEnriched = await Promise.allSettled(
      otherEnrichable.map(url =>
        zai.functions.invoke('page_reader', { url })
      )
    );

    for (let i = 0; i < otherEnriched.length; i++) {
      const result = otherEnriched[i];
      if (result.status !== 'fulfilled' || !result.value?.data) continue;

      try {
        const pageData = result.value.data as { html?: string; text?: string };
        let betterSnippet = '';

        if (pageData.text) {
          betterSnippet = pageData.text.substring(0, 300).replace(/\s+/g, ' ').trim();
        } else if (pageData.html) {
          betterSnippet = pageData.html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 300);
        }

        if (betterSnippet && betterSnippet.length > 50) {
          const item = allItems.find(n => n.url === otherEnrichable[i]);
          if (item) {
            item.snippet = betterSnippet;
          }
        }
      } catch {
        // Silently skip
      }
    }
  }

  // Sort: Investing.com articles first, then high impact, then by date
  allItems.sort((a, b) => {
    // Investing.com priority
    const aInvesting = isInvestingCom(a.url) ? 0 : 1;
    const bInvesting = isInvestingCom(b.url) ? 0 : 1;
    if (aInvesting !== bInvesting) return aInvesting - bInvesting;

    // Known trading sources second priority
    const aKnown = isKnownTradingSource(a.url) ? 0 : 1;
    const bKnown = isKnownTradingSource(b.url) ? 0 : 1;
    if (aKnown !== bKnown) return aKnown - bKnown;

    // Impact priority
    const impactOrder = { high: 0, medium: 1, low: 2 };
    const impactDiff = impactOrder[a.type] - impactOrder[b.type];
    if (impactDiff !== 0) return impactDiff;

    // Date priority (newer first)
    if (a.date && b.date) {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    }

    return 0;
  });

  return allItems;
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
