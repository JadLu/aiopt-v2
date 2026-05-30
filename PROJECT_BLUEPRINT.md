# Project Blueprint — All-in-One E-commerce Tool (MENA)

> **Document purpose.** This blueprint is the single source of truth for the project. It is written to be readable by humans *and* by Claude Code as a persistent context document. Place it at the root of the repo as `BLUEPRINT.md` (alongside a shorter `CLAUDE.md` of conventions). Update it as decisions evolve — never let it drift.

> **Status.** v1.0 — pre-implementation. Reviewed against the original Project Specification PDF.

---

## 1. Vision & Scope

### 1.1 One-line description
An integrated SaaS platform that lets MENA-region e-commerce entrepreneurs go from product idea → market research → marketing strategy → creative assets (images, videos, landing pages) → live Meta ad campaigns, all inside one workflow, with AI assistance at every step.

### 1.2 Primary user
A solo or small-team e-commerce operator in MENA running fast-paced product testing (typically dropshipping or DTC) who today juggles ChatGPT, Canva, video generators, and Facebook Ads Manager in separate tabs.

### 1.3 Core value proposition
Replace 5–8 tools with one. Reduce time-from-product-idea to "first ad live" from days to hours.

### 1.4 Out of scope for v1
- TikTok Ads, Google Ads, Snapchat Ads (Meta only in v1).
- Shopify / WooCommerce direct integration.
- Team accounts / role-based collaboration (single-user accounts only).
- Mobile native apps (responsive web only).
- Payment/billing for end customers (we collect from *our* users, not their customers).
- Arabic-language UI (clarify post-v1 — spec mentions MENA but never explicitly mandates Arabic UI; Arabic *content generation* for ads IS in scope).

### 1.5 Success metrics for v1
- A new user can create a project, generate a full marketing plan, produce 8 social posts + 4 videos, and connect a Meta ad account within 60 minutes of signup.
- AI generation pipeline success rate ≥ 95% (no failed jobs requiring manual retry).
- Meta data sync lag ≤ 15 minutes.
- p95 page load < 2 seconds.

---

## 2. Technology Stack (locked decisions)

| Layer | Choice | Rationale |
|---|---|---|
| Frontend framework | Next.js 15 (App Router) + React 19 | SSR for SEO on landing page, server actions reduce boilerplate, Vercel deploy is one click |
| Language | TypeScript (strict mode) | Type safety across AI/Meta payloads is non-negotiable |
| Styling | Tailwind CSS v4 + shadcn/ui | Apple/macOS aesthetic achievable, accessible components, dark mode native |
| Font | Cairo (via `next/font/google`) | Per spec section 5.1; excellent Latin + Arabic glyph coverage |
| Database | PostgreSQL via Supabase | RLS enforces "users see only their own projects" without manual auth checks |
| Auth | Supabase Auth (email + Google OAuth) | Tight RLS integration |
| File storage | Supabase Storage (S3-compatible) | Generated media must be persisted within 14 days of kie.ai generation |
| ORM | Drizzle ORM | Type-safe migrations, works well with Claude Code |
| Validation | Zod | Runtime validation of AI outputs and API inputs |
| Background jobs | BullMQ + Upstash Redis | Required for kie.ai async lifecycle; serverless-friendly |
| Worker hosting | Railway or Fly.io (separate service) | Long-running queue worker cannot live on Vercel serverless |
| Web hosting | Vercel | Free tier covers MVP; preview deploys per PR |
| AI provider | kie.ai (per spec requirement 6.1) | Unified API for video (Veo 3), image (4o Image / Flux), text (chat models) |
| Ads provider | Meta Marketing API v22.0+ | Per spec module 4.4 |
| Email | Resend | Transactional only (auth, alerts) |
| Realtime | Supabase Realtime | Live job progress UI |
| Monitoring | Sentry + Vercel Analytics | Error tracking + perf |
| Testing | Vitest + Playwright | Unit + e2e |
| Package manager | pnpm | Faster, stricter |

