# Photo Metadata & Timezone Conversion

## Fitur

Fitur ini memungkinkan Anda untuk:
1. **Upload foto** ke server
2. **Baca EXIF metadata** (tanggal, GPS, dll)
3. **Deteksi timezone** dari koordinat GPS
4. **Convert ke timezone Indonesia** (WIB/WITA/WIT) otomatis

## Cara Kerja

### Logika Konversi Timezone

```
Upload Foto
    ↓
Baca EXIF Metadata
    ↓
Ada GPS?
    ├─ YA → Deteksi timezone dari koordinat
    │       ↓
    │   Di Indonesia?
    │       ├─ YA → Convert ke WIB/WITA/WIT sesuai lokasi
    │       └─ TIDAK → Biarkan waktu asli
    │
    └─ TIDAK → Cek metadata lain (Location, City, dll)
                ↓
                Di Indonesia?
                    ├─ YA → Pakai WIB (default)
                    └─ TIDAK → Biarkan waktu asli
```

### Indonesia Timezone Zones

| Zona | Region | Offset UTC |
|------|--------|-----------|
| **WIB** | Sumatra, Jawa, Kalimantan Barat | UTC+7 |
| **WITA** | Kalimantan Tengah, Sulawesi, Bali, Nusa Tenggara | UTC+8 |
| **WIT** | Maluku, Papua | UTC+9 |

## API Endpoints

### 1. Upload Foto

**Endpoint**: `POST /api/file-upload`

**Request**:
```bash
curl -X POST http://localhost:3000/api/file-upload \
  -F "file=@/path/to/IMG_6255.jpeg" \
  -H "Cookie: your-auth-cookie"
```

**Response**:
```json
{
  "success": true,
  "file": {
    "name": "1717192345_abc123.jpg",
    "originalName": "IMG_6255.jpeg",
    "path": "/home/z/my-project/upload/1717192345_abc123.jpg",
    "size": 159588,
    "type": "image/jpeg"
  },
  "message": "File uploaded successfully"
}
```

### 2. Baca Metadata & Convert Timezone

**Endpoint**: `POST /api/photo-metadata`

**Request**:
```bash
curl -X POST http://localhost:3000/api/photo-metadata \
  -H "Content-Type: application/json" \
  -H "Cookie: your-auth-cookie" \
  -d '{
    "fileName": "1717192345_abc123.jpg"
  }'
```

**Response - Foto dari Indonesia**:
```json
{
  "fileName": "1717192345_abc123.jpg",
  "success": true,
  "originalDateTime": "2026-05-30T12:30:00.000Z",
  "originalDateTimeFormatted": "05/30/2026, 12:30:00 PM",
  "timezoneOffset": 7,
  "timezoneName": "Asia/Jakarta",
  "gpsCoordinates": {
    "latitude": -6.2088,
    "longitude": 106.8456
  },
  "location": "Lat: -6.208800, Lon: 106.845600",
  "isInIndonesia": true,
  "indonesiaTimezone": "WIB",
  "indonesiaDateTime": "2026-05-30T19:30:00.000Z",
  "indonesiaDateTimeFormatted": "30 Mei 2026 pukul 19.30.00 WIB",
  "indonesiaTimeFormatted": "19.30.00",
  "message": "Photo taken in Indonesia (WIB). Time converted from Asia/Jakarta to Indonesia timezone."
}
```

**Response - Foto dari Luar Negeri**:
```json
{
  "fileName": "1717192345_abc123.jpg",
  "success": true,
  "originalDateTime": "2026-05-30T12:30:00.000Z",
  "originalDateTimeFormatted": "05/30/2026, 12:30:00 PM",
  "timezoneOffset": -4,
  "timezoneName": "UTC-4",
  "gpsCoordinates": {
    "latitude": 40.7128,
    "longitude": -74.0060
  },
  "location": "Lat: 40.712800, Lon: -74.006000",
  "isInIndonesia": false,
  "message": "Photo taken outside Indonesia. Original time preserved."
}
```

## Testing

### Cara Test dengan Script

```bash
# Test dengan foto contoh
bun run scripts/test-photo-upload.ts /path/to/IMG_6255.jpeg
```

### Cara Test Manual

1. **Upload foto**:
   ```bash
   curl -X POST http://localhost:3000/api/file-upload \
     -F "file=@/path/to/photo.jpg"
   ```

2. **Baca metadata**:
   ```bash
   curl -X POST http://localhost:3000/api/photo-metadata \
     -H "Content-Type: application/json" \
     -d '{"fileName": "1717192345_abc123.jpg"}'
   ```

## Storage

- **Location**: `/home/z/my-project/upload/`
- **Format**: `{timestamp}_{random}{extension}`
- **Example**: `1717192345_abc123.jpg`

## Supported Formats

- ✅ JPEG / JPG
- ✅ PNG
- ✅ WebP

## File Size Limit

- **Maximum**: 10MB

## Dependencies

- `exifreader` - Membaca EXIF data dari gambar
- `form-data` - Upload file via HTTP

## Contoh Penggunaan

### 1. Foto dari Jakarta (WIB - UTC+7)

**GPS**: -6.2088, 106.8456
**Original Time**: 12:30:00 (UTC+7)
**Indonesia Time**: 12:30:00 WIB (Tidak berubah karena sudah di Indonesia)

### 2. Foto dari New York (UTC-4)

**GPS**: 40.7128, -74.0060
**Original Time**: 12:30:00 (UTC-4)
**Indonesia Time**: Tetap 12:30:00 UTC-4 (Di Indonesia jam sudah 23:30, tapi waktu asli dipertahankan)

### 3. Foto dari Bali (WITA - UTC+8)

**GPS**: -8.4095, 115.1889
**Original Time**: 12:30:00 (UTC+8)
**Indonesia Time**: 12:30:00 WITA (Tidak berubah karena sudah di Indonesia)

## Troubleshooting

### Error: "No fileName provided"

Pastikan mengirim `fileName` di request body:
```json
{
  "fileName": "1717192345_abc123.jpg"
}
```

### Warning: "Could not detect original photo datetime"

Foto tidak memiliki EXIF DateTimeOriginal. Pastikan foto asli (bukan screenshot atau yang sudah di-edit).

### Result shows "isInIndonesia: false" but photo was taken in Indonesia

Kemungkinan:
1. Foto tidak memiliki GPS data
2. GPS coordinates tidak dalam bounds Indonesia
3. EXIF data hilang karena editing

### No GPS data in result

Foto tidak memiliki GPS EXIF data. Banyak smartphone yang menonaktifkan GPS by default. Pastikan:
- Location services ON saat mengambil foto
- Camera app memiliki akses ke Location

## Next Steps

1. Integrasi dengan Screenshot Journal untuk auto-detect timezone
2. Tampilkan timezone di trade entries
3. Tampilkan original time vs Indonesia time
4. Tambahkan pilihan manual timezone jika auto-detect gagal

---

**Dibuat oleh**: Z.ai Code
**Tanggal**: 2026-05-31
**Versi**: 1.0