-- ============================================================
-- MIGRASI: Increment saldo affiliate ATOMIK (audit #21)
-- ============================================================
-- MASALAH: kode aplikasi membaca saldo → menulis saldo+komisi
-- (read-modify-write absolut). Dua aktivasi paralel membaca
-- saldo sama → menulis nilai sama → SATU KOMISI HILANG dari
-- saldo withdraw affiliate (uang nyata).
--
-- SOLUSI: RPC Postgres yang menambah saldo DI SISI DATABASE
-- (atomic increment) + menaikkan saldo dashboard referrer dan
-- referral_count dalam SATU transaksi.
--
-- CARA PASANG: jalankan file ini di Supabase Dashboard →
-- SQL Editor (sekali). Aplikasi otomatis memakai RPC bila
-- tersedia, dan fallback ke jalur lama bila belum dipasang.
-- ============================================================

create or replace function public.increment_affiliate_balance(
  p_affiliate uuid,
  p_user uuid,
  p_amount numeric
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance numeric;
begin
  update public.affiliates
     set current_balance = coalesce(current_balance, 0) + p_amount,
         total_earned    = coalesce(total_earned, 0) + p_amount
   where id = p_affiliate
  returning current_balance into v_balance;

  if p_user is not null then
    update public.profiles
       set affiliate_balance = coalesce(affiliate_balance, 0) + p_amount,
           referral_count    = coalesce(referral_count, 0) + 1,
           updated_at        = now()
     where id = p_user;
  end if;

  return v_balance;
end;
$$;

-- SECURITY: fungsi hanya boleh dieksekusi service_role (server).
revoke all on function public.increment_affiliate_balance(uuid, uuid, numeric) from public;
revoke all on function public.increment_affiliate_balance(uuid, uuid, numeric) from anon;
revoke all on function public.increment_affiliate_balance(uuid, uuid, numeric) from authenticated;
grant execute on function public.increment_affiliate_balance(uuid, uuid, numeric) to service_role;