### 2.1 Why this stack works specifically for Claude Code
- **One repo, one language.** Frontend + API routes + worker scripts are all TypeScript. Claude Code never has to context-switch between Python and JS.
- **File-based routing.** Claude Code can infer URL structure from folder structure in `/app`.
- **Drizzle migrations are pure SQL files.** Easy for Claude Code to read, diff, and reason about.
- **Convention-heavy frameworks.** Less ambiguity = fewer wrong guesses.

---

## 3. System Architecture

### 3.1 High-level component diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                          User Browser                            │
│                  (Next.js App, light/dark mode)                  │
└──────────────────┬──────────────────────────────────────────────┘
                   │ HTTPS
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│              Vercel — Next.js 15 (App Router)                    │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────────┐  │
│  │  React UI (RSC) │  │  API Routes      │  │ Server Actions │  │
│  └─────────────────┘  └────────┬─────────┘  └────────┬───────┘  │
│                                │                      │          │
│  ┌─────────────────────────────┼──────────────────────┼───────┐  │
│  │  Webhook endpoints: /api/webhooks/kie, /webhooks/meta     │  │
│  └─────────────────────────────┼──────────────────────────────┘  │
└────────────────────────────────┼──────────────────────────────────┘
                                 │
       ┌─────────────────────────┼─────────────────────────┐
       │                         │                         │
       ▼                         ▼                         ▼
┌─────────────┐         ┌─────────────────┐       ┌─────────────────┐
│  Supabase   │         │  Upstash Redis  │       │   External APIs │
│  - Postgres │◄────────┤   (BullMQ)      │       │  - kie.ai       │
│  - Auth     │         └────────┬────────┘       │  - Meta Mktg    │
│  - Storage  │                  │                │  - Resend       │
│  - Realtime │                  │                └────────▲────────┘
└──────▲──────┘                  │                         │
       │                         ▼                         │
       │              ┌─────────────────────┐              │
       │              │  Worker (Railway)   ├──────────────┘
       └──────────────┤  - AI job processor │
                      │  - Meta sync (cron) │
                      │  - Alert evaluator  │
                      └─────────────────────┘
```

### 3.2 Request flows

**Flow A — User generates a marketing plan**
1. User clicks "Generate Marketing Plan" → server action `generateMarketingPlan(projectId)`.
2. Action inserts 7 rows into `ai_generation_jobs` (one per SOP step), enqueues the first into BullMQ, returns immediately.
3. UI subscribes to Supabase Realtime on `ai_generation_jobs` filtered by `project_id`.
4. Worker picks up job 1 → calls kie.ai chat model → gets `task_id` → polls/awaits webhook.
5. kie.ai webhook hits `/api/webhooks/kie` → verifies signature → updates row → downloads any media to Supabase Storage → enqueues next dependent job.
6. UI shows live progress, then renders the final document.

**Flow B — Meta data sync**
1. Cron job in worker fires every 15 minutes (per spec section 4.4.1).
2. For each connected `meta_ad_account`, refresh OAuth token if needed.
3. Batch-fetch campaigns → ad sets → ads → insights via Meta Marketing API.
4. Upsert into local Postgres tables.
5. Run alert evaluator over fresh data — write any new `alerts` rows.
6. If a Red-tier alert is created, enqueue an email notification + push a Supabase Realtime event.

**Flow C — User pauses a campaign from the dashboard**
1. User clicks "Pause" → server action.
2. Action calls Meta API write endpoint, updates local row optimistically.
3. On Meta success: keep. On failure: rollback + toast error.

### 3.3 Async-job lifecycle (kie.ai)

This is the most failure-prone part of the system. Every kie.ai call follows this exact pattern — no exceptions.

```
[Server Action]
    │
    ▼
INSERT INTO ai_generation_jobs (status='pending', ...)
    │
    ▼
[BullMQ enqueue with jobId = ai_generation_jobs.id]
    │
    ▼
[Worker dequeues]
    │
    ▼
