# OCR Features - Tesseract.js Integration

## Overview

LuxTrade sekarang menggunakan **Tesseract.js** untuk OCR gratis! Tidak perlu lagi OpenAI quota.

## Fitur Auto-Journal

Ada 2 fitur auto-journal:

### 1. **Import Screenshot** (`/api/import/screenshot`)
- Fungsi: Import multiple trades dari screenshot MT5/MT4
- Sebelumnya: OpenAI Vision (berbayar)
- Sekarang: **Tesseract.js (GRATIS)**

### 2. **Screenshot Journal** (`/api/screenshot-journal`)
- Fungsi: Auto journal dari screenshot + AI analysis
- Support multiple services dengan fallback:
  1. Hugging Face Vision (GRATIS dengan API token)
  2. Ollama (GRATIS, lokal)
  3. Z.ai Vision (build-required SDK)
  4. **Tesseract.js (GRATIS, client-side)** ⭐
  5. OpenAI Vision (berbayar, fallback terakhir)

## Cara Kerja Tesseract.js

```typescript
// Contoh penggunaan
import { performOCR, parseMT5TradeData } from '@/lib/tesseract-ocr'

// 1. Lakukan OCR
const result = await performOCR(imageBuffer, {
  language: 'eng',
  oem: 3,  // LSTM OCR Engine
  psm: 6   // Assume uniform block of text
})

// 2. Parse trade data
const trades = parseMT5TradeData(result.text)
```

## Kelebihan Tesseract.js

✅ **100% GRATIS** - Tidak perlu API key atau billing
✅ **Open Source** - MIT License
✅ **Client-side** - Tidak butuh server untuk processing
✅ **Multi-language** - Support 100+ bahasa
✅ **No Rate Limits** - Bebas digunakan tanpa batasan

## Kekurangan Tesseract.js

⚠️ **Less Accurate** - Tidak seakurat OpenAI Vision (GPT-4 Vision)
⚠️ **Slower** - Membutuhkan waktu lebih lama untuk processing
⚠️ **Pattern-dependent** - Hanya bisa extract data yang sesuai pattern yang didefinisikan

## Tesseract.js vs OpenAI Vision

| Fitur | Tesseract.js | OpenAI Vision |
|-------|-------------|---------------|
| **Biaya** | FREE | Berbayar ($0.01 per image) |
| **Akurasi** | 70-80% | 95%+ |
| **Kecepatan** | 5-10 detik | 1-2 detik |
| **Pattern Recognition** | Manual | Otomatis AI |
| **Kebutuhan API Key** | Tidak | Ya |

## Troubleshooting

### "Tesseract OCR tidak tersedia"
✅ Pastikan package sudah terinstall: `bun add tesseract.js`

### "Tidak ada transaksi terdeteksi"
✅ Pastikan screenshot:
- Menampilkan data dengan jelas
- Tidak blur atau gelap
- Menggunakan font standar MT5/MT4
- Format data sesuai pattern yang didefinisikan

### "Analisis OCR terlalu lama"
✅ Tesseract memang lebih lambat dari OpenAI Vision. Tips:
- Gunakan gambar dengan resolusi lebih rendah
- Crop hanya bagian yang penting
- Pastikan koneksi internet stabil

## Alternative jika Tesseract Kurang Akurat

Jika Tesseract tidak cukup akurat untuk kebutuhan Anda:

### Opsi 1: Gunakan Hugging Face (FREE)
```env
HUGGING_FACE_API_TOKEN=hf_xxxxxxxxxxxxx
```
Hugging Face Vision lebih akurat dari Tesseract dan masih gratis.

### Opsi 2: Setup Ollama (FREE, Lokal)
```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Download model
ollama pull llava
```

### Opsi 3: Bayar OpenAI Vision
Setup OpenAI API key dan upgrade plan. Ini yang paling akurat.

## Testing

### Test Import Screenshot
1. Buka dashboard → Trades
2. Klik "Import" → "Screenshot"
3. Upload screenshot MT5/MT4
4. Tesseract akan extract data secara GRATIS

### Test Screenshot Journal
1. Buka dashboard → Journal
2. Klik "Auto Journal from Screenshot"
3. Upload screenshot
4. System akan mencoba:
   - Hugging Face (jika ada API token)
   - Ollama (jika running)
   - Z.ai Vision (jika available)
   - **Tesseract.js (fallback gratis)** ⭐
   - OpenAI Vision (terakhir jika ada API key)

## Development Notes

### Files Modified
- `src/app/api/import/screenshot/route.ts` - Using Tesseract
- `src/app/api/screenshot-journal/route.ts` - Added Tesseract fallback

### Files Created
- `src/lib/tesseract-ocr.ts` - OCR helper functions

### Dependencies Added
```json
{
  "tesseract.js": "^7.0.0"
}
```

## Future Improvements

- [ ] Add pattern untuk lebih banyak broker
- [ ] Implement multi-language OCR support
- [ ] Add confidence threshold filtering
- [ ] Implement manual correction UI untuk hasil OCR
- [ ] Cache OCR results untuk batch processing

## Support

Jika ada masalah:
1. Cek browser console untuk error detail
2. Cek server logs di Vercel
3. Pastikan screenshot format sesuai
4. Coba alternatif input (CSV/HTML import atau manual input)