# Photo Trading History Matching

## Fitur

Fitur ini memungkinkan Anda untuk:
1. **Upload foto trading screenshots**
2. **Baca EXIF metadata** (waktu foto diambil, GPS, dll)
3. **Deteksi timezone** dan convert ke WIB/WITA/WIT jika dari Indonesia
4. **Match foto dengan trade history** berdasarkan waktu
5. **Support batch matching** untuk 5 foto sekaligus

## Cara Kerja

```
Upload Foto (1-5 foto)
    ↓
Baca EXIF Metadata (DateTime, GPS)
    ↓
Deteksi & Convert Timezone
    ├─ Di Indonesia → Convert ke WIB/WITA/WIT
    └─ Luar Negeri → Biarkan waktu asli
    ↓
Cari Trade di Database (±5 menit)
    ↓
Hitung Match Score (0-100%)
    ↓
Return Hasil Matching
```

## API Endpoints

### 1. Single Photo Matching

**Endpoint**: `POST /api/photo-trade-match`

**Request**:
```json
{
  "fileName": "1717192345_abc123.jpg",
  "accountId": "optional-account-id",
  "toleranceMinutes": 5
}
```

**Response - With Match**:
```json
{
  "success": true,
  "photo": {
    "fileName": "1717192345_abc123.jpg",
    "originalTime": "2026-05-30T12:30:00.000Z",
    "indonesiaTime": "2026-05-30T19:30:00.000Z",
    "timezone": "WIB",
    "isInIndonesia": true
  },
  "search": {
    "timeRange": {
      "start": "2026-05-30T19:25:00.000Z",
      "end": "2026-05-30T19:35:00.000Z"
    },
    "toleranceMinutes": 5
  },
  "matches": [
    {
      "id": "trade-id-1",
      "symbol": "XAUUSD",
      "type": "BUY",
      "open_price": 2350.5,
      "close_price": 2365.8,
      "profit_loss": 1530.0,
      "open_time": "2026-05-30T19:30:00.000Z",
      "close_time": "2026-05-30T20:15:00.000Z",
      "matchScore": 100,
      "openDiffMinutes": 0,
      "closeDiffMinutes": 45,
      "bestMatch": "open"
    }
  ],
  "bestMatch": { ... },
  "message": "Found 1 trade(s) matching photo time. Best match: XAUUSD (BUY) with 100% confidence"
}
```

### 2. Batch Photo Matching (5 Foto)

**Endpoint**: `POST /api/batch-photo-match`

**Request**:
```json
{
  "fileNames": [
    "1717192345_abc123.jpg",
    "1717192350_def456.jpg",
    "1717192355_ghi789.jpg",
    "1717192360_jkl012.jpg",
    "1717192365_mno345.jpg"
  ],
  "accountId": "optional-account-id",
  "toleranceMinutes": 5
}
```

**Response**:
```json
{
  "success": true,
  "summary": {
    "total": 5,
    "processed": 5,
    "withMatches": 4,
    "highConfidence": 3
  },
  "results": [
    {
      "fileName": "1717192345_abc123.jpg",
      "success": true,
      "photo": {
        "originalTime": "2026-05-30T12:30:00.000Z",
        "indonesiaTime": "2026-05-30T19:30:00.000Z",
        "timezone": "WIB",
        "isInIndonesia": true
      },
      "matches": [ ... ],
      "bestMatch": { ... }
    },
    // ... more results
  ]
}
```

### 3. List Uploaded Photos

**Endpoint**: `GET /api/batch-photo-match`

**Response**:
```json
{
  "success": true,
  "files": [
    {
      "name": "1717192345_abc123.jpg",
      "size": 159588,
      "createdAt": "2026-05-31T12:00:00.000Z",
      "modifiedAt": "2026-05-31T12:00:00.000Z"
    }
  ]
}
```

## Cara Pakai

### Langkah 1: Upload Foto

Gunakan API upload yang sudah ada:
```bash
curl -X POST http://localhost:3000/api/file-upload \
  -F "file=@/path/to/photo1.jpg"
```

### Langkah 2: Match dengan Trade History

**Single Photo**:
```bash
curl -X POST http://localhost:3000/api/photo-trade-match \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "1717192345_abc123.jpg",
    "toleranceMinutes": 5
  }'
```

