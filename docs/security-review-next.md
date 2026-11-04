# Security Review — Luxtrade (Round 2)

| | |
|---|---|
| **Repo** | `Risxyiee/Luxtrade` |
| **Commit yang diaudit** | `005b2b6c` — "chore: bump fingerprint 2026-11-05.1 (Sinta Brain v4)", 2026-11-04T10:48:11Z (HEAD `origin/main` saat fetch) |
| **Commit perbaikan** | lokal (belum di-push) — daftar file di §7 |
| **Metode** | Fetch HEAD fresh dari GitHub → 6 jalur audit paralel (route inventory 290 route.ts / 416 handler, debug/auth-admin, Midtrans, Android+workflows, integrasi+cron, money/data) → verifikasi caller manual → implementasi P0 → regression test |
| **Aturan** | Tidak deploy production, tidak menjalankan migration, tidak mengubah data/secret/dashboard production, tidak menjalankan endpoint debug di production |

> Disiplin redaksi: nilai secret/token/password **tidak** ditulis di dokumen ini.
> Status temuan: **FIXED** = diperbaiki di commit ini · **STILL PRESENT** = masih ada di kode · **UNVERIFIED** = perlu akses dashboard/log untuk memastikan.

---

## 1. Jawaban atas keluhan login ("email & password salah terus")

Ditemukan **backdoor yang paling mungkin menjadi penyebab**: `POST /api/auth/admin-login` (file: `src/app/api/auth/admin-login/route.ts`).

- **Bukti (baris 88–98)**: endpoint ini **tanpa autentikasi dan tanpa rate limit**. Jika login dengan email+password gagal, ia langsung menjalankan `updateUserById(userId, { password: password, email_confirm: true })` — artinya **siapa pun yang POST `{email, password-apapun}` akan MENGGANTI password akun tersebut** menjadi nilai yang dia kirim, lalu menerima session penuh.
- **Konsekuensi**: jika endpoint ini pernah di-hit (oleh bot, eksplorasi, atau skrip lama) memakai email Anda dengan password lain, password lama Anda "hilang" — Supabase membalas persis `Invalid login credentials` yang UI terjemahkan menjadi *"Email atau password salah. Coba lagi atau reset password."*
- **Status**: **FIXED** — route dihapus di commit ini (zero caller terverifikasi; canary watchdog internal `master-autonomous` justru mengharapkan route ini 404).

Dua penyebab alternatif (masih perlu dicek manual):

1. **Akun terhapus dari Supabase Auth** — gejala identik (`invalid login credentials` juga dikembalikan untuk user yang tidak ada). Bukti bahwa kondisi ini pernah terjadi: `src/app/api/auth/signup/route.ts:169–177` punya cleanup "User sudah dihapus dari Supabase Auth". → UNVERIFIED (butuh Supabase Dashboard).
2. **Cache key anon lama di localStorage (TTL 24 jam)** — setelah rotasi key 2026-10-30, browser dengan config cache `luxtrade_sb_config` lama mengirim key mati ke GoTrue. (`src/lib/config-loader.ts:24–25`.) → Perbaikan sisi user: clear site data.

**Yang TIDAK menjadi penyebab** (sudah disisir): tidak ada kode ban/disable akun, tidak ada cron yang menyentuh `password`/`email_confirm`, footgun `updateUserById` dengan top-level `email` sudah diperbaiki di `sync-user`.

**Langkah pemulihan akun Anda** → lihat §9 langkah manual #1–#3.

---

## 2. Ringkasan eksekutif

