# Database Configuration for Production

## Local Development

Database sudah terkonfigurasi dengan benar untuk local development:
- `.env` file: `DATABASE_URL=file:/home/z/my-project/db/custom.db`
- Database file: `/home/z/my-project/db/custom.db`

## Production Deployment

### Error yang Terjadi:
```
Error code 14: Unable to open the database file
```

### Solusi:

Di production server (Vercel/ hosting lain), environment variable `DATABASE_URL` **HARUS** di-set dengan format:

```
DATABASE_URL=file:./db/custom.db
```

### Cara Setting di Vercel:

1. Buka Vercel Dashboard
2. Pilih project `luxtradee`
3. Go to **Settings** → **Environment Variables**
4. Add new variable:
   - **Name**: `DATABASE_URL`
   - **Value**: `file:./db/custom.db`
   - **Environment**: Production, Preview, Development (pilih semua)

### Catatan Penting:

⚠️ **SQLite Tidak Cocok untuk Production Multi-Instance**

SQLite file-based database tidak cocok untuk:
- Vercel Serverless Functions (multiple instances)
- Multi-server deployment
- High-traffic applications

### Rekomendasi untuk Production:

Untuk production yang sebenarnya, gunakan database yang sesuai:

1. **PostgreSQL** (Recommended)
   - Gratis di Vercel dengan Neon Database
   - Support concurrent connections
   - Better performance

2. **MySQL** 
   - PlanetScale (gratis tier)
   - Supabase (gratis tier)

3. **MongoDB**
   - MongoDB Atlas (gratis tier)

### Migration ke PostgreSQL:

Jika ingin migrasi ke PostgreSQL:

1. Install Prisma PostgreSQL adapter:
   ```bash
   bun add pg
   ```

2. Update `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

3. Set DATABASE_URL di production:
   ```
   DATABASE_URL=postgresql://user:password@host:port/database
   ```

4. Run migration:
   ```bash
   bun run prisma migrate dev
   ```

## Quick Fix untuk Sekarang:

Untuk sekarang, set environment variable di Vercel:
```
DATABASE_URL=file:./db/custom.db
```

Tapi harap diingat: ini hanya temporary fix dan mungkin tidak bekerja sempurna di serverless environment.
