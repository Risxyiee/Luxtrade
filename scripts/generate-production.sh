#!/bin/bash
# Generate Prisma client for production (PostgreSQL)

# Restore production schema
cp prisma/schema.production.prisma prisma/schema.prisma 2>/dev/null || echo "Using existing schema.prisma for PostgreSQL"
bun run prisma generate