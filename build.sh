#!/bin/bash
# Build script for Cloudflare Workers
# This script runs opennextjs-cloudflare build directly without triggering loop

# Run next build
echo "Building Next.js app..."
bun run build:next

# Run opennextjs-cloudflare build (directly, not via npm script)
echo "Optimizing for Cloudflare Workers..."
npx opennextjs-cloudflare build