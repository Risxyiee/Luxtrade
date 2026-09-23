# UPDATE DATABASE_URL DI VERCEL SEKARANG!

## LANGKAH PENTING - HARI INI JUGA:

### 1. Buka Vercel Dashboard
- Pergi ke https://vercel.com/dashboard
- Pilih project **luxtrade**

### 2. Pergi ke Environment Variables
- Klik **Settings** (kiri)
- Klik **Environment Variables** (menu sebelah kiri)

### 3. Cari DATABASE_URL
- Scroll sampai ketemu **DATABASE_URL**
- Klik tombol **Edit** (ikon pensil)

### 4. Ganti isinya jadi INI PERSIS:
```
postgresql://postgres:Riskiakbarp123@db.klxkdrfsfcoankbaoejn.supabase.co:5432/postgres
```

### 5. Klik Save

### 6. Redeploy
- Pergi ke **Deployments** (menu atas)
- Klik deployment terbaru
- Klik tombol **Redeploy**

### 7. Tunggu selesai
- Build harus sukses (hijau)
- Kalo error, kirim screenshot error-nya

---

## KENAPA ERROR?

Log lo masih nunjukkin port 6543:
```
Can't reach database server at `db.klxkdrfsfcoankbaoejn.supabase.co:6543`
```

Artinya Vercel masih pakai DATABASE_URL lama. Lo harus UPDATE DI DASHBOARD VERCEL, bukan di file!

---

## SETELAH DEPLOY SUKSES:

1. Buka www.luxtradee.web.id
2. Coba login
3. Coba tambah trade
4. Coba tambah account

Kalo masih error, kirim log baru.
