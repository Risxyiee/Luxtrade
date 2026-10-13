#!/bin/bash

# Detect environment and use appropriate schema
if [ -n "$DATABASE_URL" ]; then
  if [[ "$DATABASE_URL" == postgresql://* ]] || [[ "$DATABASE_URL" == postgres://* ]]; then
    echo "🔗 Using PostgreSQL schema for production"
    cp prisma/schema.prisma.pgsql prisma/schema.prisma
  else
    echo "📁 Using SQLite schema for development"
    cp prisma/schema.prisma.sqlite prisma/schema.prisma 2>/dev/null || true
  fi
fi

# Generate Prisma Client
bun run db:generate