POST kie.ai /v1/{model}/generate  →  task_id returned
    │
    ▼
UPDATE jobs SET kie_task_id, status='processing'
    │
    ├─────────────────────┬─────────────────────┐
    ▼                     ▼                     ▼
[Webhook arrives]   [60s poll fallback]   [Timeout after 10 min]
    ▼                     ▼                     ▼
Verify signature    Query kie.ai status    UPDATE status='failed'
Download media      If done → same path    Notify user
Save to Storage     If still processing →
UPDATE status='completed'                  re-enqueue with backoff
    │
    ▼
[Trigger downstream job if dependent]
    │
    ▼
[Realtime broadcast → UI updates]
```

**Critical constraints:**
- kie.ai deletes generated media after **14 days**. Always download to Supabase Storage before marking a job completed.
- kie.ai download links expire after **20 minutes**. Download must happen in the webhook handler, synchronously.
- Rate limit: respect 429s with exponential backoff (start at 2s, cap at 60s, max 5 retries).

---

## 4. Data Model

### 4.1 Entity overview

```
users (Supabase Auth)
  └── projects (1:N)
        ├── target_countries (1:N)
        ├── foundational_docs (1:N — 4 docs per project: research, avatar, offer_brief, beliefs)
        ├── marketing_angles (1:N — 5 per project)
        ├── problem_mechanisms (1:N — 5 per project)
        ├── solution_mechanisms (1:N — 5 per project)
        ├── buyer_personas (1:N — 2 per project)
        ├── ivps (1:N — 2 per project)
        ├── usps (1:N — 2 per project)
        ├── pain_points (1:N — 5 per project)
        ├── creative_assets (1:N — social_post, video, landing_page)
        │     └── (foreign key to marketing_angles for traceability)
        ├── meta_ad_accounts (N:M via join)
        └── ai_generation_jobs (1:N)

meta_ad_accounts
  └── meta_campaigns (1:N)
        └── meta_ad_sets (1:N)
              └── meta_ads (1:N)
                    └── meta_insights (1:N — time-series)

alert_rules (scoped to user, may target account/campaign/ad_set/ad)
  └── alerts (1:N — triggered events)
