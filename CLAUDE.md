# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.


## Commands

```bash
pnpm dev          # start dev server (http://localhost:3000)
pnpm build        # production build + type check
pnpm lint         # ESLint

# Installing new dependencies — always use --ignore-scripts to bypass pnpm v11 build-approval prompts
pnpm add <pkg> --ignore-scripts
pnpm install --ignore-scripts
```

> **pnpm quirk:** pnpm v11 rejects builds from `@firebase/util`, `protobufjs`, `sharp`, `unrs-resolver` unless approved interactively. Always pass `--ignore-scripts` when installing. The `pnpm.json` at root lists the approved set but pnpm v11 does not reliably read it.
>
> **pnpm + CI:** When running pnpm in a non-TTY shell (terminal tools, background tasks), set `CI=true` to prevent the interactive modules-purge prompt.

## Architecture

### Route groups

```
app/
  (auth)/          → unauthenticated pages (no profile widget)
    login/         → /login  — AuthForm component
  (app)/           → authenticated shell (AuthProvider + main area + ProfileWidget)
    layout.tsx     → wraps every app page with <AuthProvider> + <ProfileWidget>
    dashboard/     → /dashboard
    projects/      → /projects  (project list)
    projects/[id]/ → /projects/:id  (project detail — Brief → Plan → Creatives → Library stepper; `ProjectSwitcher` in the header jumps between projects; the page remounts per project id)
    creative/      → /creative  — standalone Creative Studio with project-switcher dropdown
    settings/      → /settings  (profile, theme, notifications, danger zone)
  api/
    marketing-plan/           → POST — streams AI marketing plan text (KIE AI, SSE)
    generate-creative/        → POST — charges credits, creates KIE AI image task (`nano-banana-2`); returns taskId
    generate-creative/status/ → GET ?taskId=… — owner-only (users/{uid}/jobs); refunds once on failure
    generate-video/           → POST — charges credits, creates KIE AI video task (`gemini-omni-video`); returns taskId
    generate-video/status/    → GET ?taskId=… — owner-only (users/{uid}/jobs); refunds once on failure
    generate-landing-page/    → POST — charges credits, streams HTML landing page via KIE AI Claude endpoint; refunds if nothing was produced
    init-credits/             → POST — idempotently creates users/{uid}.credits = 0 (Admin SDK)
    upload-signature/         → POST — auth'd Cloudinary signed-upload params (images ≤10 MB, videos ≤100 MB)
    download/                 → GET ?url=… — AUTH REQUIRED. Proxies an allow-listed https file (redirects blocked, 50 MB cap). Client uses `downloadViaProxy()` from lib/auth-fetch.ts (a plain <a href> cannot send the token)
  layout.tsx       → root: Cairo font + ThemeProvider
  page.tsx         → redirect → /login
```

Route group folders `(auth)` and `(app)` do **not** affect URLs.

### Auth & user state

- `lib/contexts/auth-context.tsx` — `AuthProvider` + `useAuth()` hook. Wraps the `(app)` layout; listens via `onAuthStateChanged`. Provides `{ user: User | null, loading: boolean }`.
- Any `(app)` page that needs the current user calls `useAuth()` — never read Firebase Auth directly in components.

### Firebase

