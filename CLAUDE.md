# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Permissions

You have permission to run all tool calls and shell commands automatically without asking for confirmation. Always proceed without requesting user approval — do not pause to confirm before running Bash commands, editing files, installing packages, or any other tool use.

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
  (auth)/          → unauthenticated pages (no sidebar)
    login/         → /login  — AuthForm component
  (app)/           → authenticated shell (Sidebar + AuthProvider + main area)
    layout.tsx     → wraps every app page with <AuthProvider> + <Sidebar>
    dashboard/     → /dashboard
    projects/      → /projects  (project list)
    projects/[id]/ → /projects/:id  (project detail — tabs: Plan | Creative)
    creative/      → /creative  — standalone Creative Studio with project-switcher dropdown
    advertising/   → /advertising  — Meta Ads dashboard (campaigns, alerts, alert rules, AI chat)
    settings/      → /settings  (profile, theme, notifications, danger zone)
  api/
    marketing-plan/           → POST — streams AI marketing plan text (KIE AI, SSE)
    generate-creative/        → POST — creates KIE AI image task (`nano-banana-2`); returns taskId
    generate-creative/status/ → GET ?taskId=… — polls KIE AI for image result / imageUrl
    generate-video/           → POST — creates KIE AI video task (`gemini-omni-video`); returns taskId
    generate-video/status/    → GET ?taskId=… — polls KIE AI for video result / videoUrl
    generate-landing-page/    → POST — streams HTML landing page via KIE AI Claude endpoint; returns raw HTML text
    download/                 → GET ?url=… — server-proxies an image to force Content-Disposition download
    advertising/chat/         → POST — streams AI chat responses (KIE AI `gpt-5-5` via codex endpoint); campaign data injected as context
    auth/meta/                → GET — initiates Meta OAuth flow; sets `meta_oauth_state` cookie
    auth/meta/callback/       → GET — handles OAuth callback; exchanges code for token, redirects to /advertising?connected=true
    meta/sync/                → POST — fetches Meta Graph API campaigns (last 30d insights), computes health scores, returns `MetaCampaign[]`
    meta/campaign-action/     → POST — pauses/activates a Meta campaign via Graph API
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
- `lib/firebase/projects.ts` — `"use client"`. `createProject`, `deleteProject`, `updateProject`, `getProject`, `subscribeToProject` (single doc), `subscribeToProjects` (collection). New domain services follow this pattern.
- `lib/firebase/creatives.ts` — `"use client"`. Manages manually uploaded creatives subcollection.
- `lib/firebase/ai-creatives.ts` — `"use client"`. Manages AI-generated images: `createAiCreative`, `updateAiCreativeImageUrl`, `failAiCreative`, `deleteAiCreative`, `subscribeToAiCreatives`.
- `lib/firebase/ai-videos.ts` — `"use client"`. Manages AI-generated videos: `createAiVideo`, `updateAiVideoUrl`, `failAiVideo`, `deleteAiVideo`, `subscribeToAiVideos`.
- `lib/firebase/video-clips.ts` — `"use client"`. Manages video clips assembled in the video editor: `createVideoClip`, `subscribeToVideoClips`, etc.
- `lib/firebase/rendered-videos.ts` — `"use client"`. Stores final rendered video exports: `createRenderedVideo`, `subscribeToRenderedVideos`, `deleteRenderedVideo`.
- `lib/firebase/ai-landing-pages.ts` — `"use client"`. Manages AI-generated landing pages: `createAiLandingPage`, `updateAiLandingPageHtml`, `failAiLandingPage`, `deleteAiLandingPage`, `subscribeToAiLandingPages`. Types: `AiLandingPage`, `Copyframe` (`"AIDA" | "PAS" | "FAP"`), `LandingPageCriteria`.
- `lib/firebase/storage.ts` — `"use client"`. Firebase Storage upload helper (currently unused — superseded by Cloudinary).
- `lib/cloudinary.ts` — `"use client"`. Compresses + uploads product images directly to Cloudinary with XHR progress. Called from `create-project-dialog.tsx` on project creation.

**Firestore data model:**
```
users/{uid}/projects/{projectId}
  /creatives/{creativeId}       ← manually uploaded photo/video (URL-based)
  /ai-creatives/{creativeId}    ← KIE AI generated images (status: pending | done | failed)
  /ai-videos/{videoId}          ← KIE AI generated videos (status: pending | done | failed)
  /video-clips/{clipId}         ← clips assembled in the video editor (with hookEnd/bodyEnd markers)
  /rendered-videos/{videoId}    ← final exported video renders
  /ai-landing-pages/{pageId}    ← AI-generated landing pages (status: pending | done | failed; html: string)
```
All Firebase modules use a lazy getter pattern — never call `getFirestore()` / `getAuth()` at module top-level (SSR safety).

### Design system

**Always follow the AIOPT v2 design theme when making any UI changes.** All design tokens live as CSS custom properties in `app/globals.css` — never use hardcoded colors or Tailwind color utilities. Use `var(--token-name)` inline or in CSS classes. Dark mode is applied via the `.dark` class (next-themes, `attribute="class"`).

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
- Navigation: `.sidebar`, `.sidebar-nav-item`, `.sidebar-nav-item.active`
- Tabs/filters: `.auth-tabs / .auth-tab`, `.filter-tabs / .filter-tab`, `.filter-pills / .filter-pill`
- Badges/indicators: `.status-badge.<status>`, `.health-bar-track / .health-bar-fill.<color>`, `.alert-dot.<tier>`, `.kpi-trend-pill`
- Misc: `.dialog-overlay / .dialog-panel`, `.section-head`, `.user-card / .user-avatar`, `.empty-state`, `.fade-up`, `.rise`, `.spinner`

