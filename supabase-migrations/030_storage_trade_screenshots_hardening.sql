-- ══════════════════════════════════════════════════════════════════════════════
-- 030 — STORAGE HARDENING: bucket `trade-screenshots` (security audit #7)
-- ══════════════════════════════════════════════════════════════════════════════
-- Konteks (audit 2026-11-01):
--   • Screenshot trade di-upload lewat SERVICE KEY (bypass RLS) ke bucket
--     `trade-screenshots` oleh 2 jalur:
--       1. extractTradeData.uploadScreenshot()  → path `{userId}/{timestamp}.jpg`
--       2. /api/analyze-screenshot              → path kini `{userId}/ai_*.ext`
--          (FIX 030: dulu dilempar di ROOT bucket tanpa pemilik)
--   • URL yang disimpan di kolom trades.screenshot_url adalah PUBLIC URL —
--     jadi bucket kemungkinan besar PUBLIC. Public bucket = siapa pun yang
--     tahu path bisa melihat gambar (path berisi UUID + timestamp → sulit
--     ditebak, tapi bukan desain privacy yang benar).
--   • Migrasi ini TIDAK otomatis flip public→private, karena URL public yang
--     sudah tersimpan di DB lama akan mati semua (fitur rusak). Flip dilakukan
--     SETELAH jalur signed URL diimplementasikan (lihat catatan di bawah).
--
--  Yang dilakukan migrasi ini (aman, tidak merusak apa pun):
--   A. Pastikan bucket `trade-screenshots` ADA (buat private kalau belum ada)
--      + set ukuran max 10MB, MIME image/*.
--   B. Pasang policy owner-scoped di storage.objects — SEKARANG no-op (bucket
--      masih public), tapi WAJIB sudah terpasang sebelum flip private.
--   C. DIAGNOSTIK: laporkan status bucket, policy, jumlah objek.
--   D. (DIKOMENTARI) Flip private — JANGAN dijalankan sebelum fitur signed
--      URL aktif, kalau tidak semua screenshot lama tidak akan tampil.
-- ══════════════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────────────────
-- A. PASTIKAN BUCKET ADA (idempoten)
-- ──────────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'trade-screenshots',
  'trade-screenshots',
  false,                        -- private by default kalau bucket baru dibuat
  10485760,                     -- 10 MB (selaras limit route analyze-screenshot)
  array['image/jpeg','image/png','image/webp','image/jpg','image/heic','image/heif']
)
on conflict (id) do nothing;

-- ──────────────────────────────────────────────────────────────────────────────
-- B. POLICY OWNER-SCOPED DI storage.objects (idempoten)
--    Skema path: folder pertama = user_id (UUID) → auth.uid() harus sama.
--    Berlaku penuh begitu bucket di-flip private; sekarang sekadar disiapkan.
-- ──────────────────────────────────────────────────────────────────────────────
do $$
begin
  -- SELECT (lihat + minta signed URL milik sendiri)
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'trade-screenshots owner select'
  ) then
    create policy "trade-screenshots owner select"
      on storage.objects for select
      to authenticated
      using (
        bucket_id = 'trade-screenshots'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );
  end if;

  -- INSERT (kalau suatu saat upload pindah ke user-JWT client)
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'trade-screenshots owner insert'
  ) then
    create policy "trade-screenshots owner insert"
      on storage.objects for insert
      to authenticated
      with check (
        bucket_id = 'trade-screenshots'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );
  end if;

  -- UPDATE (ganti nama / metadata milik sendiri)
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'trade-screenshots owner update'
  ) then
    create policy "trade-screenshots owner update"
      on storage.objects for update
      to authenticated
      using (
        bucket_id = 'trade-screenshots'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      )
      with check (
        bucket_id = 'trade-screenshots'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );
  end if;

  -- DELETE (hapus milik sendiri)
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'trade-screenshots owner delete'
  ) then
    create policy "trade-screenshots owner delete"
      on storage.objects for delete
      to authenticated
      using (
        bucket_id = 'trade-screenshots'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );
  end if;
end
$$;

-- ──────────────────────────────────────────────────────────────────────────────
-- C. DIAGNOSTIK — jalankan, kirim hasilnya ke Z
-- ──────────────────────────────────────────────────────────────────────────────
-- C1. Status bucket (public atau private?)
select id, public, file_size_limit, allowed_mime_types,
       created_at, updated_at
from storage.buckets
where id = 'trade-screenshots';

-- C2. Policy yang menempel di storage.objects utk bucket ini
select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and qual::text like '%trade-screenshots%'
   or with_check::text like '%trade-screenshots%';

-- C3. Jumlah objek + contoh path (cek skema path lama vs baru)
select count(*)                                   as total_objects,
       count(*) filter (where name like '%/%')    as under_user_folder,
       count(*) filter (where name not like '%/%') as at_root_legacy
from storage.objects
where bucket_id = 'trade-screenshots';

-- C3b. 5 contoh path terbaru (lihat pola {userId}/... vs root)
select name, created_at
from storage.objects
where bucket_id = 'trade-screenshots'
order by created_at desc
limit 5;

-- ──────────────────────────────────────────────────────────────────────────────
-- D. FLIP PRIVATE (JANGAN DIJALANKAN DULU!)
--    Syarat sudah terpenuhi:
--      1. Signed URL endpoint aktif + UI pakai itu untuk menampilkan gambar
--      2. Semua upload baru sudah owner-scoped ({userId}/...)
--    Konsekuensi: semua URL public lama yang tersimpan di trades.screenshot_url
--    mati (gambar lama tak tampil) — trade-off yang disetujui Bos dulu.
--
-- update storage.buckets set public = false where id = 'trade-screenshots';
-- ══════════════════════════════════════════════════════════════════════════════
