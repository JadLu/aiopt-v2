# POLARIS SM v2 — Redesign & hardening plan (for Claude Code in VS Code)

Do one phase per Claude Code conversation. Start each phase with `/plan`, read the plan, approve it, then test in the browser (`pnpm dev`), run `pnpm build` and `pnpm lint`, and **commit before moving on**.

Supporting files: `docs/redesign/DESIGN.md` (look and tokens) and `docs/redesign/mockups/` (screen sources).

---

## Phase 0: Prep (5 min, by hand)

1. `git checkout -b redesign`
2. **Edit `CLAUDE.md` → delete the "Permissions" section** ("run all tool calls … without asking"). During security and refactor work you want to see each change before it happens.
3. Commit (run these one at a time; Windows PowerShell 5 doesn't accept `&&`):
   ```powershell
   git add docs CLAUDE.md
   git commit -m "docs: redesign plan"
   ```

---

## Phase 1: Security fixes ⚠️ do this first

**Why first:** credits are currently deducted **in the browser** (`lib/firebase/credits.ts`, called from `creative-studio.tsx`, `video-studio.tsx` and `landing-page-studio.tsx`). `firestore.rules` also lets a user write their own `users/{uid}` document, which includes `credits`. Anyone can open DevTools and give themselves unlimited credits, or call `/api/generate-creative` directly without paying. Only `/api/marketing-plan` charges on the server today.

Prompt:
```
/plan Security hardening. Read @docs/redesign/PLAN.md Phase 1 first.

1. Credits must be server-only:
   - In every AI route (generate-creative, generate-video, generate-landing-page) charge with adminDeductCredits BEFORE calling KIE AI and adminRefundCredits on any failure, exactly like app/api/marketing-plan/route.ts. Costs come from one shared server-side constant (move CREDIT_COSTS + videoCreditCost to lib/credit-costs.ts, importable by both client UI and server).
   - For async jobs (image/video): when the status route sees "fail", refund once. Store the job server-side in users/{uid}/jobs/{taskId} with {uid, cost, kind, status, refunded} via Admin SDK so refunds happen once and only for the owner.
   - Remove deductCredits/refundCredits from the client (creative-studio, video-studio, landing-page-studio) and delete them from lib/firebase/credits.ts. Keep getCredits/subscribeToCredits. Move initUserCredits to the server too.
2. firestore.rules: the users/{uid} document is read-only for the client (or allow updates that don't touch `credits`); subcollections stay owner read/write; add a `jobs` subcollection that clients can read but not write. Note: `users/{userId}/{document=**}` also matches the user doc itself, so split the rules.
3. Status routes: only return results for a taskId that belongs to the caller (look it up in users/{uid}/jobs).
4. Input validation with zod on every API route: prompt ≤ 2000 chars, aspectRatio/resolution/duration from allowlists, imageInput/imageUrls max 4 URLs and https only on our own Cloudinary host. Reject anything else with 400.
5. /api/download: require auth, use fetch(url, { redirect: "manual" }) so a redirect can't escape the host allowlist, cap size at 50 MB, and drop the bare "kie.ai" root entries unless needed.
6. Rate limit generation routes per uid (e.g. 10 requests/min) — simple Firestore counter is fine for now.
7. Remove console.log of full upstream responses; log only status + taskId.
8. Cloudinary: switch from the unsigned upload preset to signed uploads via a new /api/upload-signature route (auth required, folder = users/{uid}, max 10 MB, images only).
9. Update CLAUDE.md to reflect: credits are server-only; the "Firebase calls are client-side only" rule has an exception for lib/firebase/admin*.ts in API routes.

List every file you'll change first. Don't change UI design in this phase.
```
**Check:** in DevTools, try `updateDoc(users/{uid}, {credits: 9999})`; it must be denied. Then generate one image and confirm the balance drops by 35 on the server.

**By hand, not in code:** rotate your KIE AI key and Firebase service account if they've ever been shared, committed or pasted anywhere. In the KIE AI dashboard, set a monthly spending cap.

---

## Phase 2: Remove ads leftovers and CPA / ROAS / Health

```
/plan Remove leftover ad-era features. Target CPA, Target ROAS and Health are no longer in the product.
- components/dashboard/create-project-dialog.tsx: remove targetCpa/targetRoas fields and state.
- components/dashboard/project-card.tsx, app/(app)/projects/page.tsx, app/(app)/dashboard/page.tsx, components/dashboard/kpi-card.tsx: remove CPA, ROAS, spend, health index and "Critical" badges.
- lib/mock-data.ts Project type: make targetCpa/targetRoas/health optional and unused (don't migrate Firestore data).
- Search the repo for meta-ads, meta-accounts, meta-campaigns, ad-alerts, alert-rules, ROAS, CPA and remove dead code; update the comment in firestore.rules.
Show me the search results before deleting.
```

---

## Phase 3: Design foundation (no page changes yet)

```
/plan Implement the Liquid Glass foundation from @docs/redesign/DESIGN.md.
- Update tokens in app/globals.css for :root (light) and .dark, keeping existing token names where they exist and adding the new ones.
- Add classes: .glass (with ::before rim), .glass-inner, .btn-liquid, .segmented, .chip, .input-well, .ambient blobs, .lift, .shimmer.
- Load Inter Tight alongside Cairo in app/layout.tsx (next/font/google) and set the font stack.
- Build small components in components/ui/: GlassCard, LiquidButton, SegmentedControl, Chip, StatusBadge, EmptyState.
- Make a temporary /design-check page showing every component in both themes so I can review. Don't touch other pages.
```

---

## Phase 4: App shell (sidebar and top bar)

```
/plan Restyle components/sidebar.tsx and app/(app)/layout.tsx to match @docs/redesign/mockups/Dashboard.dc.html: floating glass sidebar with 28px radius and 16px margin, glossy logo tile, active item with cyan tint + glow, credits widget at the bottom ("700 credits · Top up"). Rename nav: "Creative Studio" → "Library" (keep /creative URL for now). Keep collapse behaviour. Use only classes from globals.css.
```

---

## Phase 5: Dashboard, then Projects list (two conversations)

```
/plan Rebuild app/(app)/dashboard/page.tsx to match @docs/redesign/mockups/Dashboard.dc.html (dark) and DashboardLight.dc.html (light): 3 KPI cards (Projects with active/archived chips, Markets, Credits), project grid with image header, status pill, health ring REMOVED, two actions (Plan, Creative), and a "Launch checklist" panel (Create project → Generate marketing plan → Produce posts & videos) driven by real project data. Empty states must show the next action.
```
```
/plan Rebuild app/(app)/projects/page.tsx to match @docs/redesign/mockups/Projects.dc.html: segmented status filter with counts, search, row cards (thumb, name with dir="auto", status, market, updated time, Plan/Creative buttons, options menu) and a dashed "Start a new product test" row.
```

---

## Phase 6: New Project dialog

```
/plan Rebuild components/dashboard/create-project-dialog.tsx to match @docs/redesign/mockups/NewProject.dc.html (its <script> block has the full country data and selection logic).
- Create lib/countries.ts: all countries grouped by region tabs (MENA, Europe, Americas, Africa, Asia, Oceania) and sub-groups, each with ISO code; MENA sub-groups carry an Arabic dialect label (Khaleeji, Shami/Iraqi, Egyptian/Sudanese, Maghrebi).
- UI: region tabs with selected-count badges, global search across all regions, removable chips for selected countries + "Clear all", no "Select all". Store ISO codes on the project (keep backward compatibility with existing name-based `countries`).
- Description counter 0/500, photo drop zone, buttons "Cancel" and "Create & generate plan" — the latter creates the project and immediately starts the plan (reuse the generate-plan flow), then routes to /projects/:id.
- Leave the "Start from a product link" box out for now (Phase 10).
```

---

## Phase 7: Project workspace

```
/plan Restyle app/(app)/projects/[id]/page.tsx to match @docs/redesign/mockups/Project.dc.html.
- Replace the Plan | Creative tabs with a stepper: Brief → Plan → Creatives → Library, each showing status ("Done", "Writing · 3 of 6", "Pick an angle first").
- Header: product name (dir="auto"), status, market chips, voice dialect derived from the market.
- Plan step: keep the existing 6 sections and their visual components in components/marketing/ (market analysis, channels, content, phases, KPI, action) — the mockup's section names are placeholders. Show sections as they stream in, with shimmer for unfinished ones and a note "You can leave this page".
- Angles from planVisualData become cards with star, regenerate-one, and "Use this angle" which opens the Creatives step with that angle preselected.
```

---

## Phase 8: Creatives step and Library

```
/plan Restyle components/projects/creative-studio.tsx to match @docs/redesign/mockups/CreativeStudio.dc.html.
- Preselect the recommended Angle / Channel / Pillar / Hook; put the full pickers behind a "Customize" toggle.
- Show the cost on the button ("Generate · 35 credits") using lib/credit-costs.ts.
- Add "Generate test set" (one image per starred angle) with a confirm showing the total cost.
- Results grid: glass cards with aspect badge and download / regenerate / more actions; shimmer card while pending; failed card says "Credits refunded".
- /creative becomes the Library: all creatives across projects, filterable by project, with ZIP download of the selection.
```

---

## Phase 9: Notifications and light theme polish

```
/plan Add a notifications centre (bell + sidebar item): plan ready, creatives ready, generation failed (credits refunded), credits low. Store in users/{uid}/notifications written by the server routes. Then go through every page in light mode against @docs/redesign/mockups/DashboardLight.dc.html and fix contrast (text ≥ 4.5:1).
```

---

## Phase 10: Import from product link (do it last; it has the most risk)

```
/plan Add "Start from a product link" to the New Project dialog (see mockup). New route /api/import-product:
- auth + rate limit + 5 credits (or free, decide)
- SSRF protection: https only; allowlist hosts (aliexpress.com, amazon.*, *.myshopify.com, …); resolve DNS and block private/loopback/link-local IPs; redirect: "manual" and re-check each hop; 5s timeout; 2 MB max body.
- Extract title, description and main image from Open Graph / JSON-LD; re-upload the image to our Cloudinary via signed upload; never pass the raw page HTML to the browser.
- Treat extracted text as untrusted data in any later AI prompt.
```

---

## Every phase ends with
```
Run pnpm build and pnpm lint, fix any errors, then summarise what changed and what I should click to test it.
```
