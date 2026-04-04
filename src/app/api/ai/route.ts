import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, data } = body
    
    let prompt = ''
    
    switch (type) {
      case 'trade_analysis':
        prompt = `Analyze this trade and provide insights:
        Symbol: ${data.symbol}
        Type: ${data.type}
        Entry Price: $${data.entry_price}
        Exit Price: ${data.exit_price ? '$' + data.exit_price : 'Still open'}
        Quantity: ${data.quantity}
        P/L: ${data.profit_loss ? '$' + data.profit_loss.toFixed(2) : 'N/A'}
        Strategy: ${data.strategy || 'Not specified'}
        Notes: ${data.notes || 'No notes'}
        
        Provide a brief analysis (2-3 sentences) on what went well or could be improved.`
        break
        
      case 'performance_tips':
        prompt = `You are an expert trading coach. Based on these trading statistics, provide 3-5 specific, actionable tips to improve trading performance:

        Total Trades: ${data.totalTrades}
        Win Rate: ${data.winRate?.toFixed(1)}%
        Total P/L: $${data.totalPL?.toFixed(2)}
        Average Profit: $${data.avgProfit?.toFixed(2)}
        Average Loss: $${data.avgLoss?.toFixed(2)}
        Profit Factor: ${data.profitFactor?.toFixed(2)}
        
        Be specific and actionable. Focus on risk management, psychology, and strategy refinement. Keep response under 200 words.`
        break
        
      case 'market_insight':
        prompt = `You are a market analyst. Provide a brief market insight for today's trading session. Focus on:
        - General market psychology
        - Key things traders should watch for
        - Risk management reminders
        
        Keep it under 150 words and be encouraging but realistic.`
        break
        
      case 'chat':
        prompt = `You are an expert trading coach and analyst. The user has these trading stats:
        
        Total Trades: ${data.context?.analytics?.totalTrades || 0}
        Win Rate: ${data.context?.analytics?.winRate?.toFixed(1) || 0}%
        Total P/L: $${data.context?.analytics?.totalPL?.toFixed(2) || 0}
        Profit Factor: ${data.context?.analytics?.profitFactor?.toFixed(2) || 0}
        
        Recent trades: ${JSON.stringify(data.context?.trades?.slice(0, 5) || [])}
        
        User question: ${data.message}
        
        Provide a helpful, concise response. If asking for advice, be specific and actionable. Keep response under 200 words.`
        break
        
      default:
        return NextResponse.json({ error: 'Invalid analysis type' }, { status: 400 })
    }
    
    // Dynamic import to avoid build-time issues on platforms without the SDK
    let ZAI: any
    try {
      ZAI = (await import('z-ai-web-dev-sdk')).default
    } catch {
      return NextResponse.json({ 
        error: 'AI service is currently unavailable. Please try again later.',
        insight: null 
      }, { status: 503 })
    }
    
    const zai = await ZAI.create()
    
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are an expert trading coach and analyst. Provide concise, actionable insights in a friendly but professional tone.' },
        { role: 'user', content: prompt }
      ],
      thinking: { type: 'disabled' }
    })
    
    const response = completion.choices[0]?.message?.content
    
    return NextResponse.json({ 
      insight: response || 'Unable to generate insight' 
    })
  } catch (error) {
    console.error('AI Analysis error:', error)
    return NextResponse.json({ 
      error: 'Failed to generate AI insight. Please try again.',
      insight: null
    }, { status: 500 })
  }
}
