# 3-a — FARHAN (SEO Factory) — Programmatic SEO Terprogram

**Status:** ✅ SELESAI — 24/24 test lulus, lint bersih, tsc bersih (scoped file sendiri)

## File yang dibuat (hanya 3 + laporan ini)

| File | Isi |
|---|---|
| `src/lib/seo-factory.ts` | Otak murni ZERO-IMPORT: `SEO_SYMBOLS` (5 simbol) × `SEO_INTENTS` (6 intent) = 30 kombinasi; `pickSeoPages` (deterministik dari daySeed yyyymmdd WIB, skip slug existing, anti-duplikat, rotasi), `slugifySeo` (maks 70 char), `buildSeoPageHtml` (HTML murni h2/p/ul/table, konten inti BERBEDA per intent — anti doorway), `seoInternalLinks` (blok "Baca juga" `/blog/<slug>`). Marker ekstraksi: `/* ── OTAK SEO (MURNI)` … `/* ── AKHIR OTAK SEO` |
| `src/app/api/cron/seo-factory/route.ts` | Cron GET/POST `force-dynamic`, auth fail-closed (Bearer/x-cron-secret vs `CRON_SECRET`/`PINE_ALERT_CRON_SECRET`; dev tanpa secret diizinkan), lock in-memory `let running`, state di `agent_kv` kunci `seo-factory:state` `{lastRunAt, lastPublishAt, publishedToday, todayWib}` — **MAKS 1 halaman/run, cooldown KV 14 menit (anti dobel antar isolate CF), MAKS 3 halaman/hari WIB (Intl Asia/Jakarta, reset ganti hari)**. Data riil per-sumber try/catch: harga self-fetch `/api/candles?interval=15m&limit=80` (bar berjalan dibuang → close kedua-terakhir, timeout 8s), sinyal terakhir `market_alerts`, member `profiles` count, `signalCount7d`, kalender `economic_events` (42P01/does-not-exist → `[]`, tidak crash). Insert resilient: kolom SEO (migrasi 040) error → fallback kolom inti + meta ke `agent_kv 'blog_seo:<id>'`. Discord try/catch (gagal ≠ gagal publish). Respon jujur `{ok, action: published|skipped|cooldown|daily-cap, slug?, title?, error?}` |
| `scripts/test-seo-factory.mjs` | Pola persis `test-growth-sentinel.mjs` (Bun.Transpiler.extractPure antara marker → `new Function`). **24 kasus** ✅ |

## Fakta penting untuk agent lain

- **Kolom isi artikel `blog_posts` = `content_body`** (BUKAN `content`) — bukti: `supabase-migrations/015_create_ai_pending_actions.sql` & `015b` (`content_body TEXT NOT NULL DEFAULT ''`), dipakai `src/app/api/blog/posts/route.ts` & `src/app/api/cron/master-autonomous/route.ts:903`.
- Kolom SEO `slug/keyword/meta_description` = migrasi **040** (`supabase-migrations/040_blog_seo.sql`) — mungkin belum jalan; route ini fallback resilient (pola sama dgn Farhan lama di master-autonomous).
- Tabel `economic_events` **belum ada di supabase-migrations** — route sudah tahan-missing (42P01/PGRST205/does-not-exist → `[]`).
- ⚠️ **Jangan tulis `*/15` di dalam block comment `/** */`** — `*/` menutup komentar prematur (bug TS1005 yang pernah kena & sudah diperbaiki di route ini).
- Route ini **belum di-wire** ke `worker-entry.ts` (sesuai batasan tugas — Bos edit manual). Jika di-wire, throttle internal sudah menahan: 1/run + cooldown 14 mnt + cap 3/hari WIB.
- Semua teks UI/CI bahasa Indonesia. Angka di halaman hanya dari data riil; null → teks jujur "Belum ada sinyal baru hari ini … pantau terus".

## Hal yang sengaja TIDAK dilakukan

- TIDAK mengedit `worker-entry.ts`, schema.prisma, atau file lain milik/bersama agent 3-b.
- TIDAK membuat SQL migrasi baru (tabel `economic_events` tinggal untuk Bos).
- TIDAK menjalankan dev server / build / git / install package.
- TIDAK mengarang angka: harga/sinyal/kalender gagal → null + teks jujur.
- TIDAK menambah library baru (otak 100% zero-dependency agar bisa diekstrak Bun.Transpiler).

## Bukti test

```
bun scripts/test-seo-factory.mjs
══════════ HASIL: 24 lulus, 0 gagal ══════════
```
(8 seksi: slugify, matriks, pickSeoPages deterministik/skip/duplikat/rotasi, buildSeoPageHtml jujur + harga id-ID, konten inti 6 intent unik anti-doorway, kalender ekonomi skip/tampil, social proof riil/nol, internal links.)
