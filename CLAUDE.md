# LookAI — Virtual Try-On for DTC Brands

## Product Context
LookAI lets Shopify DTC brands upload a model photo + garment photo
and generate professional on-model product photos via AI.

Target user: Shopify brand founders ($500K–$5M revenue) who can't
afford regular photoshoots.

North Star Metric: Generated images downloaded per brand per week.

## v0 Scope (MUST have only)
- Email + Google auth
- Upload model photo + garment photo
- Call FASHN API to generate try-on
- Display result, allow download
- Credit system: 10 free, then $29/mo for 100 credits
- Stripe checkout

## Explicitly OUT of scope for v0
- Batch generation
- Shopify integration
- Custom model training
- Mobile app
- Team accounts

## Tech Stack
- Next.js 16 (16.2.4, App Router, TypeScript)
- Supabase (auth + Postgres)
- Cloudflare R2 (image storage)
- Stripe (payments)
- FASHN API (try-on generation)
- Vercel (hosting)
- Posthog (analytics)

## Conventions
- TypeScript strict mode, no `any` types
- Server components by default
- All API routes in src/app/api/
- Database access only via Supabase client in server components
- Never commit API keys; use .env.local
- Commit messages: imperative mood, < 72 chars

## Commands
- `npm run dev` — local dev server
- `npm run build` — production build
- `npm run lint` — ESLint check
- `npm test` — run tests

## Current Phase
Phase 3 complete: R2 + presigned upload route shipped and verified. Phase 4 next: FASHN integration + credit deduction logic.

## Current Priorities (updated weekly)
1. Ship upload → generate → download flow
2. Add auth + credit tracking
3. Wire up Stripe

## Decision Log
- 2026-04-18: Chose FASHN over Kling — better flat-lay quality for Shopify use case
- 2026-04-18: No custom model training in v0 — API-only to reduce scope
- 2026-04-17: Scaffolded on Next.js 16.2.4 (not 15) — new project, no reason to pin to older major; v16 breaking changes are syntax-level not architectural
- 2026-04-17: Phase 3 note — Next.js 16 renames middleware.ts to proxy.ts; update auth redirect implementation accordingly
- 2026-04-20: Phase 2a shipped: Supabase client wired, env.ts validates all three keys at startup, connection verified. Used @supabase/ssr (latest recommended for Next.js App Router). Three clients exist: server (session), server (service role admin), browser.
- 2026-04-20: Supabase renamed NEXT_PUBLIC_SUPABASE_ANON_KEY → NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in early 2026. Adapted env.ts and all client files. Lesson: specs from days ago already drift as platforms evolve.
- 2026-04-24: Phase 2b complete. Caught and corrected spec drift (stripe_customer_id removed, status enum fixed to 3 values: pending/complete/failed). Migration applied via supabase db push, tables verified with test route. Non-TTY supabase login workaround: use SUPABASE_ACCESS_TOKEN env var instead of interactive login.
- 2026-04-25: Phase 2c complete. proxy.ts (Next.js 16 naming), login/signup/signout, /auth/callback, /app dashboard. updateSession updated to return user alongside response for redirect check. Auth flow tested end-to-end.
- 2026-04-25: Phase 3 complete. R2 client wrapper (src/lib/r2.ts), /api/upload route with auth + type/size validation, presigned PUT URL pattern. Verified end-to-end via temp test page; file confirmed in R2 bucket.
- 2026-04-25: R2 CORS policy required for browser PUT uploads. Cloudflare dashboard shows a default placeholder that looks like a real saved policy but isn't until Save is clicked. v0 policy: localhost:3000 with GET/PUT/HEAD methods. Production deploy will require adding the Vercel/custom domain to AllowedOrigins.
