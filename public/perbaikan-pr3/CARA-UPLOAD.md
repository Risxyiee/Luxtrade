# 📦 CARA KIRIM PERBAIKAN KE PULL REQUEST (tanpa git, pakai web GitHub saja)

Semua langkah di bawah pakai browser — sama seperti waktu kamu merge PR #2 kemarin.

## File di folder ini (klik kanan → Save As / simpan):

| File di folder ini | Ditaruh di repo sebagai | Fungsi |
|---|---|---|
| `build-apk.yml` | `.github/workflows/build-apk.yml` | Perbaiki trigger CI yang salah ketik |
| `testsprite.yml` | `.github/workflows/testsprite.yml` | Perbaiki trigger CI yang salah ketik |
| `regression-p0-routes.mjs` | `scripts/regression-p0-routes.mjs` | Script regresi v2 (anti false-pass) |
| `worklog.md` | `docs/worklog.md` | Worklog dengan tanda BERES + checklist audit |

---

## LANGKAH 1 — Edit workflow pertama (ini yang bikin branch + PR terbentuk)

1. Buka repo → masuk folder `.github/workflows` → klik `build-apk.yml`
2. Klik ikon **pensil** (Edit this file)
3. Di baris 5, ganti:
   - **SEBELUM:** `    branches: ain]`
   - **SESUDAH:** `    branches: [main]`
4. Klik **Commit changes...**
5. PENTING: pilih **"Create a new branch for this commit and start a pull request"**
   - Nama branch: `perbaikan-ci-dan-regresi`
   - Klik **Commit changes** / **Propose changes**

## LANGKAH 2 — Edit workflow kedua (masuk ke branch yang sama)

1. Buka `.github/workflows/testsprite.yml` → pensil
2. Ganti baris 5 yang sama: `ain]` → `[main]`
3. Commit changes → kali ini pilih **"Commit directly to the `perbaikan-ci-dan-regresi` branch"**

## LANGKAH 3 — Upload 2 file lain ke branch yang sama

1. Pastikan dropdown branch (kiri atas) = `perbaikan-ci-dan-regresi` (bukan main)
2. **Add file → Upload files**
3. Drag file `regression-p0-routes.mjs` → di kotak nama file, ketik path lengkap: `scripts/regression-p0-routes.mjs`
4. Drag file `worklog.md` → ketik path: `docs/worklog.md`
5. Commit files (langsung ke branch)

## LANGKAH 4 — (Opsional tapi disarankan) Hapus file lama yang namanya ada titiknya

1. Buka file `docs/worklog.md.` (ada titik di akhir — itu typo rename kemarin)
2. Klik titik tiga (⋯) → **Delete file** → commit ke branch yang sama

## LANGKAH 5 — Buat Pull Request

- Tab **Pull requests** → **New pull request**
- base: `main` ← compare: `perbaikan-ci-dan-regresi`
- Judul & deskripsi: copy-paste dari file **PESAN-PR.md**
- Klik **Create pull request** → cek dulu diff-nya → **merge** kalau sudah yakin

---

## 🚀 DEPLOY MANDIRI (setelah PR merge)

1. Tab **Actions** → di kolom kiri pilih workflow **deploy** (deploy.yml)
2. Klik **Run workflow** → Branch: `main` → **Run workflow**
3. Tunggu hijau ✅ — website ter-update

(workflow deploy memang didesain manual-start (`workflow_dispatch`), jadi kamu pegang kendali penuh kapan deploy jalan.)

## 🧪 Cara uji script regresi v2 (setelah merge, di terminal GitHub Actions atau lokal)

```bash
# di lokal (harus dev server jalan dulu):
node scripts/regression-p0-routes.mjs

# uji langsung ke website live (eksplisit, sadar-risiko):
ALLOW_REMOTE=1 BASE_URL=https://luxtradee.web.id node scripts/regression-p0-routes.mjs
```

Hasil yang benar: semua rute terhapus = **404**; kalau muncul "PATH MASIH HIDUP" berarti ada rute balik hidup.
