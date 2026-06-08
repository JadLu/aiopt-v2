# Product Specification: AIOPT - AI-Powered Marketing Platform (SaaS)

## 1. Product Vision & Market Alignment

- **Core Problem Solved:** Eliminates the fragmented e-commerce marketing workflow by centralizing strategy generation, AI creative production, and Meta ad management into a single high-velocity platform tailored for the MENA region.
- **Target User Personas:**
  - **MENA E-commerce Entrepreneurs:** Individuals requiring rapid product testing and campaign execution in Middle Eastern and North African markets.
  - **Digital Marketers:** Professionals managing multiple projects who need centralized marketing strategy, AI content production, and real-time ad performance data.
- **Unique Value Proposition:** A comprehensive, AI-powered platform that automates the full journey from market research → creative production → ad campaign management, with MENA-specific intelligence baked in at every layer.

---

## 2. Functional Architecture

### 2.1 Implemented Features (Current State)

#### Authentication & User Management
- Firebase Authentication with email/password and Google OAuth sign-in.
- Per-user project isolation — all data scoped under `users/{uid}`.
- Settings page: profile management, theme (light/dark), notifications, account deletion.

#### Project Management
- Create projects with a product name, description, target country, and product image (uploaded to Cloudinary with XHR progress).
- Project list view with live Firestore subscription.
- Project detail page with two primary tabs: **Plan** (marketing strategy) and **Creative** (content studio).

#### Marketing Plan Engine
- AI-generated marketing plan streamed in real time via KIE AI (`gpt-5-5` model, SSE).
- Plan is parsed into 6 structured sections rendered as visual components (not raw markdown):
  - **Market Analysis** — market size, competitors, positioning.
  - **Channels** — recommended ad platforms and allocation.
  - **Content** — content themes and formats.
  - **Phases** — campaign rollout timeline.
  - **KPIs** — key performance indicators and targets.
  - **Action Plan** — prioritized next steps.
- Each section can be regenerated independently.
- Fallback raw markdown renderer for unstructured plan output.

#### Creative Studio (3 sub-tabs)

**Images**
- Text-to-image generation via KIE AI (`nano-banana-2` model).
- Async task pattern: POST returns `taskId` → client polls `/api/generate-creative/status`.
- Generated images stored in the `ai-creatives` Firestore subcollection (status: `pending | done | failed`).
- Gallery view with lightbox, 3-dot menu (download, delete), and image proxy endpoint (`/api/download`) for forced file saves.
- Manual creative uploads also supported (`creatives` subcollection, URL-based).

**Videos**
- Text-to-video + image-to-video generation via KIE AI (`gemini-omni-video` model).
- Configurable: aspect ratio (9:16, 16:9, 1:1), duration (5s / 8s), resolution (480p / 720p / 1080p).
- Same async polling pattern; results stored in `ai-videos` subcollection.
- **Video Editor:** Timeline-style editor for assembling clips. Clips stored in `video-clips` subcollection with `hookEnd` / `bodyEnd` timestamp markers. Final exports stored in `rendered-videos` subcollection.

**Landing Pages**
- AI-generates full HTML landing pages via KIE AI Claude endpoint (`claude-opus-4-7`, extended thinking, 32k tokens).
- User selects a **copyframe** (AIDA / PAS / FAP) and optional criteria (audience segment, marketing pillar, hook) derived from the project's marketing plan.
- Streams raw HTML back; stored in `ai-landing-pages` subcollection once complete.
- In-app preview with full-screen lightbox; download as `.html` file.

#### Advertising Command Center (Meta Ads)
- **Meta OAuth flow:** Connect/disconnect a Meta Business account (`/api/auth/meta`, `/api/auth/meta/callback`). Token stored in `meta-accounts` Firestore collection.
- **Campaign sync:** Fetches live campaign data from Meta Marketing API (`/api/meta/sync`), stored in `meta-campaigns` collection. Stale-data detection with manual refresh.
- **Campaign table:** Displays spend, impressions, clicks, CTR, CPC, CPM, ROAS, frequency with color-coded health badges.
- **Campaign actions:** Pause, resume, and budget adjustment sent directly to Meta API (`/api/meta/campaign-action`).
- **Alert system:** Rule-based alert engine. Users define custom thresholds (e.g., ROAS < 2.0 = Red). Alerts fire when synced metrics breach rules. Alert feed with resolve/dismiss actions. Rules managed via `alert-rules` subcollection; triggered alerts in `ad-alerts` subcollection.
- **Stats bar:** Aggregated totals — total spend, impressions, active campaigns, average ROAS.
- **AI Chat:** Embedded AI advisor (`/api/advertising/chat` via KIE AI) with live campaign data as context. Provides MENA-specific Meta Ads recommendations (ROAS benchmarks, seasonal patterns, creative fatigue detection, scaling strategies).

### 2.2 Roadmap (Not Yet Built)

- **Multi-Channel Integration:** TikTok, Snapchat, and Google Ads campaign management.
- **Localized Voiceover Generation:** MENA dialect voiceovers for video creatives (e.g., via ElevenLabs).
- **Logistics & COD Integration:** Cash-on-Delivery tracking alongside ad spend for real-time profitability.
- **Auto-Pause Kill-Switch:** Automatically pause campaigns that breach Red Alert thresholds.
- **Meta API Rate-Limit Proxy / Redis Cache:** Cache layer to stay within Meta API limits at scale.

---

## 3. UI/UX Blueprint

