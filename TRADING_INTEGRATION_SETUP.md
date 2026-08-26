# Trading Integration Setup Guide

## Overview

Sistem ini memungkinkan user menghubungkan akun trading mereka (MT4/MT5) menggunakan integrasi pihak ketiga yang GRATIS seperti FxBlue atau Myfxbook. Solusi ini sangat cocok untuk pengguna HP (mobile) karena tidak membutuhkan software tambahan.

## Features

✅ **Support Multiple Providers**: FxBlue, Myfxbook, Custom
✅ **Unlimited Integrations for PRO**: 50 integrasi untuk user PRO, 1 untuk FREE
✅ **Webhook-based**: Menerima data secara real-time dari provider
✅ **Mobile Friendly**: Semua setup bisa dilakukan dari HP
✅ **Auto-sync**: Data transaksi otomatis masuk ke database
✅ **Secure**: Row Level Security (RLS) untuk memastikan user hanya bisa akses data mereka sendiri

## Database Schema

### 1. `trading_integrations`
Menyimpan konfigurasi integrasi trading pihak ketiga:
- User credentials (Account ID, Investor Password, Broker Server)
- Provider (FxBlue, Myfxbook, Custom)
- Webhook URL
- Status dan sync settings

### 2. `trades`
Menyimpan semua data transaksi dari berbagai source:
- Trade details (Symbol, Lot, Buy/Sell, Profit/Loss, Open/Close Time)
- Source tracking (FxBlue, Myfxbook, Custom, MetaApi)
- Status tracking (open/closed)

### 3. `trading_accounts`
Menyimpan koneksi trading account langsung (MetaApi, dll)

## API Endpoints

### Webhook Endpoint
```
GET  /api/webhook/trading - Verifikasi webhook aktif
POST /api/webhook/trading - Terima data transaksi dari provider
```

### Integration Management
```
GET    /api/integrations           - Get all user integrations
POST   /api/integrations           - Add new integration
PATCH  /api/integrations/[id]      - Update integration
DELETE /api/integrations/[id]      - Delete integration
```

## Setup Instructions

### Step 1: Setup Supabase Database

1. Buka Supabase Dashboard → SQL Editor
2. Jalankan file migration: `supabase/migrations/20250519_create_trading_tables.sql`
3. Pastikan semua tables, indexes, dan RLS policies ter-create

### Step 2: Setup Environment Variables

Tambahkan ke `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### Step 3: Setup FxBlue Webhook (Contoh)

1. **Login ke FxBlue**
   - Buka https://www.fxblue.com
   - Login ke akun Anda

2. **Tambahkan Account**
   - Masuk ke "My Accounts"
   - Klik "Add Account"
   - Masukkan:
     - Account Number
     - Investor Password
     - Broker Server

3. **Setup Webhook**
   - Buka "Settings" → "Webhooks" atau "API"
   - Add Webhook URL:
     ```
     https://your-domain.com/api/webhook/trading?source=fxblue
     ```
   - Pilih events yang ingin ditracking:
     - ✅ Trade Opened
     - ✅ Trade Closed
     - ✅ Trade Modified

4. **Custom Field untuk User ID**
   - FxBlue mengizinkan custom field di webhook
   - Tambahkan field `userId` di konfigurasi webhook
   - Value: User ID dari Supabase (dapat dari frontend saat create integration)

### Step 4: Setup Myfxbook Webhook (Contoh)

1. **Login ke Myfxbook**
   - Buka https://www.myfxbook.com
   - Login ke akun Anda

2. **Tambahkan Account**
   - Masuk ke "Portfolio" → "Add Account"
   - Pilih "MT4/MT5"
   - Masukkan credentials

3. **Setup API/Webhook**
   - Masuk ke "Settings" → "API"
   - Enable "Push Notifications" atau "Webhooks"
   - Add Webhook URL:
     ```
     https://your-domain.com/api/webhook/trading?source=myfxbook
     ```

### Step 5: Frontend Integration (Contoh)

```typescript
import { addIntegration, getIntegrations } from '@/lib/trading/integration'

// Menambahkan integrasi baru
const newIntegration = await addIntegration({
  name: 'Akun Utama FxBlue',
  provider: 'fxblue',
  account_id: '12345678',
  investor_password: 'xxx',
  broker_server: 'Exness-MT5',
  account_type: 'MT5',
  status: 'active',
  sync_settings: {}
})

