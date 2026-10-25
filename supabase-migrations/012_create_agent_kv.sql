-- 012_create_agent_kv.sql
-- KV store sederhana untuk Ruang CEO (/api/ceo-agent):
--   quota:<YYYY-MM-DD>   → hitung pemakaian Gemini Vision harian (CFO agent)
--   quota429:<YYYY-MM-DD>→ hitung event rate-limit 429
--   drafts:history       → riwayat 5 draf TikTok terakhir (CMO agent)
--   briefing:last        → snapshot morning briefing terakhir
--   acc_email:<YYYY-MM-DD>→ penanda dedup flow "ACC EMAIL"
--
-- Jalankan SEKALI di Supabase SQL Editor.

create table if not exists public.agent_kv (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now()
);

-- API route memakai SUPABASE_ANON_KEY (bukan service role),
-- jadi tabel ini butuh policy agar anon key bisa read/write.
alter table public.agent_kv enable row level security;

drop policy if exists "agent_kv anon read" on public.agent_kv;
create policy "agent_kv anon read"
  on public.agent_kv for select
  to anon, authenticated
  using (true);

drop policy if exists "agent_kv anon write" on public.agent_kv;
create policy "agent_kv anon write"
  on public.agent_kv for insert
  to anon, authenticated
  with check (true);

drop policy if exists "agent_kv anon update" on public.agent_kv;
create policy "agent_kv anon update"
  on public.agent_kv for update
  to anon, authenticated
  using (true)
  with check (true);

grant select, insert, update on public.agent_kv to anon, authenticated, service_role;
