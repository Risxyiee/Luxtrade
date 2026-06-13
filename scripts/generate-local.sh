#!/bin/bash
# Generate Prisma client for local development (SQLite)

cp prisma/schema.local.prisma prisma/schema.prisma
bun run prisma generate