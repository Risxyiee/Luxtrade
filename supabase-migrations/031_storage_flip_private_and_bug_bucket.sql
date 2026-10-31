-- ══════════════════════════════════════════════════════════════════════════════
-- 031 — STORAGE FINAL: flip `trade-screenshots` PRIVATE + policy bucket `screenshots`
-- ══════════════════════════════════════════════════════════════════════════════
-- PRASYARAT (WAJIB): deploy kode yang menyertakan src/lib/screenshot-url.ts
-- sudah LIVE dulu (push ini) — resolver signed-URL dipakai UI untuk render.
-- Urutan: push → tunggu deploy CF selesai → baru jalankan file ini.
--
-- Yang dilakukan:
--   A. Bucket `screenshots` (bug report, upload client-JWT):
--      pastikan ada + policy owner (folder ke-2 = uid) + admin read.
--      TIDAK di-flip — publicUrl admin view tetap aman.
--   B. Bucket `trade-screenshots`: pindahkan objek legacy root ke folder
--      pemilik (pemetaan via trades.screenshot_url), perbarui URL di trades,
--      lalu FLIP PRIVATE (owner-only via policy 030).
--   C. Verifikasi.
-- ══════════════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────────────────
-- A1. Pastikan bucket `screenshots` ada (bug report). Kalau baru dibuat:
--     public=true (selaras perilaku publicUrl yang dipakai admin view).
-- ──────────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'screenshots', 'screenshots', true, 10485760,
  array['image/jpeg','image/png','image/webp','image/jpg','image/heic','image/heif']
)
on conflict (id) do nothing;

-- ──────────────────────────────────────────────────────────────────────────────
-- A2. Policy bucket `screenshots` — skema path: `bug-reports/{uid}/{file}`
--     → folder ke-1 = 'bug-reports', folder ke-2 = user_id.
-- ──────────────────────────────────────────────────────────────────────────────
do $$
begin
  -- Owner INSERT (biar upload bug report client-side pasti jalan)
  if not exists (select 1 from pg_policies
    where schemaname='storage' and tablename='objects'
      and policyname='screenshots bug owner insert') then
    create policy "screenshots bug owner insert" on storage.objects for insert
      to authenticated
      with check (
        bucket_id = 'screenshots'
        and (storage.foldername(name))[1] = 'bug-reports'
        and (storage.foldername(name))[2] = (select auth.uid())::text
      );
  end if;

  -- Owner SELECT (pemilik boleh lihat/signed miliknya)
  if not exists (select 1 from pg_policies
    where schemaname='storage' and tablename='objects'
      and policyname='screenshots bug owner select') then
    create policy "screenshots bug owner select" on storage.objects for select
      to authenticated
      using (
        bucket_id = 'screenshots'
        and (storage.foldername(name))[1] = 'bug-reports'
        and (storage.foldername(name))[2] = (select auth.uid())::text
      );
  end if;

  -- Owner UPDATE + DELETE
  if not exists (select 1 from pg_policies
    where schemaname='storage' and tablename='objects'
      and policyname='screenshots bug owner update') then
    create policy "screenshots bug owner update" on storage.objects for update
      to authenticated
      using (
        bucket_id = 'screenshots'
        and (storage.foldername(name))[1] = 'bug-reports'
        and (storage.foldername(name))[2] = (select auth.uid())::text
      )
      with check (
        bucket_id = 'screenshots'
        and (storage.foldername(name))[1] = 'bug-reports'
        and (storage.foldername(name))[2] = (select auth.uid())::text
      );
  end if;

  if not exists (select 1 from pg_policies
    where schemaname='storage' and tablename='objects'
      and policyname='screenshots bug owner delete') then
    create policy "screenshots bug owner delete" on storage.objects for delete
      to authenticated
      using (
        bucket_id = 'screenshots'
        and (storage.foldername(name))[1] = 'bug-reports'
        and (storage.foldername(name))[2] = (select auth.uid())::text
      );
  end if;

  -- ADMIN read (panel bug report menampilkan screenshot laporan user)
  if not exists (select 1 from pg_policies
    where schemaname='storage' and tablename='objects'
      and policyname='screenshots admin read') then
    create policy "screenshots admin read" on storage.objects for select
      to authenticated
      using (
        bucket_id = 'screenshots'
        and exists (
          select 1 from public.profiles p
          where p.id::text = (select auth.uid())::text
            and p.role in ('ADMIN','SUPER_ADMIN')
        )
      );
  end if;
end
$$;

-- ──────────────────────────────────────────────────────────────────────────────
-- B1. Perbarui dulu URL legacy di trades.screenshot_url (root → folder uid)
--     Sebelum objek dipindah, supaya nama root masih cocok untuk mapping.
-- ──────────────────────────────────────────────────────────────────────────────
update trades t
set screenshot_url = replace(
      t.screenshot_url,
      '/trade-screenshots/' || o.name,
      '/trade-screenshots/' || t.user_id::text || '/' || o.name
    )
from storage.objects o
where o.bucket_id = 'trade-screenshots'
  and o.name not like '%/%'
  and t.screenshot_url like '%' || o.name;

-- ──────────────────────────────────────────────────────────────────────────────
-- B2. Pindahkan objek legacy root → folder pemiliknya
-- ──────────────────────────────────────────────────────────────────────────────
update storage.objects o
set name = t.owner_id || '/' || o.name
from (
  select o2.id as obj_id,
         (select t2.user_id::text
          from trades t2
          where t2.screenshot_url like '%' || o2.name
          limit 1) as owner_id
  from storage.objects o2
  where o2.bucket_id = 'trade-screenshots'
    and o2.name not like '%/%'
) t
where o.id = t.obj_id
  and t.owner_id is not null;

-- ──────────────────────────────────────────────────────────────────────────────
-- B3. FLIP PRIVATE — bucket `trade-screenshots` kini owner-only
--     (policy "trade-screenshots owner *" dari migrasi 030 yang aktif)
-- ──────────────────────────────────────────────────────────────────────────────
update storage.buckets
set public = false
where id = 'trade-screenshots';

-- ──────────────────────────────────────────────────────────────────────────────
-- C. VERIFIKASI — jalankan, kirim hasilnya ke Z
-- ──────────────────────────────────────────────────────────────────────────────
-- V1. Status kedua bucket
select id, public, file_size_limit
from storage.buckets
where id in ('trade-screenshots', 'screenshots');

-- V2. Policy kedua bucket
select policyname, cmd
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
  and (policyname like 'trade-screenshots%' or policyname like 'screenshots %')
order by policyname;

-- V3. Sisa objek root yang TIDAK terpetakan (harus 0; kalau ada = file yatim
--     tanpa referensi trades → tidak akan tampil setelah flip, kirim listnya)
select name, created_at
from storage.objects
where bucket_id = 'trade-screenshots'
  and name not like '%/%';

-- V4. Jumlah objek per skema path
select count(*)                                       as total,
       count(*) filter (where name like '%/%')        as under_user_folder,
       count(*) filter (where name not like '%/%')    as at_root_leftover
from storage.objects
where bucket_id = 'trade-screenshots';
-- ══════════════════════════════════════════════════════════════════════════════