- `lib/firebase/config.ts` — lazy singleton `getFirebaseApp()`. Credentials are hardcoded client-side public keys — do **not** move to env vars.
- `lib/firebase/auth.ts` — `"use client"`. Auth helpers: `signIn`, `signUp`, `signInWithGoogle`, `resetPassword`, `signOut`, `mapFirebaseError`, `getFirebaseAuth` (exported lazy getter).
- `lib/firebase/firestore.ts` — `"use client"`. Lazy singleton `getFirebaseFirestore()`.
- `lib/firebase/projects.ts` — `"use client"`. `createProject`, `deleteProject`, `updateProject`, `subscribeToProject` (single doc), `subscribeToProjects` (collection). New domain services follow this pattern.
- `lib/firebase/ai-creatives.ts` — `"use client"`. Manages AI-generated images: `createAiCreative`, `updateAiCreativeImageUrl`, `failAiCreative`, `deleteAiCreative`, `subscribeToAiCreatives`.
- `lib/firebase/ai-videos.ts` — `"use client"`. Manages AI-generated videos: `createAiVideo`, `updateAiVideoUrl`, `failAiVideo`, `deleteAiVideo`, `subscribeToAiVideos`.
- `lib/firebase/rendered-videos.ts` — `"use client"`. Stores final rendered video exports: `createRenderedVideo`, `subscribeToRenderedVideos`, `deleteRenderedVideo`.
- `lib/firebase/ai-landing-pages.ts` — `"use client"`. Manages AI-generated landing pages: `createAiLandingPage`, `updateAiLandingPageHtml`, `failAiLandingPage`, `deleteAiLandingPage`, `subscribeToAiLandingPages`. Types: `AiLandingPage`, `Copyframe` (`"AIDA" | "PAS" | "FAP"`), `LandingPageCriteria`.
- `lib/firebase/credits.ts` — `"use client"`. **Read-only** credit access: `subscribeToCredits`. Credits live on the `users/{uid}` document (`credits` field), which clients cannot write (see firestore.rules).
- `lib/credit-costs.ts` — no Firebase, no `"use client"`: `CREDIT_COSTS` (MARKETING_PLAN: 20, PHOTO: 35, LANDING_PAGE: 35) and `videoCreditCost(duration)`. Single source of truth, imported by both UI (display) and API routes (charging).
- `lib/firebase/admin.ts` — **server-side only**. Firebase Admin SDK singleton (`getAdminAuth()`, `getAdminFirestore()`). Requires `FIREBASE_SERVICE_ACCOUNT_JSON` env var. Import only from API routes or Server Components.
- `lib/firebase/admin-credits.ts` — **server-side only**. `adminDeductCredits`, `adminRefundCredits`, `adminInitUserCredits` (atomic transactions).
- `lib/jobs.ts` — **server-side only**. Async KIE jobs at `users/{uid}/jobs/{taskId}` (`{uid, cost, kind, status, refunded}`): `createJob`, `getOwnedJob`, `markJobDone`, `refundJobOnce` (refunds exactly once, in one transaction). `lib/job-status.ts` is the shared status-route handler.
- `lib/rate-limit.ts` — **server-side only**. `enforceRateLimit(uid, bucket, limit, windowMs)` using top-level `rateLimits/{uid}_{bucket}` (no client access). Generation routes: 10/min.
- `lib/validation.ts` — **server-side only**. zod schemas for every API route + `parseBody()` (400 on failure) + `isOwnCloudinaryUrl()`. New routes must validate input here.
- `lib/notify.ts` — **server-only**. `notify(uid, {type,title,body,href?,id?})` writes `users/{uid}/notifications/{id}` (an `id` makes it idempotent), plus `notifyLowCredits`. Called by the plan route (ready / failed), the job status routes (creatives ready / failed + refund), the landing-page route (refund) and `adminDeductCredits` (credits low, once a day when a charge crosses `LOW_CREDITS_THRESHOLD`). Never throws. Types live in `lib/notification-types.ts`; the client reads them via `lib/firebase/notifications.ts` and `lib/contexts/notifications-context.tsx` (`useNotifications()`), shown by `components/notifications/notification-bell.tsx` and `/notifications`. Rules: owner can read, flip `read`, delete; nobody can create from the client — **deploy `firestore.rules` after changing it**.
- `POST /api/import-product` (New Project → "Start from a product link") — **free**, 10 per 10 min per user. `{url}` → `{name, description, imageUrl, host}`; the browser never gets page HTML. Built on **server-only** `lib/safe-fetch.ts` (https only, DNS answer validated and pinned via node:https `lookup`, private/loopback/link-local/metadata ranges blocked, redirects re-checked per hop, 5 s deadline, 2 MB page / 8 MB image caps applied after decompression), `lib/product-hosts.ts` (page-host allowlist, whole-label matching — add shops there), `lib/product-extract.ts` (JSON-LD → Open Graph → `<title>`, plain-text sanitising) and `lib/cloudinary-server.ts` (re-uploads the photo to `users/{uid}/imports/…`; Cloudinary never fetches the remote URL). Any project name/description (typed or imported) is untrusted in AI prompts: wrap it with `untrusted()` from `lib/prompt-safety.ts` and include `UNTRUSTED_RULE` (done in marketing-plan, regenerate-angle, generate-landing-page).
- `lib/cloudinary.ts` — `"use client"`. Compresses images and uploads directly to Cloudinary with XHR progress using **signed** params fetched from `/api/upload-signature` (no unsigned preset). Public ids are built server-side under `users/{uid}/projects/{projectId}/…`.

