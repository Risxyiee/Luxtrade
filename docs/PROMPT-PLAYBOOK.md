# Prompt Playbook Bos

> Kumpulan template prompt workflow (disimpan sesuai permintaan Bos, 1 Nov 2026).
> Nomor mengikuti seri aslinya. #4 (Debug Error) ada di `docs/DEBUG-PROTOCOL.md`.
> Cara pakai: sebut nama protokolnya + isi bagian `[...]` kalau ada.

---

## 3/ Temukan Celah Keamanan

> Step yang paling sering dilewatin. **Jalankan sebelum deploy, bukan sesudah.**

```text
Berperanlah sebagai application security engineer yang melakukan
audit pre-launch pada codebase ini.

Review untuk:
- Kelemahan autentikasi dan session handling
- Celah otorisasi (bisa nggak user A akses data user B?)
- Secret, key, atau token hardcoded; apapun sensitif yang
  terekspos di client-side
- Risiko injection (SQL, NoSQL, command, XSS)
- API route yang tidak dilindungi atau tidak divalidasi
- Input validation dan sanitization yang hilang
- Rate limiting / proteksi brute force yang hilang
- Insecure direct object reference
- CORS terlalu longgar, security header hilang, cookie
  flag tidak aman
- Dependency yang sudah diketahui rentan
- Data sensitif yang bocor ke log atau error response

Untuk tiap temuan, berikan:
- Severity: Critical / High / Medium / Low
- File dan baris
- Cara nyatanya dieksploitasi
- Fix kode yang pasti

Lalu urutkan semua temuan berdasarkan severity. JANGAN
ubah kode apapun sebelum saya approve. Kalau satu kategori
bersih, katakan eksplisit, jangan diam saja.
```

---

## 5/ E2E Test Aplikasimu (Playwright)

> Ship tanpa deg-degan.

```text
Setup end-to-end testing untuk aplikasi ini dengan Playwright.

1. Install dan konfigurasi Playwright untuk stack ini.
   Tambahkan config untuk local + CI, dengan retry,
   trace saat gagal, dan screenshot.
2. Identifikasi critical user journey dari codebase dan
   list untuk saya approve DULU sebelum menulis test
   apapun.
3. Untuk tiap journey yang disetujui, tulis test yang
   mencakup happy path plus failure state realistis
   (input salah, session expired, network error, data
   kosong).
4. Pakai selector yang resilient — utamakan role-based
   atau data-testid. Tambahkan atribut data-testid yang
   hilang ke komponen yang perlu.
5. Buat auth fixture supaya test yang sudah login tidak
   mengulang flow login tiap kali jalan.
6. Tambahkan seeding dan cleanup data test supaya test
   terisolasi dan bisa diulang.
7. Tambahkan npm script: test:e2e, test:e2e:ui, test:e2e:ci
8. Tambahkan CI workflow yang menjalankan suite di tiap PR.

Jelaskan cara menjalankan semuanya. Tandai journey yang
tidak bisa dites secara reliable dan jelaskan kenapa.
```

---

## 6/ Bersihkan & Refactor Dead Code

> Vibecoding ninggalin banyak sampah kode. Codebase yang ramping bikin
> respons AI ke depannya makin pintar.

```text
Berperanlah sebagai senior engineer yang melakukan
cleanup pass di repo ini. Kerjakan dalam dua fase dan
berhenti di antaranya.

FASE 1 — AUDIT (jangan ubah apapun):
Temukan dan list, dengan bukti, yang benar-benar tidak
terpakai:
- File, komponen, hook, util yang tidak terpakai
- Import, variabel, fungsi, export yang tidak terpakai
- Dependency yang tidak terpakai di package.json
- Env var, route, API endpoint yang tidak terpakai
- Blok kode yang di-comment out
- Logic yang terduplikasi di 2+ tempat
- File yang sudah kebesaran dan sebaiknya dipecah

Sajikan sebagai tabel dengan risk level tiap item yang
mau dihapus. Tandai apapun yang confidence-nya di bawah
90% — JANGAN hapus itu. Lalu berhenti dan tunggu.

FASE 2 — EKSEKUSI (hanya setelah saya approve):
- Hapus yang sudah saya approve
- Extract logic terduplikasi ke shared utilities
- Pecah file yang kebesaran sesuai garis tanggung jawab

Aturan: behaviour harus tetap identik, tidak ada dependency
baru, tidak ada rename public API. Kasih saya ringkasan
tiap perubahan supaya bisa saya review diff-nya.
```

---

## 7/ Tulis Git Commit yang Rapi

> Nggak ada lagi "fix stuff" x40. History commit jadi dokumentasi.

```text
Review perubahan saya saat ini (staged dan unstaged) dan
susun jadi commit yang rapi.

1. Rangkum apa yang benar-benar berubah dan kenapa,
   dikelompokkan berdasarkan intent.
2. Pecah pekerjaan jadi commit atomic — satu perubahan
   logis per commit. Kalau ada yang mencampur fix dan
   refactor, pisahkan.
3. Untuk tiap commit, tulis pesan Conventional Commits:
   type(scope): ringkasan imperatif singkat di bawah 60
   karakter
   Lalu baris kosong dan body yang menjelaskan KENAPA
   perubahan ini diperlukan beserta tradeoff-nya. Tandai
   breaking change dengan BREAKING CHANGE:.
4. Urutkan commit supaya repo tetap build dan test pass
   di setiap langkah.
5. Keluarkan perintah git yang persis, berurutan,
   termasuk file mana masuk commit yang mana.

Tipe: feat, fix, refactor, perf, docs, test, chore, style,
build, ci
Jangan pernah tulis pesan samar seperti "update", "fix
stuff", "changes" atau "wip".
```

---

## Daftar Protokol (ringkas)

| # | Nama | Kapan dipakai | Aturan kunci |
|---|------|---------------|--------------|
| 3 | Security Audit | Sebelum deploy fitur besar | Temuan urut severity, JANGAN ubah kode sebelum approve, kategori bersih disebut eksplisit |
| 4 | Debug Error | Ada bug/perilaku aneh | Diagnosa dulu → hipotesis → konfirmasi → tunggu → fix minimal (`docs/DEBUG-PROTOCOL.md`) |
| 5 | E2E Playwright | Sebelum rilis besar | Journey di-approve dulu, happy path + failure state, data-testid, auth fixture |
| 6 | Dead Code Cleanup | Rutin / setelah fitur selesai | Fase 1 audit (no touch) → table + risk level → berhenti → fase 2 hanya yang di-approve |
| 7 | Git Commit Rapi | Setiap selesai kerja | Conventional Commits, atomic, body jelaskan KENAPA, repo harus build di tiap langkah |
