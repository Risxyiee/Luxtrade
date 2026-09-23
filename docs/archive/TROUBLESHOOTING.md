# Troubleshooting Guide - LuxTrade

## 🔴 Masalah 1: Admin Panel - "Failed Activate PRO"

### Gejala:
- Saat klik tombol "PRO" di admin panel, muncul error "Failed to activate PRO"
- Toast error muncul di UI

### Penyebab Utama:
**SUPABASE_SERVICE_ROLE_KEY tidak dikonfigurasi di Vercel**

### Solusi:

#### 1. Cek Environment Variables di Vercel:
1. Buka [Vercel Dashboard](https://vercel.com/dashboard)
2. Pilih project LuxTrade
3. Masuk ke **Settings** → **Environment Variables**
4. Pastikan variable berikut ada:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key  ⚠️ INI YANG PENTING!
```

#### 2. Cara Mendapatkan SERVICE_ROLE_KEY:
1. Buka [Supabase Dashboard](https://supabase.com/dashboard)
2. Pilih project LuxTrade
3. Masuk ke **Settings** → **API**
4. Scroll ke **Project API Keys**
5. Copy **service_role (secret)** key
6. Paste di Vercel Environment Variables sebagai `SUPABASE_SERVICE_ROLE_KEY`

#### 3. Redeploy setelah menambah environment variable:
1. Di Vercel, masuk ke **Deployments**
2. Klik **...** (tiga titik) di deployment terbaru
3. Pilih **Redeploy**
4. Tunggu selesai, lalu coba lagi

---

### 🧪 Cara Test Menggunakan Test Endpoint:

Jika masih gagal setelah setting environment variable, gunakan test endpoint:

#### URL Test:
```
https://your-domain.vercel.app/api/admin/test-activation?userId=USER_ID
```

#### Cara Mendapatkan User ID:
1. Buka Admin Panel di browser
2. Buka **Developer Tools** → **Console**
3. Jalankan:
```javascript
// Dapatkan user ID dari admin panel
// Cek network tab saat load admin panel
// Atau buka Supabase Dashboard → Authentication → Users
// Copy ID user yang ingin di-activate PRO
```

#### Hasil Response:

**Sukses:**
```json
{
  "status": "SUCCESS",
  "message": "PRO activated successfully",
  "userId": "43f1b7d3-4e61-4a22-8c81-75661d75f2e9",
  "email": "luxtradee@gmail.com",
  "subscriptionUntil": "2025-02-xxT00:00:00.000Z"
}
```

**Gagal - SERVICE_ROLE_KEY tidak ada:**
```json
{
  "error": "SUPABASE_SERVICE_ROLE_KEY is not configured",
  "status": "FAILED",
  "fix": "Add SUPABASE_SERVICE_ROLE_KEY to environment variables"
}
```

**Gagal - User tidak ditemukan:**
```json
{
  "error": "User not found",
  "userId": "invalid-id",
  "status": "FAILED"
}
```

---

## 🟡 Masalah 2: Payment Guide PaywallModal Tidak Sesuai

### Gejala:
- Guide pembayaran tidak muncul atau tidak sesuai yang diinginkan
- Bahasa tidak berubah dengan benar

### Solusi:

#### 1. Pastikan File Telah Terdeploy:
```bash
# Cek commit terbaru
git log --oneline -3

# Pastikan ada commit:
# 34fb3cd feat: Add test activation endpoint for debugging admin PRO activation
# 0179332 feat: Add detailed payment guide for ID and EN in PaywallModal
```

#### 2. Hard Refresh Browser:
- **Windows/Linux:** `Ctrl + Shift + R`
- **Mac:** `Cmd + Shift + R`

#### 3. Cek Cache Vercel:
1. Di Vercel Dashboard → Deployments
2. Klik **Redeploy** di deployment terbaru
3. Pilih **"Clear cache and re-deploy"**

#### 4. Verifikasi PaywallModal Code:

File yang harus diperiksa: `/src/components/PaywallModal.tsx`

Pastikan bagian ini ada (sekitar line 276-364):

```typescript
{/* Footer - Payment Guide */}
{isTrialExhausted && (
  <div className="mt-6 pt-4 border-t border-white/10">
    <div className="text-center space-y-2">
      <p className="text-xs text-white/40 font-semibold mb-3">
        {isEnglish ? '💳 Payment Guide' : '💳 Panduan Pembayaran'}
      </p>

      {isEnglish ? (
        // Guide bahasa Inggris
      ) : (
        // Guide bahasa Indonesia
      )}
    </div>
  </div>
)}
```

---

## 🔵 Masalah 3: User Baru Tidak Muncul di Admin Panel

### Gejala:
- User baru register tapi tidak muncul di admin panel
- Admin panel menampilkan "gagal memuat data user"

### Penyebab:
1. User metadata tidak diinisialisasi saat signup
2. `SUPABASE_SERVICE_ROLE_KEY` tidak dikonfigurasi

### Solusi:

#### 1. Cek API Signup:
File: `/src/app/api/auth/signup/route.ts`

Pastikan code ini ada (sekitar line 72-97):

```typescript
const myReferralCode = generateReferralCode()
const now = new Date().toISOString()

const { data, error: signUpError } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: {
      full_name: fullName,
      // Auto-init user metadata for admin panel
      is_pro: false,
      subscription_status: 'inactive',
      subscription_until: null,
      my_referral_code: myReferralCode,
      referred_by_code: referralCode || null,
      has_ever_been_pro: false,
      commission_paid: false,
      device_id: deviceId || null,
      created_at: now,
      updated_at: now,
      role: 'member'
    },
    emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://d18td1p2anb1-d.space.z.ai'}/auth/callback`,
  },
})
```

#### 2. Cek API Admin Users:
File: `/src/app/api/admin/users/route.ts`

Pastikan menggunakan `supabaseAdmin` (line 2):
```typescript
import { supabaseAdmin } from '@/lib/supabase'
```

Bukan `supabase` (yang hanya pakai anon key).

---

## 🟢 Masalah 4: Subscription Expiry Tidak Berfungsi

### Gejala:
- User masih bisa akses fitur PRO setelah subscription expired
- Status tidak berubah setelah 30 hari

### Solusi:

#### 1. Cek Utility Functions:
File: `/src/lib/subscription.ts`

Pastikan fungsi `isProUser()` benar:

```typescript
export function isProUser(subscription: UserSubscription | null | undefined): boolean {
  if (!subscription) return false
  if (!subscription.is_pro) return false
  if (subscription.subscription_status !== 'active') return false

  // Check if subscription is not expired
  if (!subscription.subscription_until) return false

  const now = new Date()
  const subscriptionUntil = new Date(subscription.subscription_until)
  return subscriptionUntil > now  // ⚠️ Ini penting - cek expiry
}
```

#### 2. Cek Penggunaan di Frontend:

Contoh cara pakai di komponen:
```typescript
import { useSubscription } from '@/hooks/useSubscription'