**Firestore data model:**
```
users/{uid}                     ← credits: number (top-level field)
  /projects/{projectId}
    /ai-creatives/{creativeId}    ← KIE AI generated images (status: pending | done | failed)
    /ai-videos/{videoId}          ← KIE AI generated videos (status: pending | done | failed)
    /rendered-videos/{videoId}    ← final exported video renders
    /ai-landing-pages/{pageId}    ← AI-generated landing pages (status: pending | done | failed; html: string)
  /jobs/{taskId}                  ← server-written KIE job records (client read-only)
  /notifications/{id}             ← server-written in-app notifications (client: read, mark read, delete)
rateLimits/{uid}_{bucket}         ← server-only rate-limit counters (no client access)
```
Firestore rules: `users/{uid}` and `users/{uid}/jobs/*` are client **read-only**; `users/{uid}/projects/**` is owner read/write; everything else is denied.
All Firebase modules use a lazy getter pattern — never call `getFirestore()` / `getAuth()` at module top-level (SSR safety).

### Design system

**Always follow the POLARIS SM v2 design theme when making any UI changes.** All design tokens live as CSS custom properties in `app/globals.css` — never use hardcoded colors or Tailwind color utilities. Use `var(--token-name)` inline or in CSS classes. Dark mode is applied via the `.dark` class (next-themes, `attribute="class"`).

**Core tokens (light/dark via `:root` / `.dark`):**

| Token | Purpose |
|---|---|
| `--bg-app` | Page background (`#ECECF0` / `#07070A`) |
| `--bg-base` | Surface base (`#FFF` / `#1A1A1C`) |
| `--bg-elevated` | Elevated surface (`#F9F9F9` / `#232326`) |
| `--bg-subtle` | Subtle fill (`#F2F2F2` / `#2C2C30`) |
| `--border-default` | Default border |
| `--border-strong` | Strong border |
| `--text-primary` | Primary text |
| `--text-secondary` | Secondary text |
| `--text-tertiary` | Muted/placeholder text |
| `--accent-primary` | Teal `#5AC8D6` |
| `--accent-secondary` | Blue `#6FB1E8` |
| `--accent-grad` | `linear-gradient(135deg, #5AC8D6 0%, #6FB1E8 100%)` |
| `--success` / `--warning` / `--danger` | Semantic colors |
| `--glass` | Frosted glass fill (translucent) |
| `--glass-strong` | Stronger frosted glass fill |
| `--glass-border` | Glass border (rgba white) |
| `--card-shadow` | Layered box-shadow for cards |
| `--hairline` | Ultra-thin border/separator |
| `--chip` | Chip/tag background |
| `--chip-hover` | Chip hover state |
| `--blob-a/b/c` | Ambient gradient blob colors |
| `--ease` | `cubic-bezier(.22,.61,.36,1)` — standard easing |

**Radius tokens:** `--r-input: 10px` (inputs/buttons), `--r-card: 16px` (cards/dialogs), `--r-hero: 24px` (hero elements).

**Reusable CSS class families** defined in `globals.css` — always prefer these over writing new inline styles:

- Layout: `.app-shell`, `.app-main`, `.app-topbar`, `.app-content`, `.ambient` (background blobs)
- Cards: `.card`, `.glass-card`, `.kpi-card`, `.project-card`
- Buttons: `.btn-primary`, `.btn-secondary`, `.icon-btn`
- Inputs: `.auth-input`, `.search-pill`
- Navigation: there is no sidebar or top bar. `components/profile-widget.tsx` (`.profile-widget`) is a rounded glass widget fixed at the bottom left with the avatar, credits and a Top up button; clicking it opens `/settings`. Dashboard ↔ Projects use plain links, and the notification bell sits in each page header.
- Tabs/filters: `.auth-tabs / .auth-tab`, `.filter-tabs / .filter-tab`, `.filter-pills / .filter-pill`
- Badges/indicators: `.status-badge.<status>`, `.kpi-trend-pill`
- Misc: `.dialog-overlay / .dialog-panel`, `.section-head`, `.user-card / .user-avatar`, `.empty-state`, `.fade-up`, `.rise`, `.spinner`

