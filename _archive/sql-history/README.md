# SQL History Archive

This folder contains legacy SQL files that were previously scattered in the project root.
They are kept here for **reference only** and should **not** be executed against any live database.

## Going Forward: Use Prisma Migrations

For all future database schema changes, use **Prisma Migrations** instead of writing raw `.sql` files in the project root.

### Basic Workflow

```bash
# 1. Modify your schema in prisma/schema.prisma

# 2. Create a migration (generates a descriptive SQL file automatically)
npx prisma migrate dev --name describe_your_change

# 3. Apply migrations in production
npx prisma migrate deploy

# 4. If you just need to sync schema without migration history (local dev only)
npx prisma db push
```

### Why Prisma Migrations?

- **Tracked history** — every change is versioned and recorded
- **Reproducible** — any developer can replay migrations from scratch
- **Type-safe** — schema changes are reflected in Prisma Client automatically
- **No root clutter** — migration files live in `prisma/migrations/` where they belong
- **Team-friendly** — migration files are designed to be committed to git

### Do NOT

- Write new `.sql` files in the project root
- Manually modify database schema without updating `prisma/schema.prisma`
- Run raw SQL against production without a corresponding Prisma migration

## Files in This Archive

These are historical Supabase/PostgreSQL setup scripts from the project's early development.
They predate the switch to SQLite with Prisma and are preserved for reference only.