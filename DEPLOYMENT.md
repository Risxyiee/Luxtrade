# Deployment Guide — LuxTrade

**Platform:** Cloudflare Workers
**Domain:** luxtradee.web.id

---

## Build & Deploy

```bash
# Build for Cloudflare Workers
bun run build:next                    # Step 1: Next.js build
npx opennextjs-cloudflare build       # Step 2: OpenNext optimization

# Or use the build script
bash build.sh

# Deploy
wrangler deploy
```

### Local Development

```bash
wrangler dev       # Run locally via Wrangler
bun run dev        # Standard Next.js dev server
```

---

## Configuration Files

| File | Purpose |
|------|---------|
| `wrangler.toml` | Cloudflare Workers config (name, bindings, vars, observability) |
| `open-next.config.ts` | OpenNext Cloudflare adapter (edge route exclusions) |
| `build.sh` | Build script (next build + opennextjs-cloudflare build) |
| `next.config.ts` | Next.js config with `output: 'standalone'` |

---

## Environment Variables

### Required (app will not work without these)

| Variable | Description | Source |
|----------|-------------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | Supabase Dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin key **(set as secret)** | Supabase Dashboard → Settings → API |

### Set secrets via Wrangler

```bash
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

Non-secret vars (NEXT_PUBLIC_*) are defined in `wrangler.toml` under `[vars]`.

### Important (for specific features)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SITE_URL` | Site URL for links and webhooks |
| `RESEND_API_KEY` | Email sending (verification, password reset, broadcast) |
| `MIDTRANS_SERVER_KEY` / `MIDTRANS_CLIENT_KEY` | Midtrans payment gateway |
| `GEMINI_API_KEY` | AI chat, vision, auto-journal |

### Optional

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | TTS and AI fallback |
| `OPENROUTER_API_KEY` | AI vision fallback |
| `HUGGING_FACE_API_TOKEN` | Free OCR vision fallback |
| `METAAPI_TOKEN` | Real-time broker data sync |
| `ADMIN_EMAILS` | Admin panel access |

---

## Cloudflare Workers Limits

| Limit | Free | Paid |
|-------|------|------|
| Subrequests per invocation | 50 | 50 |
| Worker size (bundled) | 10 MB | 25 MB |
| CPU time | 10 ms | 30 s |

Email broadcast uses batch processing (25 per batch) to stay under the subrequest limit.

---

## Deployment Checklist

- [ ] Supabase project active, schema migrated
- [ ] Storage bucket `trade-screenshots` created (public)
- [ ] All required env vars set in Cloudflare Dashboard or `wrangler.toml`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set as Wrangler secret
- [ ] `wrangler deploy` succeeds
- [ ] Login/signup works
- [ ] Dashboard loads after auth
- [ ] Trade creation + screenshot upload works
- [ ] AI features work (if API keys set)

---

## Rollback

```bash
# Redeploy previous version
git checkout <previous-commit>
wrangler deploy

# Or rollback in Cloudflare Dashboard → Workers → Deployments → Rollback
```

---

## References

- [OpenNext Cloudflare Docs](https://opennext.js.org/cloudflare)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)
- [Supabase Docs](https://supabase.com/docs)