- 290 file route di `src/app/api/**`. **Middleware sengaja mem-bypass semua `/api/*`** (`src/middleware.ts:130–133` — "API routes handle their own auth"), jadi proteksi sepenuhnya per-route.
- Ditemukan **36 route debug/backdoor tanpa autentikasi** (SQL injection + DDL, pemberian PRO gratis, reset password siapa pun, relay email, dump PII/trade lintas user, bocor prefix service key/DATABASE_URL). **Semua terhapus (FIXED)** setelah grep caller = nol.
- **`android/keystore.jks` (production signing key) ter-track di GitHub publik sejak 2026-09-26** — STILL PRESENT, butuh keputusan Anda (jangan dihapus otomatis).
- **Midtrans (provider aktif)**: validasi signature ✅ benar & timing-safe; tetapi ada 6 kelemahan alur uang (order tersimpan *setelah* Snap, webhook selalu 200, idempotensi TOCTOU, konsumsi kuota promo rusak). STILL PRESENT — patch plan di §6, butuh persetujuan karena menyentuh alur pembayaran.
- **MetaApi**: memang sudah diputuskan di-retire (2025-11) tapi 2 route + lib masih hidup tanpa caller → **FIXED** (dihapus; kolom `metaapi_account_id` DIPERTAHANKAN karena dipakai webhook fxblue/myfxbook).
- Workflow APK: 21 server secret di-inject ke runner build static → **FIXED** (blok env dihapus); `testsprite.yml` menutupi kegagalan dengan `|| true` → **FIXED**.

---

## 3. Temuan P0 — database / debug / auth

| # | Severity | File + handler | Bukti konkret | Status | Dampak | Aksi | Test |
|---|---|---|---|---|---|---|---|
| P0-1 | 🔴 Critical | `src/app/api/debug/columns/route.ts` GET | L10–11 `table` dari query string; L15–29 `$queryRawUnsafe` interpolasi `'${table}'` (SQLi); L33–45 loop `ALTER TABLE ${table} ALTER COLUMN ... DROP NOT NULL` **di setiap GET** tanpa auth | **FIXED (dihapus)** | SQL injection + merusak constraint schema produksi oleh siapa pun | Sudah dihapus; perbaikan schema via migration tertinjau | Regression #1 (404) ✔ |
| P0-2 | 🔴 Critical | `admin/debug-activate` POST, `admin/simple-activate` POST, `admin/test-activation` GET, `admin/test-pro` POST | Semua **tanpa `requireAdmin`**; mis. `test-activation` L54–67 set `is_pro: true` utk `?userId=` sembarang; `debug-activate` L57–75 REPLACE seluruh `user_metadata` | **FIXED (dihapus)** | Siapa pun bisa jadi PRO gratis 30 hari + merusak metadata (role/referral ikut terhapus) | Sudah dihapus | Regression #1 ✔ |
| P0-3 | 🔴 Critical | `src/app/api/auth/admin-login/route.ts` POST | L88–98 reset password dari body tanpa auth (lihat §1) | **FIXED (dihapus)** | Takeover akun siapa pun (kemungkinan penyebab login Anda gagal) | Sudah dihapus | Regression #1 ✔ |
| P0-4 | 🟠 High | `src/app/api/auth/force-confirm/route.ts` POST | L20–27 terima `{email}`; L80–82 `updateUserById(userId, { email_confirm: true })` via Admin API, tanpa bukti kepemilikan email/session; oracle enumerasi via `confirmed` | **FIXED (dihapus)** — caller di repo: nol | Konfirmasi akun orang lain tanpa bukti kepemilikan | Sudah dihapus | Regression #1 ✔ |
| P0-5 | 🔴 Critical | `debug/trades`, `debug/accounts-check`, `debug/production`, `debug/sync`, `debug/db` | `debug/trades` L6–13 dump **semua profile (email, is_pro) + 5 trade terakhir semua kolom** tanpa auth; `accounts-check` L44–64 kirim **10 akun trading user lain** (service-role, bypass RLS) + `error.stack` L80–82; `production` L77–81 daftar user; `sync` L68–72 listUsers | **FIXED (dihapus)** | Kebocoran PII, email user, data trading, stack trace | Sudah dihapus | Regression #1 ✔ |
| P0-6 | 🔴 Critical | `debug/show-env`, `debug/env`, `debug/check-env`, root `check-env`, `test-env`, `test/service-key`, `test`, `test/db`, `test-supabase`, `test-auth`, `admin/simple-test` | `show-env` L37 prefix 30-char `DATABASE_URL` + prefix key service/anon; `check-env` (root) prefix 20-char `SUPABASE_SERVICE_ROLE_KEY`; `test/service-key` prefix key + **listUsers penuh**; `test-auth` = endpoint tes password tanpa rate limit; `send-email` (debug) L20 = **relay email terbuka**; `check-buckets` daftar bucket service-role; `promo-codes` katalog kode promo lengkap; `check-promo-flow` konfigurasi kode promo apa pun | **FIXED (dihapus, 16+7 file)** | Bocor metadata kredensial (prefix+panjang) & PII; spam/phishing lewat domain Anda | Sudah dihapus. **Rotasi service key tetap disarankan** (prefix sudah pernah terekspos) | Regression #1 ✔ |
| P0-7 | 🟠 High | `admin/create-admin`, `admin/ensure-admin` | `create-admin` tanpa auth: listUsers + buat/inspeksi akun admin hardcoded (`email_confirm: true`) | **FIXED (dihapus)** | Orkestrasi akun admin oleh anonim | Sudah dihapus | Regression #1 ✔ |
| P0-8 | 🔴 Critical | `src/app/api/trading-accounts/test-create/route.ts` POST | L4–8 "TEMPORARY: API endpoint without authentication"; L22–39 buat trading account **untuk `body.user_id` sembarang** | **FIXED (dihapus)** | Primitif write lintas-user | Sudah dihapus | Regression #1 ✔ |
| P0-9 | 🟠 High | `admin/run-migration` POST (dipertahankan) | DDL via RPC `exec_sql`, token `MIGRATION_TOKEN` **fail-closed** (L51–59) ✅ | STILL PRESENT (aman) — catatan: RPC `exec_sql` tidak dibuat di repo; pastikan tidak ada di DB | DDL ter-token, risiko rendah | Biarkan; audit RPC di DB saat maintenance | — |
| P0-10 | 🟡 Info | `src/middleware.ts` L130–133 | `/api/*` di-bypass eksplisit; proteksi = per-route | STILL PRESENT (by design) | Route lupa guard = telanjang (yang lama sudah dibersihkan) | Pertahankan; disiplin guard per-route; page-level admin gate memakai email JWT **tanpa verifikasi** (redirect-only, forgeable — bukan trust boundary data) | Regression #2 |