function PremiumFeature() {
  const { isPro, canAccessFeatures } = useSubscription()

  if (!canAccessFeatures) {
    return <PaywallModal isOpen={true} />
  }

  // Render fitur premium
  return <div>Konten PRO...</div>
}
```

---

## 📊 Checklist Debugging

### Untuk Masalah Admin Panel:
- [ ] `SUPABASE_SERVICE_ROLE_KEY` sudah ada di Vercel Environment Variables
- [ ] Value dari `SUPABASE_SERVICE_ROLE_KEY` benar (copy dari Supabase Dashboard)
- [ ] Sudah redeploy setelah menambah environment variable
- [ ] Test endpoint berhasil: `/api/admin/test-activation?userId=USER_ID`
- [ ] Browser sudah di-hard refresh

### Untuk Masalah Paywall Guide:
- [ ] Commit `0179332` sudah ada di git log
- [ ] File `PaywallModal.tsx` sudah di-push
- [ ] Vercel sudah di-redeploy
- [ ] Browser cache sudah di-clear
- [ ] Language context bekerja dengan benar

### Untuk Masalah User Metadata:
- [ ] API signup sudah menginisialisasi user_metadata
- [ ] `supabaseAdmin` digunakan di API admin/users
- [ ] User baru muncul di Supabase Dashboard → Authentication → Users
- [ ] User metadata di Supabase Dashboard sudah lengkap

---

## 🆘 Jika Masih Gagal

### 1. Cek Server Logs:
- Vercel Dashboard → Project → Logs
- Cari error dengan prefix `[ADMIN API]` atau `[TEST ACTIVATION]`

### 2. Cek Console Browser:
- Buka Admin Panel
- Buka Developer Tools → Console
- Cari error message
- Cek Network Tab → XHR/Fetch requests
- Lihat response dari `/api/admin/users` dan `/api/admin/users` (PATCH/DELETE)

### 3. Test Manual via cURL:
```bash
# Test GET users
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  https://your-domain.vercel.app/api/admin/users

# Test PATCH activate PRO
curl -X PATCH \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -d '{"userId":"USER_ID","days":30}' \
  https://your-domain.vercel.app/api/admin/users
```

### 4. Hubungi Support:
Jika semua di atas sudah dicoba dan masih gagal:
- Kirim screenshot error
- Kirim server logs dari Vercel
- Kiram user ID yang ingin di-activate
- Kiram hasil dari test endpoint

---

## 📝 Summary

**Paling Sering Terjadi:**
1. ❌ `SUPABASE_SERVICE_ROLE_KEY` tidak ada di Vercel
2. ❌ Belum redeploy setelah tambah environment variable
3. ❌ Browser cache yang lama

**Solusi Cepat:**
1. ✅ Tambah `SUPABASE_SERVICE_ROLE_KEY` di Vercel
2. ✅ Redeploy di Vercel
3. ✅ Hard refresh browser
4. ✅ Test dengan `/api/admin/test-activation?userId=USER_ID`

**Environment Variables yang WAJIB:**
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY  ⚠️ PALING PENTING UNTUK ADMIN PANEL
```
