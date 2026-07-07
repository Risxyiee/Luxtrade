import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'
import { isUserPro } from '@/lib/pro-check'

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const { supabase } = createClientForApi(request)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const pro = await isUserPro(user.id)
    if (!pro) {
      return NextResponse.json({
        error: 'Fitur ini hanya untuk pengguna PRO. Upgrade ke PRO untuk akses!',
        code: 'PRO_REQUIRED',
        requiresUpgrade: true
      }, { status: 403 })
    }

    const { query, num = 10, recency_days } = await request.json()

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      )
    }

    // Using DuckDuckGo instant answer API for search
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    try {
      const ddgResponse = await fetch(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
        {
          signal: controller.signal
        }
      )

      clearTimeout(timeoutId)

      if (!ddgResponse.ok) {
        throw new Error('Search API error')
      }

      const data = await ddgResponse.json()

      // Extract results from DuckDuckGo response
      const results = []

      // Add abstract if available
      if (data.Abstract) {
        results.push({
          title: data.Heading || query,
          url: data.AbstractURL || '',
          snippet: data.Abstract,
          source: 'DuckDuckGo'
        })
      }

      // Add related topics if available
      if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
        const topics = data.RelatedTopics
          .filter((topic: any) => topic.Text && topic.FirstURL)
          .slice(0, num - results.length)

        topics.forEach((topic: any) => {
          results.push({
            title: topic.Text.split(' - ')[0] || topic.Text.substring(0, 100),
            url: topic.FirstURL,
            snippet: topic.Text,
            source: 'DuckDuckGo'
          })
        })
      }

      // If no results from DuckDuckGo, return a mock result
      if (results.length === 0) {
        results.push({
          title: `Search results for: ${query}`,
          url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
          snippet: `Web search functionality is limited. Try searching directly on Google.`,
          source: 'Fallback'
        })
      }

      return NextResponse.json({
        success: true,
        results: results.slice(0, num)
      })
    } catch (error: any) {
      clearTimeout(timeoutId)

      // Fallback to mock results if search API fails
      return NextResponse.json({
        success: true,
        results: [
          {
            title: `Search results for: ${query}`,
            url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
            snippet: `Web search functionality is currently unavailable. Please try again later.`,
            source: 'Fallback'
          }
        ]
      })
    }
  } catch (error: any) {
    console.error('[AI /search] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to perform search' },
      { status: 500 }
    )
  }
}