**Endpoint admin yang dipertahankan dan terverifikasi ter-guard**: ~30 route `/api/admin/*` memakai `requireAdmin()` (`src/lib/admin-auth.ts:34–96` — session server-side + whitelist email + cek `profiles.role` via DB, **tidak** percaya `user_metadata` dari client). Termasuk `users`, `users/[id]` (DELETE auth user), `activate`, `withdrawals`, `email-broadcast`, `debug`, `db-sync`, `run-migration`, `setup-db` (L18–23 cek role sendiri), `push/*`, `seed-plans`, `migrate*`, `fix-rls`, `payment/callback-debug`.

---

## 4. Temuan P0 — kredensial & Android

| # | Severity | File | Bukti | Status | Dampak | Aksi |
|---|---|---|---|---|---|---|
| P0-11 | 🔴 Critical | `android/keystore.jks` | **Tracked di git, ada di GitHub publik** sejak `9399c4d1` (2026-09-26), dihapus `4972aba7` (09-27), **re-added byte-identik `4f914da4` (2026-10-13) → masih di HEAD** (blob 2766 bytes). `android/.gitignore` `#*.jks` dikomentari. `twa-manifest.json` membeberkan `path: keystore.jks, alias: "luxtradee"` (alias publik). **Tidak ada signingConfig gradle** di repo → build CI menghasilkan APK unsigned; key hanya dipakai TWA. Password TIDAK ada di repo. | **STILL PRESENT — butuh keputusan Anda (jangan dihapus/rotasi otomatis)** | File private key publik; proteksi tinggal password keystore → jika lemah, penandatangan update berbahaya dimungkinkan | §9 langkah manual #4: backup aman → reset/upload-key di platform distribusi → baru bersihkan dari riwayat git |
| P0-12 | 🟠 High | `.github/workflows/build-apk.yml` | Step "Prepare environment" meng-inject **21 server secret** (service-role, Midtrans server key, Resend, VAPID private, dst.) ke env runner build static APK. Verifikasi: API routes di-strip pada static export, tidak ada `NEXT_PUBLIC` yang membaca server secret, log di-mask, tidak ada `.env` di artifact → **hari ini tidak ter-embed ke APK, tapi by-luck bukan by-design** | **FIXED** — blok `env:` dihapus; loop placeholder tetap menulis `VAR=` kosong agar build tidak crash | Risiko paparan di runner + bom waktu kalau ada kode server yang terevaluasi saat prerender | Sudah diperbaiki; jalankan ulang build APK sekali untuk verifikasi |
| P0-13 | 🟡 Info | `android/app/google-services.json`, `capacitor.config.ts` | Firebase client config (publik by design), `allowNavigation` mengekspos hostname Supabase (publik) | STILL PRESENT (acceptable) | Rendah | — |