// Mendapatkan semua integrasi
const integrations = await getIntegrations()
```

## Webhook Payload Format

### FxBlue Format
```json
{
  "userId": "user_uuid_here",
  "accountNumber": "12345678",
  "ticket": "12345",
  "symbol": "EURUSD",
  "type": "buy",
  "lot": 0.1,
  "openPrice": 1.0850,
  "closePrice": 1.0860,
  "openTime": "2025-01-19T10:00:00Z",
  "closeTime": "2025-01-19T11:00:00Z",
  "profit": 10.00,
  "commission": 0.50,
  "swap": -0.10,
  "comment": "Trade #12345"
}
```

### Myfxbook Format
```json
{
  "userId": "user_uuid_here",
  "accountId": "12345678",
  "tradeId": "12345",
  "symbol": "EURUSD",
  "action": "buy",
  "lots": 0.1,
  "openPrice": 1.0850,
  "closePrice": 1.0860,
  "openDate": "2025-01-19T10:00:00Z",
  "closeDate": "2025-01-19T11:00:00Z",
  "profit": 10.00,
  "comment": "Trade #12345"
}
```

### Custom/Generic Format
```json
{
  "userId": "user_uuid_here",
  "accountNumber": "12345678",
  "ticket": "12345",
  "symbol": "EURUSD",
  "type": "buy",
  "lot": 0.1,
  "openPrice": 1.0850,
  "closePrice": 1.0860,
  "openTime": "2025-01-19T10:00:00Z",
  "closeTime": "2025-01-19T11:00:00Z",
  "profit": 10.00,
  "commission": 0.50,
  "swap": -0.10,
  "comment": "Custom trade"
}
```

## Important Notes

### 🔒 Security
- **Service Role Key**: Webhook endpoint menggunakan `SUPABASE_SERVICE_ROLE_KEY` untuk bypass RLS
- **Investor Password**: Disimpan di database, sebaiknya dienkripsi menggunakan pgcrypto di production
- **User ID**: Harus selalu dikirim di webhook payload untuk routing ke user yang benar

### 📱 Mobile Usage
- Semua setup bisa dilakukan dari HP browser
- Tidak perlu install software tambahan
- FxBlue/Myfxbook apps tersedia di mobile

### ⚠️ Limitations
- **FREE Plan**: Hanya 1 integrasi
- **PRO Plan**: Hingga 50 integrasi
- Quota checking dilakukan saat menambah integrasi baru

### 🔍 Testing Webhook
Untuk testing webhook endpoint:

```bash
# Test GET endpoint
curl https://your-domain.com/api/webhook/trading

# Test POST endpoint
curl -X POST https://your-domain.com/api/webhook/trading?source=fxblue \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user-id",
    "accountNumber": "12345678",
    "ticket": "12345",
    "symbol": "EURUSD",
    "type": "buy",
    "lot": 0.1,
    "openPrice": 1.0850,
    "closePrice": 1.0860,
    "openTime": "2025-01-19T10:00:00Z",
    "closeTime": "2025-01-19T11:00:00Z",
    "profit": 10.00,
    "commission": 0.50,
    "swap": -0.10,
    "comment": "Test trade"
  }'
```

## Troubleshooting

### ❌ "Missing userId" error
- Pastikan payload webhook menyertakan field `userId`
- Cek konfigurasi custom field di FxBlue/Myfxbook

### ❌ "Unable to parse trade data" error
- Cek format payload sesuai dengan dokumentasi
- Pastikan field required ada: symbol, type, lot, profit

### ❌ "Quota exceeded" error
- User FREE hanya bisa 1 integrasi
- Upgrade ke PRO untuk unlimited (50) integrasi

### ❌ Webhook tidak menerima data
- Cek URL webhook sudah benar
- Pastikan environment variable `NEXT_PUBLIC_APP_URL` sudah diset
- Cek log Vercel/Next.js untuk error

## Next Steps

1. ✅ Deploy ke Vercel
2. ✅ Setup environment variables
3. ✅ Jalankan SQL migration di Supabase
4. ✅ Test webhook endpoint dengan curl/Postman
5. ✅ Setup FxBlue/Myfxbook webhook
6. ✅ Buat frontend UI untuk manajemen integrasi

## Support

Untuk bantuan lebih lanjut, hubungi tim support.
