# Troubleshooting HuggingFace API di Vercel

## Problem: DNS Resolution Failed (ENOTFOUND)

Error yang terjadi:
```
❌ [Hugging Face Vision] Error: fetch failed
{
  [cause]: Error: getaddrinfo ENOTFOUND api-inference.huggingface.co
      at ignore-listed frames {
    errno: -3007,
    code: 'ENOTFOUND',
    syscall: 'getaddrinfo',
    hostname: 'api-inference.huggingface.co'
  }
}
```

## Root Cause
Ini adalah masalah DNS resolution di Vercel Serverless Functions. Vercel mungkin memblokir akses ke `api-inference.huggingface.co` atau ada masalah dengan DNS server.

## Solusi yang Bisa Dicoba

### Option 1: Gunakan Proxy API (Recommended)

Buat endpoint proxy di Vercel untuk bypass DNS issues:

**File: `/src/app/api/proxy/huggingface-vision/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { model, inputs, parameters } = await request.json()

    const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HUGGING_FACE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs, parameters }),
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json({ error: data.error || 'API error' }, { status: response.status })
    }

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Proxy error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

Lalu update huggingface-vision.ts untuk menggunakan proxy ini.

### Option 2: Gunakan Alternative Vision API

Gunakan alternative vision API yang lebih compatible dengan Vercel:

1. **OpenAI Vision API** (gpt-4-vision-preview atau gpt-4o)
2. **Google Cloud Vision API**
3. **Azure Computer Vision**

### Option 3: Gunakan Model Lain di HuggingFace

Coba gunakan endpoint yang berbeda atau alternative host:

```typescript
// Alternative hosts yang bisa dicoba:
const HF_API_URLS = [
  'https://api-inference.huggingface.co/models',
  'https://huggingface.co/api/models',
]

// Coba satu per satu
```

### Option 4: Cek Vercel Environment Variables

Pastikan environment variables sudah set dengan benar di Vercel:

1. Buka Vercel Dashboard
2. Project → Settings → Environment Variables
3. Tambahkan:
   - `HUGGING_FACE_API_TOKEN`: Token dari HuggingFace
   - `NODE_ENV`: `production`

### Option 5: Redeploy Vercel

Kadang masalah ini terjadi karena cache atau configuration issue:

```bash
# Di local, push empty commit untuk trigger redeploy
git commit --allow-empty -m "trigger redeploy"
git push origin main
```

Atau via Vercel Dashboard:
1. Go to Deployments
2. Klik ... di deployment terbaru
3. Klik "Redeploy"

### Option 6: Cek Vercel Log

Lihat Vercel Function Log untuk lebih detail:

1. Buka Vercel Dashboard
2. Project → Functions
3. Cari `/api/auto-journal`
4. Lihat log error

### Option 7: Hubungi Vercel Support

Jika semua opsi di atas gagal, ini mungkin masalah network di Vercel side.

Hubungi Vercel Support: https://vercel.com/support

## Cek Environment Variables di Production

Test endpoint debug yang sudah kita buat:

```
GET https://your-domain.com/api/debug/check-env
```

Response seharusnya:
```json
{
  "success": true,
  "timestamp": "2024-06-14T...",
  "environment": {
    "huggingFace": {
      "configured": true,
      "tokenLength": 37,
      "status": "VALID"
    },
    "database": {
      "configured": true,
      "status": "CONFIGURED"
    },
    "nodeEnv": {
      "value": "production",
      "status": "PRODUCTION"
    }
  }
}
```

## Temporary Fix

Sementara menunggu solusi permanen, bisa:

1. Gunakan fitur "Screenshot (AI Auto-fill)" untuk extract data
2. Manually input journal content
3. Auto-Journal akan di-disable sementara

## Testing dari Local

Test dari local untuk memastikan API token valid:

```bash
# Test endpoint
curl https://api-inference.huggingface.co/models/Qwen/Qwen2-VL-2B-Instruct \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Jika berhasil dari local tapi gagal di Vercel, berarti masalahnya di Vercel side.

---

**Status**: 🔴 Known Issue - HuggingFace API DNS resolution di Vercel

**Last Updated**: 2024-06-14