---

## 5. Temuan Midtrans (provider AKTIF)

Signature ✅: `src/lib/payment/midtrans.ts:61–77` — sha512(order_id+status_code+gross_amount+serverKey), fail-closed, timing-safe. Harga & durasi selalu dihitung server-side dari `PRICING` (`create-transaction` L80–118), client tidak pernah mengirim nominal ✅. Redirect `finish` tidak dipakai sebagai bukti aktivasi ✅ (`/dashboard` tidak membaca `?payment=finish`).

| # | Severity | File + handler | Bukti | Status | Dampak | Aksi (patch plan — butuh persetujuan, menyentuh alur pembayaran) |
|---|---|---|---|---|---|---|
| MT-1 | 🔴 Critical | `midtrans/create-transaction` L194–252 (+ unverified L164–177) | Snap dibuat **dulu**; insert `payment_orders` sesudahnya, dan gagalnya di-swallow (`catch { console.warn }`, insert di-skip bila `adminClient` null). Webhook L105–107 menjawab 200 "Order not found, acknowledged" | STILL PRESENT | Uang masuk, order tidak ada → tidak ada PRO, tidak ada jejak, **tidak ada reconciliations** | Simpan order **sebelum** Snap; bila Snap gagal → tandai order FAILED; tambah cron rekonsiliasi (poll Midtrans status utk PENDING > N menit) |
| MT-2 | 🟠 High | `midtrans/webhook` L57–60, 94–97, 240–243 | Semua jalur gagal (signature salah, DB down, exception) dijawab **200** → Midtrans tidak pernah retry | STILL PRESENT | Order tersesat permanen saat DB sempat error | Invalid signature → 401; DB/internal error → 500 (memberi kesempatan retry); 200 hanya utk no-op yang diakui |
| MT-3 | 🟠 High | `midtrans/webhook` L124–135, 147–176, 183–190 | Idempotensi TOCTOU: `.update()` buta tanpa `.neq('status','SUCCESS')`+cek count; perpanjangan `subscription_until` read-modify-write tanpa transaksi; `user_subscriptions` tanpa unique constraint → duplikat aktif | STILL PRESENT | Notifikasi paralel/berulang → PRO ganda / durasi salah / komisi ganda | CAS update (`.eq(invoice).neq(status,'SUCCESS')` + cek count); perpanjangan via SQL atomik `GREATEST(subscription_until, now()) + interval`; unique index |
| MT-4 | 🟠 High | `midtrans/create-transaction` L254–266 vs `promo/apply` L28,36–41 | Konsumsi kuota promo via internal fetch **tanpa cookie/auth** dan body `{code,userId}` sementara `promo/apply` membaca `{promoCode,plan}` → selalu gagal diam-diam | STILL PRESENT | Diskon diberikan tanpa kuota terpakai & tanpa cek duplikat → kode promo bisa dipakai berulang (durasi menumpuk via MT-3) | Panggil logika apply langsung (server-side) atau forward session; catat redemption per `orderId` |
| MT-5 | 🟡 Medium | `create-transaction-unverified` L38–79 | Tanpa session; percaya `userId`,`email` (mitigasi: email cocok profil + akun <30 menit; kode sendiri memperingatkan "may be insufficient") | STILL PRESENT | Snap invoice atas nama user lain (spam invoice; tidak memberi PRO gratis) | Patch plan: kirim token signed saat signup atau batasi rate lebih ketat |
| MT-6 | 🟡 Medium | `midtrans/webhook` L109–122 | Nominal < order hanya `console.warn`, tetap aktivasi durasi penuh tersimpan | STILL PRESENT | Bayar kurang dapat durasi penuh (durasi diambil dari order tersimpan, bukan notifikasi) | Tolak/flag mismatch; durasi proporsional atau manual review |
| MT-7 | 🟡 Medium | `payment/confirm-payment` L38–44 (SakuraPay legacy) | Order diambil by invoiceNumber **tanpa cek `order.userId === user.id`** | STILL PRESENT — SakuraPay tidak dipakai; route masih hidup | Confirm/probe invoice orang lain (aktivasi tetap butuh provider bilang paid) | Tambah ownership check atau nonaktifkan provider legacy bersama sisa `payment/*` |
| MT-8 | 🟢 Low | `/auth/checkout?payment=success` (page L95–99, 482–487) | URL param menampilkan "Pembayaran Berhasil / sudah aktif" **tanpa verifikasi server** (UX saja, tidak ada grant server) | STILL PRESENT | UI menyesatkan | Cek `payment_orders` via session sebelum menampilkan sukses |