### Styling rules

- Font: Cairo (loaded via `next/font/google` in root layout, variable `--font-cairo`). Applied globally via `body { font-family: "Cairo", ... }` in globals.css.
- Tailwind v4 is present but used **minimally** (only utility classes like `min-h-screen`, `flex`, `flex-col`). Prefer CSS custom-property-based classes from globals.css.
- Radius convention: `--r-input` (10px) for inputs/buttons/chips, `--r-card` (16px) for cards/dialogs, `--r-hero` (24px) for hero elements.
- Glassmorphism: use `.glass-card` or `background: var(--glass)` + `backdrop-filter: blur(24px) saturate(160%)` for frosted surfaces. Never use solid opaque backgrounds where the design calls for glass.
- Shadows: always use `var(--card-shadow)` for card elevation — never hardcode box-shadows.
- Animations: use `.fade-up` or `.rise` for entrance animations; respect `prefers-reduced-motion` (already handled globally in globals.css).

### Marketing plan visuals

Each of the 6 plan sections has a paired visual component in `components/marketing/` (`market-analysis-visual.tsx`, `channels-visual.tsx`, `content-visual.tsx`, `phases-visual.tsx`, `kpi-visual.tsx`, `action-visual.tsx`). These receive the typed section data from `planVisualData` and an `onRegenerate` callback; they render structured cards/charts rather than raw markdown. The project detail page chooses between showing the visual component (when `planVisualData` is populated) and the raw `MarkdownRenderer` fallback.

### Creative Studio sub-tabs

`components/projects/creative-studio.tsx` — container rendered in both `/projects/:id` (Creative tab) and `/creative` (standalone page). Renders three sub-tabs:

- **Images** — inline image generation UI. POST → `taskId` → poll `/api/generate-creative/status`. Results land in `ai-creatives`.
- **Videos** — delegates to `VideoStudio`. POST → `taskId` → poll `/api/generate-video/status`. Results land in `ai-videos`.
- **Landing Page** — delegates to `LandingPageStudio`.

`components/projects/video-studio.tsx` — AI video generation panel. Follows the same async polling pattern as image generation.

`components/projects/video-editor.tsx` — timeline-style editor for assembling video clips. Clips are stored in `video-clips` subcollection with `hookEnd`/`bodyEnd` timestamp markers; rendered exports go to `rendered-videos`.

`components/projects/landing-page-studio.tsx` — generates full HTML landing pages. User picks a copyframe (AIDA / PAS / FAP) and optional criteria (segment, pillar, hook) derived from `planVisualData`. POST → `/api/generate-landing-page` streams raw HTML back. The pending doc is created in `ai-landing-pages` first; `updateAiLandingPageHtml` is called once streaming completes. The KIE AI Claude endpoint (`/claude/v1/messages`) uses `claude-opus-4-7` with `thinkingFlag: true` and `max_tokens: 32000`.

### External services & environment variables

| Variable | Side | Purpose |
|---|---|---|
| `KIE_AI_API_KEY` | server | KIE AI — image generation (`nano-banana-2` model) + marketing plan text (`gpt-5-5` model via SSE stream) |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | client | Cloudinary upload target |
| `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | client | Cloudinary unsigned upload preset |

Store these in `.env.local` (not committed).

**Streaming patterns:**
- Marketing-plan: SSE from KIE AI (`/v1/chat/completions` with `stream: true`), re-streamed as raw delta text.
- Landing page: SSE from KIE AI Claude endpoint (`/claude/v1/messages`, Anthropic SSE format) — the route parses `content_block_delta` / `text_delta` events and streams raw HTML text to the browser.
- Image/video generation: async — POST returns a `taskId`; client polls `/api/generate-creative/status?taskId=…` (or `/api/generate-video/status`) until `status === "success"`.

### Mock data & shared types

`lib/mock-data.ts` is the single source of truth for interfaces — not just mock arrays. Key types:

- `Project` — includes optional `marketingPlan` (raw markdown), `planVisualData` (`PlanVisualData`), and `productImageUrl`.
- `PlanVisualData` — structured JSON parsed from the AI plan, with fields `market?`, `channels?`, `content?`, `phases?`, `kpi?`, `action?`. Each section has a dedicated interface (`MarketAnalysisData`, `ChannelsData`, `ContentData`, `PhasesData`, `KpiData`, `ActionData`) and a dedicated visual component in `components/marketing/`.
- `Creative`, `Alert` — unchanged.

Dashboard uses `MOCK_ALERTS` (live data not yet wired); `MOCK_PROJECTS` is retained for type reference but the dashboard reads live Firestore. When replacing remaining mock data, swap the import source — component props won't change.

### TypeScript

- Strict mode on. No `any` — use `unknown` and narrow.
- Path alias `@/*` maps to the repo root.

## Key conventions

- **Firebase calls are client-side only.** Never import any `lib/firebase/*.ts` file into a Server Component or a file without `"use client"`.
- **Auth state via context only.** Use `useAuth()` from `lib/contexts/auth-context.tsx`; never call `getAuth().currentUser` directly in components.
- **One layout per route group.** `(auth)` has no layout (bare page). `(app)` has `layout.tsx` with `<AuthProvider>` + `<Sidebar>`.
- **CSS classes over inline styles for repeated patterns.** Add new reusable patterns to `globals.css`; use inline `style={{}}` only for dynamic values (widths, colors computed at runtime).
- **`lib/` for all non-component logic.** Firebase clients, contexts, mock data, utilities (`lib/utils.ts` exports `cn()`).
- **New Firestore domains** follow `lib/firebase/projects.ts`: one file per collection, export a `create*` function and a `subscribeTo*` function using `onSnapshot`.
