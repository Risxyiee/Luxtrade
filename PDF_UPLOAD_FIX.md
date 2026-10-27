# 📕 PDF Upload Fix - Complete

## Problem

User melaporkan: **"gabisa upload file pdf"**

Log menunjukkan:
```
2026-05-25 08:11:32.688 [info] 📁 Processing file: Report-33997309.pdf (application/pdf)
2026-05-25 08:11:32.700 [info] 📊 File detection - Summary score: 0, Detail score: 1
2026-05-25 08:11:32.700 [info] 📕 PDF detected - extracting text...
2026-05-25 08:11:32.728 [info] 📝 Extracted text length: 151869
```

Text berhasil diekstrak (151,869 karakter), tapi kemudian gagal diproses menjadi trades.

## Root Cause

Masalahnya adalah pada cara PDF text extraction yang lama:

**Kode Lama (Salah):**
```typescript
// Convert base64 to string directly
content = Buffer.from(base64Data, 'base64').toString('utf-8')

// Try to extract readable text from binary PDF
const readableText = content
  .replace(/[^\x20-\x7E\n\r]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
```

**Masalah:**
1. PDF adalah **binary format**, bukan plain text
2. Mengkonversi PDF binary ke UTF-8 string langsung tidak akan bekerja
3. Text extraction yang dilakukan dengan regex sederhana tidak bisa membaca struktur PDF

## Solution

Menggunakan library **`pdf-parse`** untuk extract text dari PDF dengan benar.

### Step 1: Install Dependencies

```bash
bun add pdf-parse
bun add -d @types/pdf-parse
```

### Step 2: Update API Route

File: `src/app/api/import/file/route.ts`

**Import library:**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import pdf from 'pdf-parse'
```

**Perbaiki PDF processing:**

```typescript
} else if (mimeType === 'application/pdf' || name.endsWith('.pdf')) {
  // PDF needs special handling - extract text using pdf-parse
  console.log('📕 PDF detected - extracting text...')

  try {
    // Convert base64 back to buffer for pdf-parse
    const pdfBuffer = Buffer.from(base64Data, 'base64')
    const data = await pdf(pdfBuffer)

    console.log('📝 Extracted text length:', data.text.length)
    console.log('📄 PDF pages:', data.numpages)

    const pdfText = data.text.trim()

    if (pdfText.length < 50) {
      return NextResponse.json({
        success: false,
        error: 'PDF Kosong atau Tidak Terbaca',
        message: '⚠️ PDF tidak mengandung teks yang dapat dibaca.\n\nSolusi:\n1. Buka PDF di browser\n2. Screenshot halaman yang berisi daftar transaksi\n3. Upload screenshot tersebut\n\nAtau export dari MT5 dalam format HTML/CSV.',
        fileType: 'pdf_empty'
      }, { status: 422 })
    }

    // Detect if this is a summary file
    const fileTypeDetected = detectFileType(pdfText, name)

    if (fileTypeDetected === 'summary') {
      return NextResponse.json({
        success: false,
        error: 'File Summary Terdeteksi',
        message: '⚠️ Ini adalah file SUMMARY (ringkasan), bukan detail transaksi.\n\nSilakan upload Screenshot Riwayat atau File Detail yang berisi daftar transaksi individual (Symbol, Type, Lots, Price, Profit per transaksi).',
        fileType: 'summary'
      }, { status: 422 })
    }

    trades = parseTextTrades(pdfText)

    if (trades.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'PDF Perlu Screenshot',
        message: '⚠️ PDF tidak mengandung format transaksi yang dikenali.\n\nSolusi:\n1. Buka PDF di browser\n2. Screenshot halaman yang berisi daftar transaksi\n3. Upload screenshot melalui tab "Screenshot OCR"\n\nAtau export dari MT5 dalam format HTML/CSV.',
        fileType: 'pdf_no_trades'
      }, { status: 422 })
    }

    console.log(`✅ Successfully parsed ${trades.length} trades from PDF`)
  } catch (pdfError) {
    console.error('PDF parsing error:', pdfError)
    return NextResponse.json({
      success: false,
      error: 'Gagal Membaca PDF',
      message: '⚠️ Tidak dapat membaca file PDF.\n\nSolusi:\n1. Pastikan file PDF tidak rusak\n2. Buka PDF di browser dan screenshot\n3. Upload screenshot melalui tab "Screenshot OCR"\n\nAtau gunakan format HTML/CSV dari MT5.',
      fileType: 'pdf_error'
    }, { status: 422 })
  }
}
```

## What Changed

### Before (❌)
```typescript
// Convert base64 to string (WRONG for PDF!)
content = Buffer.from(base64Data, 'base64').toString('utf-8')