### Primary User Flow
1. **Initiation:** Create a project, set product name + target country, upload product image.
2. **Strategy:** Generate the AI Marketing Plan → explore the 6 structured visual sections.
3. **Production:** Switch to Creative tab → generate images, videos, or landing pages using prompts informed by the plan.
4. **Execution:** Go to Advertising → connect Meta account → sync campaigns → monitor with color-alert system.
5. **Optimization:** Use the AI Chat advisor to interpret metrics and take targeted campaign actions.

### Key Interface Views
- **Dashboard:** Project cards with health indicators, quick links to Plan and Creative tabs.
- **Project Detail — Plan Tab:** 6-section visual marketing plan with per-section regenerate controls.
- **Project Detail — Creative Tab / `/creative` standalone:** Images, Videos, and Landing Pages sub-tabs with generation forms and result galleries.
- **Advertising Page:** Campaign table with stats bar, alert feed, alert rules dialog, and AI chat panel.
- **Settings:** Profile, appearance (theme toggle), notifications, danger zone.

### Design Language
- **Aesthetic:** Clean, spacious "Mac Apple" style with frosted glass effects (`.glass-card`) and high responsiveness.
- **Typography:** Cairo font (Google Fonts, loaded via `next/font`) for all UI text.
- **Color Tokens:** CSS custom properties (`--bg-base`, `--accent-primary` #5AC8D6 teal, `--accent-secondary` #6FB1E8 blue, `--danger`, `--success`, `--warning`). Dark mode via `.dark` class.
- **Radius:** 10px inputs/buttons, 16px cards/dialogs, 24px hero elements.
- **Alert Tiers:** Green (healthy) → Yellow (watch) → Red (critical), applied via `.alert-dot.<tier>` and `.status-badge.<status>` CSS classes.

---

## 4. Technical Stack & Infrastructure

### Frontend
- **Next.js (App Router)** — SSR + client components, route groups `(auth)` and `(app)`.
- **React 19** with `"use client"` boundaries at Firebase/auth interaction points.
- **Tailwind v4** (utility-only, minimal use) + CSS custom properties in `globals.css`.

### Backend (API Routes — Next.js)
- All server logic lives in `app/api/` as Next.js Route Handlers (no separate backend process).
- Streaming: Server-Sent Events (SSE) for marketing plan and landing page generation.
- Async task polling: image and video generation use a POST-then-poll pattern.

### Database & Storage
- **Firebase Firestore** — primary database. All user data scoped under `users/{uid}/projects/{projectId}` with subcollections per domain.
- **Firebase Authentication** — email/password + Google OAuth.
- **Cloudinary** — product image uploads (unsigned preset, XHR progress, client-side).
- Firebase Storage module present but superseded by Cloudinary for media uploads.

### Firestore Data Model
```
users/{uid}/projects/{projectId}
  /creatives/{creativeId}         ← manually uploaded assets (URL-based)
  /ai-creatives/{creativeId}      ← AI image generations (status: pending|done|failed)
  /ai-videos/{videoId}            ← AI video generations (status: pending|done|failed)
  /video-clips/{clipId}           ← clips assembled in video editor (hookEnd/bodyEnd markers)
  /rendered-videos/{videoId}      ← final exported video renders
  /ai-landing-pages/{pageId}      ← AI landing page HTML (status: pending|done|failed)

users/{uid}/meta-accounts/{accountId}    ← Meta OAuth tokens & account info
users/{uid}/meta-campaigns/{campaignId}  ← synced Meta campaign metrics
users/{uid}/ad-alerts/{alertId}          ← fired alert instances
users/{uid}/alert-rules/{ruleId}         ← user-defined threshold rules
```

### External Services & Environment Variables

| Variable | Side | Purpose |
|---|---|---|
| `KIE_AI_API_KEY` | server | All AI generation — images (`nano-banana-2`), videos (`gemini-omni-video`), marketing plans (`gpt-5-5`), landing pages (`claude-opus-4-7`), ad chat |
| `META_APP_ID` | server | Meta OAuth app credentials |
| `META_APP_SECRET` | server | Meta OAuth app credentials |
| `NEXT_PUBLIC_APP_URL` | server | OAuth redirect base URL |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | client | Cloudinary upload target |
| `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | client | Cloudinary unsigned upload preset |

### KIE AI Endpoints Used
| Endpoint | Model | Usage |
|---|---|---|
| `POST /v1/chat/completions` (SSE) | `gpt-5-5` | Marketing plan streaming |
| `POST /kling/v1/videos/image2video` | `gemini-omni-video` | Video generation |
| `GET /kling/v1/videos/image2video/{taskId}` | — | Video status polling |
| `POST /api/generate-creative` (proxy) | `nano-banana-2` | Image generation |
| `POST /claude/v1/messages` (SSE) | `claude-opus-4-7` | Landing page generation |
| `POST /codex/v1/responses` | — | AI advertising chat |

### Hosting
- Deployable to **Vercel** (Next.js-native). Firebase credentials are client-side public keys hardcoded in `lib/firebase/config.ts`.

---

## 5. Key Architectural Conventions

- **Firebase calls are client-side only.** All `lib/firebase/*.ts` modules use `"use client"` and lazy singleton getters — never imported in Server Components.
- **Auth state via context only.** `useAuth()` from `lib/contexts/auth-context.tsx` is the single source of truth; never call `getAuth().currentUser` directly.
- **CSS classes over inline styles for patterns.** Reusable patterns live in `globals.css`; inline `style={{}}` only for runtime-computed values.
- **No `any` types.** TypeScript strict mode; use `unknown` and narrow.
- **Path alias `@/*`** maps to repo root.
- **New Firestore domains** follow the pattern in `lib/firebase/projects.ts`: one file per collection, `create*` + `subscribeTo*` exports using `onSnapshot`.
