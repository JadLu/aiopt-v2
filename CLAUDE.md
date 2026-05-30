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
    projects/[id]/ → /projects/:id  (project detail — two tabs: Marketing Plan + Creative)
  api/
    marketing-plan/        → POST — streams AI marketing plan text (KIE AI)
    generate-creative/     → POST — creates KIE AI image generation task; returns taskId
    generate-creative/status/ → GET ?taskId=… — polls KIE AI for task result / imageUrl
    download/              → GET ?url=… — server-proxies an image to force Content-Disposition download
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
- `lib/firebase/storage.ts` — `"use client"`. Firebase Storage upload helper (currently unused — superseded by Cloudinary).
- `lib/cloudinary.ts` — `"use client"`. Compresses + uploads product images directly to Cloudinary with XHR progress. Called from `create-project-dialog.tsx` on project creation.

**Firestore data model:**
```
users/{uid}/projects/{projectId}
  /creatives/{creativeId}      ← manually uploaded photo/video
  /ai-creatives/{creativeId}   ← KIE AI generated images (status: pending | done | failed)
```
All Firebase modules use a lazy getter pattern — never call `getFirestore()` / `getAuth()` at module top-level (SSR safety).

### Design system

All design tokens live as CSS custom properties in `app/globals.css` — never use hardcoded colors or Tailwind color utilities. Use `var(--token-name)` inline or in CSS classes. Dark mode is applied via the `.dark` class (next-themes, `attribute="class"`).

Key tokens: `--bg-base`, `--bg-elevated`, `--bg-subtle`, `--border-default`, `--text-primary`, `--text-secondary`, `--text-tertiary`, `--accent-primary` (#5AC8D6 teal), `--accent-secondary` (#6FB1E8 blue), `--success`, `--warning`, `--danger`.

Reusable CSS class families defined in `globals.css`: `.card`, `.glass-card`, `.btn-primary`, `.btn-secondary`, `.auth-input`, `.auth-tabs / .auth-tab`, `.status-badge.<status>`, `.health-bar-track / .health-bar-fill.<color>`, `.alert-dot.<tier>`, `.sidebar`, `.app-shell / .app-main / .app-topbar / .app-content`, `.dialog-overlay / .dialog-panel`.

### Styling rules

- Font: Cairo (loaded via `next/font/google` in root layout, variable `--font-cairo`). Applied globally via `body { font-family: "Cairo", ... }` in globals.css.
- Tailwind v4 is present but used **minimally** (only utility classes like `min-h-screen`, `flex`, `flex-col`). Prefer CSS custom-property-based classes from globals.css.
- Radius convention: 10px (`--radius-md`) for inputs/buttons/cards, 16px (`--radius-lg`) for larger cards/dialogs, 24px (`--radius-xl`) for hero elements.

### External services & environment variables

| Variable | Side | Purpose |
|---|---|---|
| `KIE_AI_API_KEY` | server | KIE AI — image generation (`nano-banana-2` model) + marketing plan text (`gpt-5-5` model via SSE stream) |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | client | Cloudinary upload target |
| `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | client | Cloudinary unsigned upload preset |

Store these in `.env.local` (not committed). The marketing-plan route streams SSE from KIE AI and re-streams raw delta text to the browser. The generate-creative flow is async: POST returns a `taskId`; the client polls `/api/generate-creative/status?taskId=…` until `status === "success"`.

### Mock data

`lib/mock-data.ts` — `Project` / `Alert` interfaces, `MOCK_PROJECTS`, `MOCK_ALERTS`, `MOCK_STATS`. Dashboard still uses `MOCK_ALERTS` and `MOCK_STATS`; `MOCK_PROJECTS` is retained for type safety but the dashboard now reads live Firestore data. When replacing remaining mock data, swap the import — component props won't change.

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