---

## 6. Temuan P1 — uang / data / integrasi

### 6a. Promo (STILL PRESENT — patch plan butuh persetujuan)
- **PR-1 🟠 High** `promo/apply` L97–105: "optimistic lock" `.eq('used_quota', old)` **tanpa cek count** — PostgREST tidak error saat 0 row ter-update → race bisa melewati `max_quota`. Duplikasi per-user TOCTOU (L112–123, tanpa unique constraint). Rollback (L121/148) menimpa kuota dgn nilai stale. → Gunakan pola atomik `promo-simple` (`UPDATE ... WHERE used_quota < max_quota RETURNING` + cek count) + unique index `(user_id, promo_code_id)`.
- **PR-2 🟡 Medium** `plan` dari body tidak divalidasi (L28/136; `promo-simple` L25/91) — masuk verbatim ke `user_subscriptions.plan`. → whitelist plan.
- **PR-3 🟡 Low** `promo/validate` tanpa auth (rate-limit saja) → oracle keberadaan kode + sisa kuota; `promo/active` fallback menampilkan kode inactive terbaru (L54–75).

### 6b. Withdrawal / komisi (STILL PRESENT)
- **WD-1 🟠 High** `affiliate/withdraw` L170–175: fallback pengurangan saldo pakai **nilai JS stale** (bukan `current_balance = current_balance - amount`) → double-spend paralel; pending-dup check juga TOCTOU (L153–164). Refund L197–204 mengembalikan saldo stale, tanpa syarat. → Pakai RPC `request_affiliate_withdrawal` selalu; hapus fallback; refund = SQL aritmetika + guard status.
- **WD-2 🟠 High** `admin/withdrawals` PATCH L49,70–98: tanpa guard status transisi → klik "reject" N kali = **refund N kali**; tanpa audit trail (admin id/ledger). → `WHERE status='REQUESTED'` + ledger + identitas admin.
- **WD-3 🟡 Medium** `admin/affiliate-withdrawals` L68–79: mark-paid non-idempotent (statistik `total_paid` bisa terhitung ganda).
- **WD-4 🟡 Medium** `lib/affiliate-commission.ts` L137–149 fail-open (insert tanpa `activation_key` bila error schema) + path fallback tanpa dedupe (L207–229); saldo RMW (L161–165). → Wajibkan migration `022`/`023` terpasang; fail-closed.

