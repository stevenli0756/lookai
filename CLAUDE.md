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
Phase 6 complete: real frontend shipped. Authenticated dashboard with image uploaders (drag-drop, validation, contained preview), credits display, polling status with animated gradient loader and rotating messages every 3s, result display with download. Build + lint clean. Phase 7 next: Stripe + Vercel deploy.

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
- 2026-04-25: model_image_url / garment_image_url columns store R2 object keys (not presigned URLs). Misleading column names inherited from Phase 1 spec. Storing keys is correct (presigned URLs expire in 1hr; keys are permanent). Defer column rename to polish pass — requires additional migration.
- 2026-04-25: SECURITY DEFINER functions must SET search_path = public to prevent schema-hijacking attacks. Applied to reserve_credit_and_create_generation. handle_new_user() in initial_schema migration is missing this — defer fix to polish pass migration.
- 2026-04-25: Non-transactional credit refund in /api/generate failure path (two separate UPDATEs). Acceptable for v0. TODO: wrap in RPC for atomicity if abuse becomes an issue.
- 2026-04-25: Phase 4 complete. RPC reserve_credit_and_create_generation handles atomic credit deduction. /api/generate orchestrates: auth → ownership check → concurrent check → RPC → presigned URLs → FASHN /run → update prediction_id. Refund path triggers on FASHN failure. Verified with real generation: credits 10→9, pending row created, FASHN prediction_id stored, result observed and quality acceptable.
- 2026-04-25: Refund function uses non-atomic read-then-write pattern (read credits_remaining, add 1, UPDATE). Race window exists where two concurrent refunds could both read same balance and both add 1, granting one extra credit. Acceptable for v0 (failure × concurrency × intent ≈ 0). TODO: wrap in RPC for atomicity if abuse pattern emerges.
- 2026-04-25: FASHN response field is `id`, not `prediction_id` as Phase 1 spec assumed. Mapped in fashn.ts client wrapper; DB column stays fashn_prediction_id (no schema impact).
- 2026-04-25: First FASHN result observed. Quality acceptable for v0. Garment fidelity preserved on test image. Continuing with FASHN as planned API.
- 2026-04-25: Phase 5 WIP. /api/jobs/[id] built with 7-step flow (auth → ownership → terminal cache → FASHN poll → R2 copy → DB update). copyExternalUrlToR2 updated to stream via response.body (Web ReadableStream) instead of buffering. output_format: "jpeg" added to submitGeneration for deterministic result extension. mapFashnStatus() helper added. Test pages rebuilt, end-to-end test pending next session.
- 2026-04-26: Phase 5 complete. /api/jobs/[id] polls FASHN, copies result to R2 via streaming (Readable.fromWeb() bridges Web ReadableStream → Node.js Readable; requestChecksumCalculation: "when_required" disables SigV4 body hashing for streaming compatibility). Verified end-to-end: pending→complete transition, result image in R2, DB row updated.
- 2026-04-26: R2 streaming fix required two iterations: (1) requestChecksumCalculation: "when_required" to skip SigV4 hash, (2) Readable.fromWeb() to convert Web ReadableStream to Node.js Readable. AWS SDK v3 on Node.js requires Node.js streams, not Web streams.
- 2026-04-26: PERMANENT RULE — manual DB cleanup SQL must always mirror full application invariants. Updating generations.status='failed' without refunding credits_remaining silently leaks credits. Correct pattern: use a CTE that updates generations RETURNING user_id, then updates profiles.credits_remaining += COUNT(*) in the same transaction. Never do a partial update that application code would not do. This mistake recurred twice — treat as a hard rule going forward.
- 2026-05-02: Phase 6 complete. Frontend implemented as 4 client components in src/app/app/components/: TryOnForm (orchestrator), ImageUploader (file picker with validation), PollingStatus (animated loader + rotating messages), ResultDisplay (image + download/reset). Replaced placeholder /app dashboard with real authenticated shell. Build + lint pass.
- 2026-05-02: Image preview cropping fix — switched from bg-cover (crop to fill) to bg-contain (fit fully with letterbox). Critical for fashion use case where users need to see the full image they uploaded. Applied to ImageUploader and ResultDisplay.
- 2026-05-02: Animated gradient loader + rotating status messages during polling. Replaced static dot with multi-color gradient ring (sky → violet → fuchsia) using Tailwind built-in animations (animate-pulse, animate-ping, arbitrary-value pulse). Messages rotate every 3s through 5 spec'd phrases. Both fixes essential for 'is this thing working?' perception during 5-30s wait.
- 2026-05-02: AWS SDK enum casing — requestChecksumCalculation value must be 'WHEN_REQUIRED' (uppercase) not 'when_required' (lowercase). Lowercase passed Phase 5 testing because dev mode skipped strict TypeScript check; production build caught the mismatch. Fixed during Phase 6.
