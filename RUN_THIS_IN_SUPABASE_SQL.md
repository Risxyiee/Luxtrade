# INSTRUKSI: Jalankan query ini di Supabase SQL Editor

# 1. Tambah kolom ai_free_quota_used ke tabel profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ai_free_quota_used INTEGER DEFAULT 0;

# 2. Cek apakah kolom berhasil ditambah
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'ai_free_quota_used';