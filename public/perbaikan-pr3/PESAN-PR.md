# JUDUL PR (copy-paste):

fix: perbaiki trigger CI (ain] → [main]) + script regresi v2 anti false-pass + worklog beres

# DESKRIPSI PR (copy-paste semua blok di bawah ini):

## Apa isi PR ini

### 1. Perbaiki trigger CI yang rusak (sejak commit awal)
- `.github/workflows/build-apk.yml` dan `.github/workflows/testsprite.yml` punya typo di trigger:
  - **Sebelum:** `branches: ain]` (bukan YAML error, cuma string "ain]" → tidak pernah match branch apapun)
  - **Sesudah:** `branches: [main]`
- **Akibat sebelumnya:** push/merge ke main TIDAK PERNAH memicu CI (build APK & tes otomatis diam saja).
- Ini bug lama di main, bukan dibawa PR #2.

### 2. Script regresi P0 → versi 2 (anti false-pass)
- `scripts/regression-p0-routes.mjs` diganti ke v2:
  - Uji **method HTTP asli** (POST/GET/DELETE) — bukan asal satu method.
  - Rute yang harusnya terhapus **wajib 404**; jawaban **405 dianggap GAGAL** ("PATH MASIH HIDUP").
  - Alasan: v1 bisa false-pass — contoh nyata: `POST /api/email-campaigns` jawab 405 tapi `GET`-nya 401 = rute masih hidup; v1 melapor "aman".
  - Ada guard localhost-only (uji live site butuh `ALLOW_REMOTE=1` eksplisit) + fail-fast + skip aman untuk cron yang bisa mengubah data.
- Hasil uji v2 di lingkungan dev: **53 pass / 0 fail / 2 skip**.

### 3. docs/worklog.md — status BERES per item + checklist audit keamanan
- Semua perbaikan lama sudah diverifikasi langsung ke main (`ebc335d6`).
- File lama `docs/worklog.md.` (namanya kelebihan titik) sebaiknya dihapus di PR yang sama.

### 4. Checklist setelah merge (untuk audit keamanan)
- [ ] CI jalan otomatis saat push main (bukti: tab Actions ada run baru)
- [ ] `Actions → deploy → Run workflow` untuk deploy mandiri
- [ ] Supabase Dashboard → Settings → API Keys → pastikan **Legacy API keys = Disabled** (key legacy pernah masuk riwayat git — kalau sudah disabled, itu tidak berbahaya lagi)
- [ ] (Opsional lanjutan) bersih-bersih riwayat git pakai BFG — JANGAN dilakukan sebelum yakin legacy key memang sudah disabled

## Cara uji
```bash
node scripts/regression-p0-routes.mjs                     # lokal (dev server jalan)
ALLOW_REMOTE=1 BASE_URL=https://luxtradee.web.id node scripts/regression-p0-routes.mjs   # live
```

## Yang TIDAK diubah PR ini
- Tidak ada perubahan kode aplikasi (`src/`) — murni CI, script regresi, dan dokumen.
- Tidak menyentuh konfigurasi deploy (deploy.yml tetap manual-start).