### 6c. Account deletion (STILL PRESENT)
- **DEL-1 🟠 High** `delete-account` L84–149: semua error delete diabaikan; auth deletion memakai **client anon/cookie** (bukan service role) dan error di-swallow → user bisa tetap login dgn data parsial; `payment_orders`, `user_subscriptions`, `affiliates` (+PII bank), referral, push subscriptions, storage bucket **tidak** dihapus; partial → `success:true`; tidak ada retry. → Service-role delete, cek tiap error, hapus storage, jawab jujur, job retry.

### 6d. Trades / import / share
- Ownership yang sudah benar ✅: `trades` GET/PUT/DELETE scoped, `trades/bulk` cap 500 + server-side user, `trading-accounts` & `[id]` scoped+UUID, `share-trade` cek kepemilikan, `storage/signed-url` (allowlist bucket, per-user prefix, `..` diblok, TTL ≤3600) — hardened.
- **TR-1 🟡 Medium** `trades` POST/PUT & `trades/bulk`: `account_id` tidak dicek kepemilikannya (user A bisa menempelkan trade ke akun user B). → Validasi `account.user_id === user.id`.
- **TR-2 🟡 Medium** `import` tanpa cap array & tanpa limit tier gratis (bypass `FREE_TRADE_LIMIT`); `import/file` tanpa size limit/rate limit (memory-DoS), MIME dari header client. → Cap + limit + sniff.

### 6e. Integrasi & cron
- **MetaApi** — **FIXED**: `src/lib/metaapi.ts`, `/api/metaapi/connect`, `/api/metaapi/deals` dihapus (caller nol; keduanya masih memanggil API dan mengembalikan `error.message` upstream). Kolom `metaapi_account_id` dipertahankan (dipakai webhook fxblue L91 / myfxbook L88).
- **TT-1 🟠 High** `tiktok/publish` L53–78: `videoUrl` dari body di-fetch server **tanpa allowlist host** (SSRF; butuh CRON_SECRET, fail-closed ✅; buffer penuh ke memori 100MB). → Allowlist host + streaming.
- **TT-2 🟡 Medium** Secret via query string: `tiktok/connect` `?key=` (L49), `pine-alerts` `?secret=` (L63), `worker-entry.ts` L116–119 `?key=` utk ceo-agent — nyangkut di log. → Header saja (butuh update workflow/caller; **patch plan, minta konfirmasi** karena menyentuh bootstrap OAuth manual).
- **TT-3 🟡 Medium** `lib/tiktok.ts` L531,542 fallback HMAC `'dev-only-secret'` + `ceo-agent` L2611/2629 fail-open bila CRON_SECRET & ADMIN_SECRET kosong. → Hapus fallback; fail-closed.
- **TT-4 🟡 Medium** `execute-action`: owner-only ✅, allowlist switch ✅, TAPI (a) TOCTOU double-execute — `decideAction` PATCH tanpa guard `status=eq.pending` (L242–264 vs `agent-proposals.ts:296–309`); (b) `html_body` LLM tanpa sanitasi (L58–63, 79–80); (c) `target_emails` validasi cuma `includes('@')` (L72). → CAS PATCH dulu, baru eksekusi; escape HTML; validasi email.
- **CR-1 🟡 Medium** 3 route unsubscribe GET tanpa token (forgeable/enumerable) — pola one-click umum; sarankan HMAC.
- **CR-2 ✅** Cron fail-closed terverifikasi baik: semua `/api/cron/*` menolak tanpa secret di production; `master-autonomous` bahkan sudah menghapus fallback `?secret=`. Canary "Raka" (`master-autonomous` L813–822) kini benar-benar dapat 404 untuk route yang dihapus (sebelumnya 400-validation memberi false all-clear).
- **CR-3 ✅** `worker-entry.ts`: `scheduled()` fail-closed (tanpa secret = tanpa header = routes reject); tidak ada queue consumer.

