# Cloudflare Workers Deployment Guide

## Prerequisites

- Cloudflare account with Workers plan (Free or Paid)
- GitHub repository connected to Cloudflare
- Project files ready

## Deployment Steps

### Option 1: Deploy via Cloudflare Dashboard

1. **Create Workers Project**
   - Go to Cloudflare Dashboard
   - Click "Workers & Pages" → "Create application"
   - Select "Create Worker"
   - Name your worker (e.g., `luxtrade`)
   - Click "Deploy"

2. **Connect GitHub Repository**
   - In the worker settings, click "Settings" → "Triggers"
   - Click "Connect to GitHub"
   - Select your repository `Risxyiee/Luxtrade`
   - Configure build settings:
     ```
     Build command: bun run build
     Build output directory: .open-next
     Root directory: (leave empty)
     Node.js version: 20.x
     ```

3. **Set Environment Variables**
   - Go to "Settings" → "Environment Variables"
   - Add all required variables:
     ```
     NEXT_PUBLIC_SUPABASE_URL
     NEXT_PUBLIC_SUPABASE_ANON_KEY
     GEMINI_API_KEY
     (add any other required env vars)
     ```

4. **Deploy**
   - Cloudflare will automatically build and deploy on push

### Option 2: Deploy via Wrangler CLI

```bash
# Install wrangler (if not installed)
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Deploy to Workers
wrangler deploy

# Or deploy with specific name
wrangler deploy --name luxtrade
```

### Option 3: Deploy via GitHub Actions

Create `.github/workflows/cloudflare.yml`:

```yaml
name: Cloudflare Workers Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    name: Deploy to Cloudflare Workers
    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Build
        run: bun run build

      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

## Build Process

The build command runs in two steps:

1. **`next build`** - Builds the Next.js application
2. **`opennextjs-cloudflare build`** - Optimizes for Cloudflare Workers

Output directory: `.open-next/`

## Configuration Files

- `wrangler.toml` - Cloudflare Workers configuration
- `next.config.ts` - Next.js configuration with `output: 'standalone'`
- `open-next.config.ts` - OpenNext Cloudflare adapter config

## Troubleshooting

### Build Timeout
- Increase build timeout in Cloudflare Dashboard (Settings → Builds)
- Or use GitHub Actions with longer timeout

### Worker Size Limit
- Free tier: 1MB (unbundled), 10MB (bundled)
- Paid tier: 10MB (unbundled), 25MB (bundled)
- If exceeding limit, consider:
  - Optimizing dependencies
  - Moving to Pages (if applicable)
  - Upgrading to Workers Paid plan

### Environment Variables Not Available
- Check variable names match (case-sensitive)
- Ensure variables are set in correct environment (Production/Preview)
- Add `NEXT_PUBLIC_` prefix for client-side variables

### Assets Not Loading
- Verify `assets` binding in `wrangler.toml`
- Check `.open-next/assets` directory exists
- Ensure assets are built correctly

## Local Testing

```bash
# Build the application
bun run build

# Test locally with wrangler
wrangler dev

# Or use preview URL after deployment
```

## Monitoring

View logs and metrics in Cloudflare Dashboard:
- Go to Workers & Pages → Your worker → Logs
- Check real-time logs, analytics, and errors

## Rollback

```bash
# Deploy previous commit
git checkout <previous-commit-hash>
git push origin main

# Or rollback in Cloudflare Dashboard
# Workers & Pages → Your worker → Deployments → Rollback
```

## Additional Resources

- [OpenNext Cloudflare Documentation](https://opennext.js.org/cloudflare)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)