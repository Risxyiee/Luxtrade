# PESAN PR — tinggal copy-paste setelah klik link di bawah

## 🔗 Link buat PR (1 klik):
https://github.com/Risxyiee/Luxtrade/pull/new/fix/regresi-v2-dan-worklog

## JUDUL (copy-paste):
test: script regresi v2 (anti false-pass) + worklog status BERES

## DESKRIPSI (copy-paste semua blok di bawah):

## Isi PR ini (2 file dimodifikasi — tidak ada file ditambah/dihapus)

### 1. `scripts/regression-p0-routes.mjs` → versi 2 (anti false-pass)
- Uji **method HTTP asli** (POST/GET/DELETE) — bukan asal satu method.
- Rute yang harusnya terhapus **wajib 404**; jawaban **405 dianggap GAGAL** ("PATH MASIH HIDUP").
- Alasan: v1 bisa false-pass — contoh nyata: `POST /api/email-campaigns` jawab 405 padahal `GET`-nya 401 = rute masih hidup; v1 melapor "aman".
- Guard localhost-only (uji live site butuh `ALLOW_REMOTE=1` eksplisit) + fail-fast + skip aman untuk cron yang bisa mengubah data.
- Hasil uji v2 di lingkungan dev: **53 pass / 0 fail / 2 skip**.

### 2. `docs/worklog.md.` — update isi (status BERES + checklist audit)
- Semua perbaikan lama diverifikasi langsung ke main (`ebc335d6`) dengan bukti per item.
- Termasuk koreksi jujur: CI trigger (`build-apk.yml` & `testsprite.yml`) **ternyata sudah beres sejak PR #2** (commit `e32934aa`) — laporan sebelumnya "masih rusak" keliru karena cache pembacaan file di lingkungan dev.

### Catatan
- Tidak ada perubahan kode aplikasi (`src/`) — murni script regresi + dokumen.
- Tidak menyentuh workflow/CI (sudah benar di main).
- Setelah merge: **Actions → deploy → Run workflow** untuk deploy mandiri.
- Checklist audit tersisa ada di `docs/worklog.md.` (paling penting: pastikan **Legacy API keys = Disabled** di Supabase Dashboard).

### Cara uji script
```bash
node scripts/regression-p0-routes.mjs                     # lokal (dev server jalan)
ALLOW_REMOTE=1 BASE_URL=https://luxtradee.web.id node scripts/regression-p0-routes.mjs   # live
```