### 6f. Status codes jujur (P2 — daftar teratas)
Masih mengembalikan `success:true`/200 saat gagal (butuh perbaikan bertahap): `newsletter` L49–60 (insert gagal → "Successfully subscribed!"), `trades` L146–208 (error → 200 `{error}`), `auth/sync-user` (semua gagal → `success:true, skipped`), `news*` fallback, `calendar/events`, `ai/search` mock, `achievements/onboarding`, `admin/withdrawals` L29–31 (DB gagal → daftar kosong sukses), `promo/apply` ( semua HTTP 200), `midtrans/webhook` (lihat MT-2), `payment/callback`. → Normalisasi 4xx/5xx per kelompok.

### 6g. Workflow / CI (P2)
- `testsprite.yml` — **FIXED**: `|| true` pada test run dihapus (gagalan kini merah). `npm install -g ... || true` sengaja dipertahankan (benign; kegagalan terdeteksi di langkah npx).
- `video-bot-cron.yml`: beberapa `exit 0` soft-skip + IG final failure hanya warn → kegagalan posting berkepanjangan tampak hijau (P2, terdokumentasi sebagai fallback desain).
- Cron workflows (pine-alerts, instagram, master-autonomous): pakai header secret, gagal-keras pada non-2xx ✅; `master-autonomous-cron.yml:208` masih mendokumentasikan pola `?key=` (manual).
- `deploy.yml`: bersih (manual dispatch, tanpa masking; ID akun CF di komentar = low sensitivity).

---

## 7. File yang berubah (commit perbaikan ini — LOKAL, BELUM DI-PUSH)

**Dihapus (36 route/lib):**
```
src/app/api/debug/{columns,env,show-env,sync,production,db,trades,accounts-check,
  accounts-detail,trading-accounts,check-env,check-promo-flow,promo-codes,
  send-email,check-buckets,test-huggingface}/route.ts   (16)
src/app/api/{check-env,test-env,test-auth,test-supabase}/route.ts (4)
src/app/api/test/{route.ts,db/route.ts,service-key/route.ts}       (3)
src/app/api/auth/{admin-login,force-confirm}/route.ts              (2)
src/app/api/admin/{simple-test,create-admin,ensure-admin,simple-activate,
  debug-activate,test-activation,test-pro}/route.ts                (7)
src/app/api/trading-accounts/test-create/route.ts                  (1)
src/app/api/metaapi/{connect,deals}/route.ts + src/lib/metaapi.ts  (3)
```

**Diubah (2) / Ditambah (2):**
- `.github/workflows/build-apk.yml` — blok 21 server secret dihapus
- `.github/workflows/testsprite.yml` — masking `|| true` dihapus
- `scripts/regression-p0-routes.mjs` — regression suite baru (35 route terhapus → 404/405; 9 route tersisa → tolak anonim)
- `docs/security-review-next.md` — dokumen ini

**Yang sengaja TIDAK diubah** (menunggu keputusan Anda): keystore.jks, semua alur Midtrans, promo/withdrawal, tiktok/query-secret, unsubscribe, webhook status codes.

---

## 8. Test yang dijalankan (hasil nyata)

| Test | Hasil |
|---|---|
| `bunx tsc --noEmit` **baseline sebelum perubahan** (git stash) | 49 error — semua pre-existing (remotion, @types/bun, lightweight-charts, `send-alert`, `instagram/post`) |
| `bunx tsc --noEmit` **setelah perubahan** | 49 error — **identik, 0 error baru**; tidak ada error yang mereferensikan file terhapus |
| `bun run lint` (eslint .) | **exit 0, bersih** |
| `scripts/regression-p0-routes.mjs` vs dev server lokal | **🟢 SEMUA PASS** — 35/35 route terhapus → 404/405; 9/9 route tersisa menolak anonim (401/403/405; `downgrade-expired-pro` 200 hanya via dev-bypass terdokumentasi di localhost — di production wajib 403) |
| Test Midtrans/promo/withdrawal/konkurensi | **BELUM ada** — matrix disarankan di §10; tidak ditulis di commit ini karena menyentuh logika bisnis yang menunggu keputusan |
| Catatan kejujuran | Tidak ada test yang dijalankan terhadap production. Verifikasi production harus menunggu deploy dan dijalankan sebagai `BASE_URL=https://… node scripts/regression-p0-routes.mjs` (hanya probe yang diharapkan ditolak) |

