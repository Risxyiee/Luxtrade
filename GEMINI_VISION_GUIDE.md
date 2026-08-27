# Gemini Vision Integration Guide

## Setup

### 1. Get Google Gemini API Key
- Go to [Google AI Studio](https://aistudio.google.com/app/apikeys)
- Create new API key
- Copy key

### 2. Add to Vercel Environment
```bash
VERCEL_ENV_NAME=GOOGLE_GEMINI_API_KEY
VERCEL_ENV_VALUE=your-api-key-here
```

Or add to `.env.local` for local development:
```
GOOGLE_GEMINI_API_KEY=your-api-key-here
```

### 3. Restart Server
```bash
npm run dev
# atau
bun run dev
```

## How It Works

### POST /api/auto-journal/from-image

**Request:**
```bash
curl -X POST http://localhost:3000/api/auto-journal/from-image \
  -H "Authorization: Bearer {access_token}" \
  -F "image=@trading_screenshot.png" \
  -F "prompt=Analyze this EUR/USD trade setup"
```

**Form Data:**
- `image` (File, required): Trading screenshot (JPEG, PNG, WebP, GIF)
- `prompt` (string, optional): Custom analysis prompt

**Response (201):**
```json
{
  "success": true,
  "message": "Auto-journal entry created successfully",
  "data": {
    "trade": {
      "id": "trade-uuid",
      "symbol": "EUR/USD",
      "type": "BUY",
      "open_price": 1.0950,
      "close_price": 1.0965,
      "profit_loss": 75
    },
    "journal": {
      "id": "journal-uuid",
      "title": "Trade: EUR/USD BUY - 27 Agustus 2026",
      "created_at": "2026-08-27T14:30:00Z"
    },
    "analysis": {
      "symbol": "EUR/USD",
      "setup_type": "pullback",
      "timeframe": "H1",
      "analysis_text": "Gemini's detailed analysis..."
    }
  }
}
```

## What Gemini Extracts

✅ **Trade Data:**
- Symbol/Pair (EUR/USD, BTCUSD, etc)
- Direction (BUY or SELL)
- Entry Price
- Exit Price
- Position Size (Lot Size)
- Stop Loss
- Take Profit
- P&L (Profit/Loss)
- Timeframe (H1, D1, etc)
- Trade Times (open & close)
- Setup Type (scalp, swing, breakout, pullback, etc)

✅ **AI Analysis:**
- Professional journal entry (3-5 sentences)
- Trade setup quality assessment
- Execution quality feedback
- Lessons learned

## Error Handling

- **401**: Not authenticated - login dulu
- **403**: Not PRO user - upgrade untuk auto-journal
- **400**: Invalid image (bukan image format, >5MB)
- **429**: Rate limited - max 20 requests per hour
- **500**: Server error - check logs

## Rate Limits

- **Free users**: Not available (PRO only)
- **PRO users**: 20 analyses per hour
- **Image size**: Max 5MB
- **Timeout**: 30 seconds

## Limitations

⚠️ **Gemini Vision akurat untuk:**
- Clear screenshot dari trading terminal (MT5, cTrader, TradingView)
- Candlestick charts dengan price levels visible
- Text labels yang jelas (entry, exit, SL, TP)

⚠️ **Gemini Vision kurang akurat untuk:**
- Blurry or low-resolution images
- Screenshots tanpa price labels
- Custom chart indicators yang tidak standard
- Multiple windows/overlapping content

## Tips untuk Hasil Terbaik

1. **Screenshot jelas** - high resolution (720p minimum)
2. **Focus pada price action** - crop hanya area chart relevan
3. **Visible levels** - entry, exit, SL, TP harus terlihat jelas
4. **Clean layout** - minimize overlapping windows
5. **Recent trades** - screenshot saat trade baru ditutup

## Troubleshooting

**"Google Gemini API not configured"**
- Check `GOOGLE_GEMINI_API_KEY` di Vercel/local env
- Restart aplikasi setelah set env var

**"Image must be smaller than 5MB"**
- Compress image atau crop screenshot
- Gunakan tool seperti ImageOptim atau TinyPNG

**"Gemini analysis failed"**
- Check internet connection
- Verify API key is valid
- Check API usage quota di [Google AI Studio](https://aistudio.google.com/app/apikeys)

**"No response from Gemini"**
- Possible Gemini API downtime
- Try again dalam beberapa menit
- Check status di [Google Cloud Status](https://status.cloud.google.com/)