```

### 4.2 Key schema decisions

- **Every table has `user_id`** even when redundant via `project_id`. This makes RLS policies trivial: `auth.uid() = user_id`. Worth the small denormalization.
- **Soft delete via `archived_at`** on projects and ad entities — users can "Archive" per spec section 4.1.1.
- **Strategic assets are individual rows, not JSON blobs.** A "Marketing Angle" is a row with `title`, `description`, `emotional_driver`, `target_pain_point`, etc. — so the Advertising AI Assistant can later say "creative #3 uses angle #5 which targets pain point #2."
- **`creative_assets.source_angle_ids` is an array column** — one creative may draw from multiple angles.
- **`ai_generation_jobs.input_payload` and `output_payload` are JSONB** — flexible across model types.
- **Meta data is mirrored locally, not fetched on every page load** — 15-minute sync as per spec. Local query = instant page load.
- **No hard deletes for audit reasons** — `deleted_at` timestamp column on critical tables.

### 4.3 Indexes that matter from day one

- `projects(user_id, status, updated_at DESC)` — dashboard list query.
- `creative_assets(project_id, kind, created_at DESC)` — creative gallery.
- `meta_insights(ad_id, date DESC)` — campaign reporting.
- `ai_generation_jobs(user_id, status)` — pending jobs list.
- `alerts(user_id, tier, created_at DESC) WHERE resolved_at IS NULL` — alerts feed.

### 4.4 Row-Level Security policy (template)

Every project-scoped table follows this pattern:
```sql
ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_rows" ON {table}
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```
This single pattern, applied uniformly, satisfies spec requirement 6.5.

---

## 5. Module-by-module specification

### 5.1 Dashboard module

**Routes:** `/dashboard`, `/projects`, `/projects/[id]`

**Components needed:**
- `<ExecutiveOverview />` — 3 stats: total projects, avg time-to-test, cumulative ad spend (sum across `meta_insights.spend`).
- `<ProjectStatusFilter />` — segmented control: All / Active / In-Draft / Testing / Scaling / Completed / Archived.
- `<ProjectCard />` — product image, name, status badge, Campaign Health Index (0–100), CPA, ROAS, last activity.
- `<CampaignHealthIndex />` — score formula:
  ```
  score = clamp(0, 100,
    40 * normalize(roas / target_roas) +
    30 * (1 - normalize(cpa / target_cpa)) +
    20 * normalize(ctr / benchmark_ctr) +
    10 * (1 - normalize(frequency / 3.5))
  )
  ```
  Bands: 0–40 Red, 41–70 Yellow, 71–100 Green.
- `<ComparativeAnalysis />` — pick up to 3 projects, render side-by-side bar charts.
- `<KPIWidget />` configurable: CPA, ROAS, Total Spend, CTR, Impressions, Conversions.
- `<AlertsFeed />` — sorted by tier desc then time desc, click to drill into the campaign.
- `<CreateProjectDialog />` — guided form: product name, product description, target countries (multi-select MENA), primary language/dialect, target CPA, target ROAS.

**Behavior:**
- Dashboard data is fetched server-side (RSC) on initial load.
- KPI widgets refresh every 60 seconds via SWR.
- Alert feed updates in real-time via Supabase Realtime.

### 5.2 Marketing module

**Routes:** `/projects/[id]/marketing`

**The SOP pipeline (7 sequential AI jobs):**

| # | Step | Input | Output (Zod schema) | Model | Approx tokens |
|---|---|---|---|---|---|
| 1 | Foundational Research | product + countries + language | `{ sections: { market_overview, audience_demographics, cultural_context, competitor_landscape, fears, dreams, beliefs }, length_pages: number }` — min 6 pages | Chat (high reasoning) | 8–12k |
| 2 | Avatar | output of #1 | `{ name, age_range, gender, occupation, income, psychographics: {...}, fears: [], desires: [], daily_routine, media_consumption }` | Chat | 4–6k |
| 3 | Offer Brief | outputs of #1, #2 | `{ big_idea, unique_mechanism_problem (UMP), unique_mechanism_solution (UMS) }` | Chat | 2–3k |
| 4 | Necessary Beliefs | outputs of #1-3 | `{ beliefs: string[] }` — max 6, each starts "I believe that..." | Chat | 1–2k |
| 5 | Strategic Assets | all prior | `{ marketing_angles: [5x {title, emotional_driver, target_pain_point, hook, big_promise}], problem_mechanisms: [5x {...}], solution_mechanisms: [5x {...}] }` | Chat | 6–8k |
| 6 | Customer Profiling | all prior | `{ buyer_personas: [2x {name, psychological_profile, buying_behavior, messaging_guidelines, objections}], ivps: [2x {value_statement, target_segment, proof_points}] }` | Chat | 5–7k |
| 7 | Value & Pain | all prior | `{ usps: [2x {statement, differentiator, proof}], pain_points: [5x {pain, severity_1_to_10, current_solution, our_solution}] }` | Chat | 3–4k |

**Prompt engineering rules:**
- Every prompt template lives in `/prompts/marketing/{step}.md` and is version-controlled.
- Every prompt includes:
  - Target countries with cultural notes (e.g., "Saudi Arabia: conservative messaging, family-centric; UAE: cosmopolitan, status-conscious; Morocco: francophone influence, value-conscious").
  - Primary language/dialect for tonal hints (but research output stays in English for now).
  - Hard JSON-schema requirement with example.
- Validate every output with Zod. On parse failure → auto-retry up to 2x with a "fix the JSON" follow-up prompt. After 3 failures → mark job failed and notify user.

**UI:**
- 7-step wizard layout, vertical stepper on the left, generated content on the right.
- Each completed step is editable inline (textarea for prose, structured forms for arrays).
- "Regenerate" button per step preserves edits to previous steps.
- "Approve & continue" gates the next step (so users review before spending more credits).

### 5.3 Creative module

**Routes:** `/projects/[id]/creative`

**Pre-requisites:** Marketing module must be complete (or at least Strategic Assets step). Block entry otherwise with a friendly message.

**Flow:**
1. User selects 1–5 Marketing Angles from a checklist (loaded from `marketing_angles` table).
2. User chooses content type to generate: Social Posts (batch of 8) / Video Creatives (batch of 4) / Landing Page (1).
3. For video: user picks concept (educational / storytelling / UGC / direct-response).
4. System enqueues the appropriate batch of AI jobs.

**Social posts (8x):**
- Job 1: Text model generates 8 post-copy variants (caption + CTA) distributed across selected angles.
- Jobs 2–9: For each post, image generation via kie.ai 4o Image / Flux. Aspect ratio 1:1 (feed) for 6, 9:16 (stories) for 2.
- Output stored as `creative_assets.kind = 'social_post'` with `caption`, `image_url`, `source_angle_ids`, `aspect_ratio`.

**Video creatives (4x):**
- Job 1: Chat model generates 4 video scripts (one per angle if 4 angles selected, else distributed). Each script includes scene-by-scene prompts, voiceover text in **selected country dialect**, total duration target 18–24s.
- Jobs 2–5: Veo 3 Fast video generation per script. **Hard validate duration in [18, 24] seconds** on return — if outside, re-prompt with stricter constraints; after 2 fails, accept whatever is closest and flag for user review.
- Output: `creative_assets.kind = 'video'` with `video_url`, `script`, `voiceover_text`, `duration_seconds`, `concept_type`.

**Landing page:**
- Job 1: Chat model generates structured page JSON: `{ hero: {headline, subheadline, cta}, problem_section, solution_section, social_proof, faq, final_cta }` — based on the *selected* marketing angle (singular for landing page).
- Renderer: a Tailwind landing-page template component reads the JSON and renders.
- Editable: every field is inline-editable, with a "Preview" tab.
- Export: user can publish to a subdomain (`<project-slug>.<our-domain>.com`) — v1.1 feature, not v1.

**Creative Asset Repository (cross-module gallery):**
- Lives on the Dashboard module visually but reads `creative_assets`.
- Filters: by project, by angle, by type (image/video/landing), by date range, by performance (high/low ROAS once Meta data is linked).
- Click an asset → modal with full preview + lifetime performance from `meta_insights` (if used in an ad).

### 5.4 Advertising module

**Routes:** `/projects/[id]/ads`, `/ads` (global view)

**OAuth setup:**
- "Connect Meta Account" button → redirects to Meta OAuth → callback at `/api/auth/meta/callback`.
- Required scopes: `ads_management`, `ads_read`, `business_management`, `read_insights`.
- Store encrypted access token + refresh token in `meta_ad_accounts`.

**Note on Meta App Review:** Advanced access to these scopes requires Facebook's App Review (2–6 weeks). Start the submission on day 1 of development. Until approved, use Meta's sandbox.

**Sync worker:**
- Runs every 15 minutes (per spec 4.4.1).
- For each ad account: list campaigns → ad sets → ads → insights for last 30 days.
- Use Meta's batch endpoint to minimize round trips.
- Handle rate limits (Meta uses a "tier" system — exponential backoff on 17/4 error codes).
- Last sync timestamp stored on `meta_ad_accounts.last_synced_at`.

**Campaign list UI:**
- Table view with columns: Campaign Name | Status | Spend | Impressions | CPM | CPC | CTR | Purchases | ROAS | CPA | Health
- Color-coded row backgrounds based on alert tier.
- Inline actions: Pause / Resume / Edit Budget.
- Drill-down to ad-set, then to individual ad with creative preview from `creative_assets`.

**Alert Rules engine:**
- User creates rules at `/settings/alerts`: `{ scope: account|campaign|ad_set|ad, metric: CPA|ROAS|CTR|frequency|spend|breakeven, operator: >|<|=, threshold: number, tier: green|yellow|red }`.
- Per spec: support BreakEven Point as a metric (computed as `revenue - spend` or as `ROAS = 1.0` baseline).
- Evaluator runs after every sync. Inserts `alerts` rows for new violations. Marks existing alerts as `resolved_at = now()` when metric returns to healthy range.
- Notification: in-app toast + Supabase Realtime push + email via Resend for Red tier only.

**AI Assistant (campaign-level chat):**
- Side panel on any campaign page.
- Context passed to the model:
  - Last 30 days of insights for this campaign.
  - Linked creative assets and their source angles.
  - Buyer personas for the project.
  - Active alerts.
- Output: structured recommendations rendered as cards with action buttons.
  ```
  {
    "recommendations": [
      {
        "type": "budget_increase" | "budget_decrease" | "pause_creative" | "swap_creative" | "test_audience",
        "title": "Increase budget on Ad Set X by 20%",
        "rationale": "ROAS is 3.4 (target 2.5), spend velocity is healthy, audience saturation < 30%",
        "confidence": 0.85,
        "action_payload": { ... }  // pre-filled action for one-click execution
      }
    ]
  }
  ```
- Creative fatigue detection: rising frequency (>3.5) OR rising CPM (>20% over 7-day baseline) → "swap creative" recommendation referencing alternates from `creative_assets`.

---

## 6. Design System

### 6.1 Visual identity

Drawn from spec section 5. The aesthetic is "macOS for productivity tools" — think Linear, Things 3, Notion, Things.app.

**Light mode tokens:**
```css
--bg-base: #FFFFFF;
--bg-elevated: #F9F9F9;
--bg-subtle: #F2F2F2;
--border-default: #EAEAEA;
--border-strong: #D6D6D6;
--text-primary: #1A1A1A;
--text-secondary: #5F5F5F;
--text-tertiary: #909090;
--accent-primary: #5AC8D6;   /* soft teal */
--accent-secondary: #6FB1E8; /* sky blue */
--success: #4CB782;
--warning: #E8B547;
--danger: #E57676;
```

**Dark mode tokens:**
```css
--bg-base: #1A1A1C;
--bg-elevated: #232326;
--bg-subtle: #2C2C30;
--border-default: #3A3A3E;
--border-strong: #4A4A4F;
--text-primary: #F5F5F7;
--text-secondary: #ABABB0;
--text-tertiary: #6E6E73;
--accent-primary: #5AC8D6;   /* same hue family */
--accent-secondary: #6FB1E8;
```

**Component principles:**
- Rounded corners: `--radius-md: 10px`, `--radius-lg: 16px` (Apple-like, never sharp).
- Frosted glass for modals, dropdowns, command palettes: `backdrop-filter: blur(20px) saturate(180%); background: rgba(255,255,255,0.72)`.
- Shadows: layered, never heavy — `0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06)`.
- Type scale: 12 / 14 / 16 / 20 / 24 / 32 / 48 (px). Body 14, headings step up.
- Cairo for everything. `font-feature-settings: "ss01", "cv11";` for refined numerals.

### 6.2 Layout primitives
- App shell: 240px sidebar (collapsible to 64px) + main content area.
- Max content width: 1440px, centered.
- Generous whitespace — 24px section padding minimum, 16px between cards.

### 6.3 Accessibility
- WCAG AA contrast everywhere (the muted palette must still hit 4.5:1 for body text).
- Keyboard nav for every interactive element (Tab order intentional, visible focus rings).
- Reduced-motion respected for animations.

---

## 7. Security & Compliance

- **Auth:** Supabase Auth handles JWT, password hashing (bcrypt), email verification.
- **RLS everywhere:** Every project-scoped table has `auth.uid() = user_id` policies. Tested via integration tests that explicitly try cross-user reads.
- **API keys / tokens at rest:** Meta tokens encrypted with `pgsodium` (Supabase native) using a master key in env. Kie.ai API key stays server-side only — never sent to the browser.
- **Webhooks:** Both kie.ai and Meta webhooks verify signatures before processing. Replay attacks prevented with timestamp checks.
- **CSP headers** in `next.config.ts`: strict-dynamic, no inline scripts in production.
- **Rate limiting:** per-user limits on AI generation (e.g., 100 jobs/hour) via Upstash Ratelimit.
- **Data export & deletion:** GDPR-style endpoints to export all user data as JSON and delete account (even for non-EU compliance hygiene).
- **PII:** No payment data stored — use Stripe Checkout when billing is added.
- **Audit log:** `audit_events` table tracking sensitive actions (Meta account connect/disconnect, project delete, password change).

---

## 8. Phased Delivery Plan

**Total timeline: 11 weeks solo-dev with Claude Code, full-time. Compressible to 6–7 weeks with 2 devs.**

| Phase | Weeks | Deliverable | Definition of Done |
|---|---|---|---|
| 0 — Foundation | 1 | Deployed shell with auth, theme, RLS verified | New user signs up, logs in, toggles dark mode. Cross-user read test passes. |
| 1 — Project lifecycle | 2 | Full schema + project CRUD + dashboard skeleton | Can create/list/filter/archive projects. Schema covers all future features (no migration debt). |
| 2 — kie.ai integration | 3 | Job queue + webhook + 3 model helpers | Test image generation completes end-to-end, file persisted in Storage, fallback poller recovers a forced webhook failure. |
| 3 — Marketing module | 4–5 | 7-step SOP pipeline, all foundational + strategic assets | Sample product → all 7 deliverables generated, validated, editable. Failure rate < 5% on 20-product test set. |
| 4 — Creative module | 6–7 | 8 social posts + 4 videos + 1 landing page generation | Full creative suite for a project with 2+ marketing angles. Videos within 18–24s. Voiceover in correct dialect. |
| 5 — Meta integration | 8–9 | OAuth + 15-min sync + campaign UI + pause/budget actions | Real ad account connected, data appears within 15 min, action propagates to Meta. (Requires Meta App Review submitted on day 1.) |
| 6 — Alerts & AI Assistant | 10 | Alert rules engine + Campaign Health Index + AI recommendations panel | Custom rule violation triggers email + in-app notification. AI gives actionable, asset-aware recommendation. |
| 7 — Polish & launch | 11 | A11y audit, perf, error handling, onboarding tour | Lighthouse > 90 desktop and mobile. Sentry capturing. Onboarding tour for first-time users. |

**Parallelizable work (do in background from day 1):**
- Meta App Review submission.
- Prompt engineering iteration on a fixed eval set of 5–10 sample products.
- Cairo font loading + base design tokens.

---

## 9. Working with Claude Code

### 9.1 Repository conventions (commit these as `CLAUDE.md`)
- **No `any` in TypeScript.** Ever. Use `unknown` and narrow.
- **All kie.ai calls go through `lib/kie/client.ts`.** Never direct `fetch` to kie.ai.
- **All Meta API calls go through `lib/meta/client.ts`.**
- **Server actions live next to the page that calls them** (`actions.ts` colocated).
- **Drizzle migrations are append-only.** Never edit an existing migration file.
- **One feature per PR.** Touch only files relevant to the feature.
- **Tests written with the implementation, not after.** Vitest for unit, Playwright for e2e.
- **All AI prompt templates live in `/prompts/{module}/{step}.md`.** Version-controlled, never inlined.
- **All Zod schemas live in `/schemas/`.** Reused between server and client.

### 9.2 Recommended `/docs` files to maintain alongside this blueprint
- `BLUEPRINT.md` — this document.
- `CLAUDE.md` — conventions (short, scannable).
- `docs/schema.md` — current schema reference (auto-generate from Drizzle).
- `docs/prompts.md` — index of all prompt templates with version history.
- `docs/api-reference.md` — internal API endpoints.
- `docs/kie-integration.md` — kie.ai integration deep-dive.
- `docs/meta-integration.md` — Meta API deep-dive.
- `docs/runbook.md` — incident response (worker down, webhook failures, etc.).

### 9.3 How to drive Claude Code through this project
1. Start every session by pointing Claude Code to `BLUEPRINT.md` and `CLAUDE.md`.
2. Work phase by phase. Don't let it skip ahead.
3. Use the phase's "Definition of Done" from section 8 as the PR acceptance criteria.
4. After each phase, update `BLUEPRINT.md` if reality diverged from plan. The doc must stay truthful.
5. For complex sub-tasks (e.g. "implement the kie.ai webhook handler"), ask Claude Code to read the relevant external docs first (`docs.kie.ai`, Meta API reference) so its types match reality.
6. Always run `pnpm test && pnpm build` before merging a Claude Code PR. Tell Claude Code: "fix until both pass green."

### 9.4 Known risk areas where Claude Code needs extra supervision
- **Async job orchestration** — easy to write something that almost works. Insist on the fallback poller and webhook signature verification.
- **RLS policies** — Claude Code may forget to add a policy on a new table. Always verify with a cross-user test.
- **Prompt engineering** — Claude Code can write a prompt that works for one product and fails on another. Always validate against an eval set of at least 5 diverse products.
- **Meta API rate limits** — Claude Code may not handle the tier system. Review the sync worker carefully.
- **Cost ceilings** — Add per-user limits on AI generation early. A bug in a retry loop can burn hundreds of dollars in kie.ai credits in minutes.

---

## 10. Open Questions (resolve before Phase 3)

These were not specified in the original PDF and need product-owner decisions:

1. **Arabic UI?** Spec mentions MENA but only specifies Arabic *content generation*. Should the app interface itself support RTL Arabic? (Affects component library choice, layout direction, font weight needs.)
2. **Pricing model?** Subscription tier(s)? Per-project? Pay-per-generation? This shapes the user-limits logic and onboarding.
3. **Foundational Doc 1 length enforcement.** Spec says "min 6 pages." Pages of what — A4 12pt? ~3000 words? Define and validate.
4. **Voiceover languages supported.** Confirm dialect list: Egyptian Arabic, Levantine, Gulf, Maghrebi, MSA, French (for Morocco/Tunisia/Algeria), English? Each requires prompt-side tuning.
5. **Landing page publishing.** Is the user expected to *publish* the generated landing page (with our subdomain) or just *export* (HTML/Webflow/Shopify)? Big architectural fork.
6. **Multi-product per project, or one product per project?** Spec implies one. Confirm.
7. **Team accounts in v1.1 or v2?** Affects whether we plan multi-tenancy now or refactor later.
8. **AI Assistant memory.** Does the assistant remember past conversations, or is each session stateless? Memory needs a vector store.

---

## 11. Appendix — Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Meta App Review rejected/delayed | High | Blocks Phase 5 launch | Submit day 1, use sandbox in interim, prepare detailed use-case video |
| kie.ai outage or model deprecation | Medium | All AI features down | Wrap client to allow swapping providers (OpenAI, Replicate) with same interface |
| AI output quality inconsistent | High | Bad user experience | Prompt eval set, structured schema validation, regeneration UI, manual edit fallback |
| Veo 3 doesn't reliably hit 18–24s | Medium | Video module unreliable | Validate duration, re-prompt up to 2x, accept with warning if all retries fail |
| Webhook missed → orphaned jobs | Medium | UX confusion | Fallback poller + 10-min timeout + retry queue |
| Cost runaway on retry loop | Medium | Real money lost | Per-user rate limits, hard ceiling alerts, budget kill switch |
| Kie.ai 14-day retention forgotten | Low | Data loss | Download in webhook handler, mandatory test |
| RLS misconfigured | Low | Data leak (catastrophic) | Cross-user integration tests in CI on every PR |
| Cairo font fails on some browsers | Low | Layout shift | `next/font` with `display: swap` and system-ui fallback |

---

*End of blueprint. Last updated: [insert date]. Version 1.0.*