---

## 9. Langkah manual yang perlu Anda lakukan

1. **Pulihkan akses login**: buka `/auth/forgot-password` → set password baru (flow recovery resmi, tanpa perlu endpoint debug). Jika email notifikasi tidak masuk, cek folder spam dan konfigurasi SMTP/Resend.
2. **Audit akun di Supabase Dashboard** (read-only): Authentication → Users → cari akun Anda: apakah masih ada? `email_confirmed_at`, `banned_until`, dan **Auth logs**: cari `PUT /admin/users` / update password yang bukan berasal dari Anda (bukti pemakaian backdoor admin-login).
3. **Rotasi kredensial yang prefix-nya pernah terekspos** oleh route debug yang baru dihapus (mereka membocorkan prefix 20–30 char + panjang): `SUPABASE_SERVICE_ROLE_KEY` (prioritas), token Resend, `DATABASE_URL` bila memakai host publik. Juga rotasi: **GitHub PAT** dan **Facebook Page token** yang pernah tercatat di percakapan sebelumnya. (Saya tidak bisa melakukannya — tidak punya akses dashboard, sesuai batasan.)
4. **Keputusan keystore** (P0-11): (a) pastikan backup `.jks` + password di tempat aman; (b) putuskan reset/upload-key di platform distribusi (Play App Signing key reset) — key sudah publik di GitHub ≥6 minggu; (c) setelah key baru aktif, baru bersihkan file dari git tracking + riwayat (BFG/filter-repo). **Saya tidak menghapus/rotasi otomatis.**
5. **Push & deploy**: commit perbaikan ini sengaja **belum di-push**. Setelah Anda push ke `main`, Workers Builds akan deploy otomatis. Segera setelahnya jalankan: `BASE_URL=https://<domain> node scripts/regression-p0-routes.mjs` (aman — semua probe diharapkan ditolak).
6. **Setujui / tolak patch plan** di §5 & §6 (Midtrans MT-1…MT-6, promo PR-1, withdrawal WD-1…WD-4, delete-account DEL-1, TikTok TT-1…TT-3, execute-action TT-4). Saya tidak menyentuh alur pembayaran/uang tanpa persetujuan.
7. **APK**: jalankan ulang workflow build APK sekali untuk memastikan build tetap hijau tanpa secret di runner (perubahan P0-12).
8. (Opsional) Bersihkan `public/sw.js` precache lama yang masih menyebut route terhapus — akan tergantikan otomatis pada build berikutnya.

---

## 10. Risk yang tersisa & matrix test yang perlu ditambahkan

**Risiko tersisa (setelah fix ini):** (1) keystore masih publik; (2) kelemahan alur uang Midtrans/promo/withdrawal masih ada (patch plan menunggu); (3) delete-account parsial; (4) SSRF tiktok-publish; (5) secret-via-query-string di 3 titik; (6) prefix service key terekspos historis (rotasi manual); (7) 200-tidak-jujur masih luas (P2).

**Matrix test regreso yang disarankan** (untuk CI berikutnya):
1. Anon / non-admin / admin terhadap setiap route mutasi admin (harus 401/403/405).
2. Dua user berbeda → isolasi trades/trading-accounts/share (A tidak bisa baca/tulis B).
3. Midtrans: signature valid/salah, nominal mismatch, retry ganda (idempotensi), webhook paralel.
4. Promo: claim konkuren > kuota (harus berhenti di max), redeem ganda per user.
5. Debug/backdoor: sudah tercakup `scripts/regression-p0-routes.mjs`.
6. delete-account: partial failure → response TIDAK sukses.
7. newsletter/news/sync-user: DB gagal → status HTTP jujur.