**Liquid Glass foundation** (spec: `docs/redesign/DESIGN.md`): new classes `.glass` (rim via `::before`), `.glass-inner`, `.btn-liquid`, `.segmented`, `.chip`, `.input-well`, `.lift`, `.shimmer`, `.label-caps`, `.tabular`, `.font-arabic`; `.light` / `.dark` wrappers force a theme for a subtree. Small React wrappers live in `components/ui/` (`GlassCard`, `LiquidButton`, `SegmentedControl`, `Chip`, `StatusBadge`, `EmptyState`).

### Styling rules

- Font: Cairo (loaded via `next/font/google` in root layout, variable `--font-cairo`). Applied globally via `body { font-family: "Cairo", ... }` in globals.css.
- Tailwind v4 is present but used **minimally** (only utility classes like `min-h-screen`, `flex`, `flex-col`). Prefer CSS custom-property-based classes from globals.css.
- Radius convention: `--r-input` (10px) for inputs/buttons/chips, `--r-card` (16px) for cards/dialogs, `--r-hero` (24px) for hero elements.
- Glassmorphism: use `.glass-card` or `background: var(--glass)` + `backdrop-filter: blur(24px) saturate(160%)` for frosted surfaces. Never use solid opaque backgrounds where the design calls for glass.
- Shadows: always use `var(--card-shadow)` for card elevation — never hardcode box-shadows.
- Animations: use `.fade-up` or `.rise` for entrance animations; respect `prefers-reduced-motion` (already handled globally in globals.css).

### Marketing plan visuals

Each of the 6 plan sections has a paired visual component in `components/marketing/` (`market-analysis-visual.tsx`, `channels-visual.tsx`, `content-visual.tsx`, `phases-visual.tsx`, `kpi-visual.tsx`, `action-visual.tsx`). These receive the typed section data from `planVisualData` and an `onRegenerate` callback; they render structured cards/charts. On the project's Plan step (`components/projects/plan-step.tsx`) each section is first shown as a **headline card** (one takeaway + up to two key facts, derived in `headline()`); the full visual opens in place via "See details". The whole plan block is **hidden by default** behind a "Show plan" toggle; the marketing angles (each with its own colour via `data-hue`) are the first thing on the Plan step. Keep the default view to the big picture.

### Credits system

`components/credits/InsufficientCreditsModal.tsx` — modal shown when a user has fewer credits than the cost of an action. Receives `{ open, onClose, required, balance }`; displays a pricing table and credit pack info (1,000 credits / 50 MAD, contact admin to top up).

`components/credits/CreditTooltip.tsx` — hover tooltip wrapper showing credit cost (`⚡ N credits`) above the wrapped element.

**Credits are server-only.** The browser can never change a balance. Every AI route (`marketing-plan`, `generate-creative`, `generate-video`, `generate-landing-page`) does: auth → rate limit → zod validation → `adminDeductCredits` (402 `{error:"insufficient_credits", required, balance}` if short) → upstream call → `adminRefundCredits` on any failure. Video price is computed server-side from the validated `duration`. For async image/video jobs the status route refunds exactly once (`refundJobOnce`) when KIE reports `fail` or the job has been pending > 10 min. Client code only displays costs (from `lib/credit-costs.ts`), opens `InsufficientCreditsModal` on a 402, and never deducts or refunds. `initUserCredits` is replaced by `POST /api/init-credits`.

Credit costs (`CREDIT_COSTS` from `lib/credit-costs.ts`): Marketing Plan = 20, Photo = 35, Landing Page = 35; videos: 240 (≤6s), 260 (8s), 300 (10s+).

### Creative Studio sub-tabs

All three studios share the Liquid Glass look: `.studio-*` / `.gen-*` / `.photo-slot` / `.lp-*` classes in `globals.css`, the shared `SegmentedControl` for tabs and options, `LiquidButton` for Generate, and `components/projects/studio-parts.tsx` (`ChipGroup`, `CriteriaPicker`, `PromptEditor`). Long option text wraps to two lines instead of being cut off. The video editor's container (`.editor-shell`) deliberately has no `backdrop-filter`: the hidden playback `<video>` elements live inside it.

`components/projects/creative-studio.tsx` — container rendered in both `/projects/:id` (Creative tab) and `/creative` (standalone page). Renders three sub-tabs:

- **Images** — inline image generation UI. POST → `taskId` → poll `/api/generate-creative/status`. Results land in `ai-creatives`.
- **Videos** — delegates to `VideoStudio`. POST → `taskId` → poll `/api/generate-video/status`. Results land in `ai-videos`.
- **Landing Page** — delegates to `LandingPageStudio`.