// Try to extract text with regex (NOT EFFECTIVE)
const readableText = content
  .replace(/[^\x20-\x7E\n\r]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
```

### After (✅)
```typescript
// Convert base64 to Buffer (CORRECT)
const pdfBuffer = Buffer.from(base64Data, 'base64')

// Use pdf-parse library (PROPER PDF TEXT EXTRACTION)
const data = await pdf(pdfBuffer)
const pdfText = data.text.trim()
```

## Benefits

1. ✅ **Proper PDF text extraction** - Menggunakan library khusus untuk PDF
2. ✅ **Better error handling** - Pesan error yang lebih jelas
3. ✅ **Summary detection** - Mendeteksi file summary vs detail
4. ✅ **Page count info** - Mengetahui berapa halaman di PDF
5. ✅ **More reliable** - Tidak bergantung pada regex sederhana

## Supported File Formats

Sekarang aplikasi support:

| Format | Status | Method |
|--------|--------|--------|
| **PDF** | ✅ FIXED | `pdf-parse` library |
| HTML | ✅ Working | HTML table parsing |
| CSV | ✅ Working | CSV parser |
| TXT | ✅ Working | Text parser |
| Screenshot | ✅ Working | OCR with Tesseract.js |

## Error Messages

### PDF Kosong
```
⚠️ PDF tidak mengandung teks yang dapat dibaca.

Solusi:
1. Buka PDF di browser
2. Screenshot halaman yang berisi daftar transaksi
3. Upload screenshot tersebut

Atau export dari MT5 dalam format HTML/CSV.
```

### File Summary
```
⚠️ Ini adalah file SUMMARY (ringkasan), bukan detail transaksi.

Silakan upload Screenshot Riwayat atau File Detail yang berisi daftar transaksi individual (Symbol, Type, Lots, Price, Profit per transaksi).
```

### Tidak Ada Trades
```
⚠️ PDF tidak mengandung format transaksi yang dikenali.

Solusi:
1. Buka PDF di browser
2. Screenshot halaman yang berisi daftar transaksi
3. Upload screenshot melalui tab "Screenshot OCR"

Atau export dari MT5 dalam format HTML/CSV.
```

### PDF Error
```
⚠️ Tidak dapat membaca file PDF.

Solusi:
1. Pastikan file PDF tidak rusak
2. Buka PDF di browser dan screenshot
3. Upload screenshot melalui tab "Screenshot OCR"

Atau gunakan format HTML/CSV dari MT5.
```

## Testing

Untuk testing PDF upload:

1. Buka dashboard: https://luxtradee.web.id
2. Buka tab "Import" atau klik tombol import
3. Pilih file PDF dari MT4/MT5 report
4. Upload file
5. Sistem akan:
   - Extract text dari PDF
   - Parse trading data
   - Tampilkan preview trades
   - Simpan ke database

## Known Limitations

1. **Image-based PDF** - Jika PDF adalah scan/gambar, text extraction tidak akan bekerja
   - **Solution:** Gunakan tab "Screenshot OCR" untuk gambar

2. **Password-protected PDF** - PDF dengan password tidak bisa dibaca
   - **Solution:** Hapus password terlebih dahulu

3. **Corrupted PDF** - PDF yang rusak tidak bisa diparse
   - **Solution:** Download ulang dari platform trading

## Next Steps

1. ✅ PDF parsing sudah diperbaiki
2. ✅ Error messages sudah diperbarui
3. ✅ Summary detection sudah ditambahkan
4. ⏳ Deploy ke production (Vercel)
5. ⏳ Test dengan berbagai jenis PDF report

---

**Status:** ✅ PDF upload sudah diperbaiki dan siap untuk testing!