**Batch Photo (5 foto)**:
```bash
curl -X POST http://localhost:3000/api/batch-photo-match \
  -H "Content-Type: application/json" \
  -d '{
    "fileNames": [
      "1717192345_abc123.jpg",
      "1717192350_def456.jpg",
      "1717192355_ghi789.jpg",
      "1717192360_jkl012.jpg",
      "1717192365_mno345.jpg"
    ],
    "toleranceMinutes": 5
  }'
```

## Match Score

Sistem menghitung **confidence score** (0-100%) untuk setiap match:

- **100%**: Waktu foto sama persis dengan trade open/close time
- **75-99%**: Beda 1-2 menit
- **50-74%**: Beda 2-5 menit
- **< 50%**: Low confidence, mungkin bukan trade yang tepat

**Best Match Threshold**: 50%+

## Timezone Handling

### Foto dari Indonesia
- Auto-detect timezone dari GPS (WIB/WITA/WIT)
- Convert waktu ke zona yang tepat
- Contoh: Foto diambil jam 12:30 di Jakarta → WIB 12:30

### Foto dari Luar Negeri
- Biarkan waktu asli (tidak diubah)
- Contoh: Foto diambil jam 12:30 di New York (UTC-4) → Tetap 12:30 UTC-4

## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `fileName` | string | Yes | - | Nama file yang sudah di-upload |
| `fileNames` | string[] | Yes | - | Array nama file (untuk batch) |
| `accountId` | string | No | - | Filter by trading account |
| `toleranceMinutes` | number | No | 5 | Time tolerance (± menit) |

## Use Cases

### 1. Audit Trading Records

Cek apakah screenshot MT5 sesuai dengan trade yang tercatat di database.

### 2. Batch Process 5 Foto

Upload 5 foto sekaligus dan match dengan trade history yang sesuai.

### 3. Verify Entry Time

Pastikan waktu entry di screenshot sesuai dengan data di database.

### 4. Auto-fill Trade Data

Gunakan metadata foto untuk mengisi waktu trade secara otomatis.

## Database Query

Sistem menggunakan SQL query untuk mencari trade yang match:

```sql
SELECT
  id,
  account_id,
  symbol,
  type,
  open_price,
  close_price,
  profit_loss,
  open_time,
  close_time
FROM trades
WHERE user_id = $1
  AND (
    (open_time >= $2 AND open_time <= $3) OR
    (close_time >= $2 AND close_time <= $3)
  )
ORDER BY
  ABS(EXTRACT(EPOCH FROM open_time - $4)) +
  ABS(EXTRACT(EPOCH FROM close_time - $4)) ASC
```

Where:
- `$2` = startTime (photoTime - tolerance)
- `$3` = endTime (photoTime + tolerance)
- `$4` = photoTime

## Error Handling

### No EXIF DateTime
```json
{
  "error": "Could not extract datetime from photo",
  "warning": "Make sure the photo has EXIF DateTime data"
}
```

**Solusi**: Pastikan foto asli (bukan screenshot/edited)

### No Trade Found
```json
{
  "message": "No trades found matching the photo time. Make sure you have trades recorded in this time period."
}
```

**Solusi**: Tolerance terlalu sempit atau tidak ada trade di range waktu tersebut

### Low Confidence
```json
{
  "message": "Found 1 trade(s) but with low confidence. Consider expanding the time tolerance."
}
```

**Solusi**: Tambah `toleranceMinutes` ke 10 atau 15

## Troubleshooting

### Foto tidak punya EXIF data
- Pastikan foto asli (bukan screenshot)
- Cek apakah foto sudah di-edit (EXIF bisa hilang)
- Coba foto lain

### Match score rendah
- Tambah `toleranceMinutes`
- Cek apakah timezone sudah benar
- Pastikan waktu di database benar

### Tidak ada trade yang match
- Tambah `toleranceMinutes`
- Cek apakah trade ada di database
- Pastikan `user_id` dan `accountId` benar

## Next Steps

1. **Integrasi dengan Screenshot Journal**
   - Saat upload screenshot, auto-baca EXIF
   - Auto-match dengan trade
   - Tampilkan confidence score

2. **UI untuk Batch Matching**
   - Upload 5 foto sekaligus
   - Tampilkan hasil matching
   - Pilih trade yang benar

3. **Auto-link Screenshot to Trade**
   - Link screenshot ke trade yang match
   - Tampilkan screenshot di detail trade

4. **Manual Override**
   - Edit waktu jika auto-detect salah
   - Manual select trade jika match salah

---

**Dibuat oleh**: Z.ai Code
**Tanggal**: 2026-05-31
**Versi**: 1.0