`components/projects/video-studio.tsx` — AI video generation panel. Follows the same async polling pattern as image generation.

`components/projects/video-editor.tsx` — timeline-style editor for assembling video clips. Clips live in editor state only (not saved); rendered exports go to `rendered-videos`.

`components/projects/landing-page-studio.tsx` — generates full HTML landing pages. User picks a copyframe (AIDA / PAS / FAP) and optional criteria (segment, pillar, hook) derived from `planVisualData`. POST → `/api/generate-landing-page` streams raw HTML back. The pending doc is created in `ai-landing-pages` first; `updateAiLandingPageHtml` is called once streaming completes. The KIE AI Claude endpoint (`/claude/v1/messages`) uses `claude-opus-4-7` with `thinkingFlag: true` and `max_tokens: 32000`.

### External services & environment variables

| Variable | Side | Purpose |
|---|---|---|
| `KIE_AI_API_KEY` | server | KIE AI — image generation (`nano-banana-2` model) + marketing plan text (`gpt-5-5` model via SSE stream) |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | server | Firebase Admin SDK credential (stringified JSON); required by `lib/firebase/admin.ts` |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | client | Cloudinary upload target |
| `CLOUDINARY_API_KEY` | server | Cloudinary signed uploads (`/api/upload-signature`) |
| `CLOUDINARY_API_SECRET` | server | Cloudinary signing secret — never expose to the client |

Store these in `.env.local` (not committed).

**Streaming patterns:**
- Marketing-plan: SSE from KIE AI (`/v1/chat/completions` with `stream: true`), re-streamed as raw delta text.
- Landing page: SSE from KIE AI Claude endpoint (`/claude/v1/messages`, Anthropic SSE format) — the route parses `content_block_delta` / `text_delta` events and streams raw HTML text to the browser.
- Image/video generation: async — POST returns a `taskId`; client polls `/api/generate-creative/status?taskId=…` (or `/api/generate-video/status`) until `status === "success"`.

### Mock data & shared types

`lib/mock-data.ts` is the single source of truth for the shared app interfaces. Key types:

- `Project` — includes optional `marketingPlan` (raw markdown), `planVisualData` (`PlanVisualData`), and `productImageUrl`.
- `PlanVisualData` — structured JSON parsed from the AI plan, with fields `market?`, `channels?`, `content?`, `phases?`, `kpi?`, `action?`. Each section has a dedicated interface (`MarketAnalysisData`, `ChannelsData`, `ContentData`, `PhasesData`, `KpiData`, `ActionData`) and a dedicated visual component in `components/marketing/`.

All project data comes from live Firestore; there is no mock data in the codebase.

### TypeScript

- Strict mode on. No `any` — use `unknown` and narrow.
- Path alias `@/*` maps to the repo root.

## Key conventions

- **Firebase client calls are client-side only.** Never import a client `lib/firebase/*.ts` file into a Server Component or a file without `"use client"`. **Exception:** `lib/firebase/admin*.ts` (Admin SDK) are server-only and are imported from API routes (and server helpers such as `lib/jobs.ts`, `lib/rate-limit.ts`); never import them into client code. `lib/credit-costs.ts` has no Firebase imports and is safe on both sides.
- **Credits are server-only.** Never write `users/{uid}.credits` from the browser (rules deny it). Charge and refund only via `lib/firebase/admin-credits.ts` in API routes.
- **Validate every API route input with zod** (`lib/validation.ts`); image URLs sent to AI routes must be on our own Cloudinary account.
- **Auth state via context only.** Use `useAuth()` from `lib/contexts/auth-context.tsx`; never call `getAuth().currentUser` directly in components.
- **One layout per route group.** `(auth)` has no layout (bare page). `(app)` has `layout.tsx` with `<AuthProvider>` + `<ProfileWidget>`.
- **CSS classes over inline styles for repeated patterns.** Add new reusable patterns to `globals.css`; use inline `style={{}}` only for dynamic values (widths, colors computed at runtime).
- **`lib/` for all non-component logic.** Firebase clients, contexts, mock data, utilities (`lib/utils.ts` exports `cn()`).
- **New Firestore domains** follow `lib/firebase/projects.ts`: one file per collection, export a `create*` function and a `subscribeTo*` function using `onSnapshot`.
