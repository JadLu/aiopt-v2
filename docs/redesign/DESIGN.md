# POLARIS SM v2 — Liquid Glass design spec

Reference mockups: `docs/redesign/mockups/*.dc.html`. Open them in a browser to view, or read them for exact values.
(They use a mockup format with `{{…}}` placeholders and `<sc-for>` loops. Treat these as pseudo-code; copy the **styles**, not the markup format.)

Follow the existing rule in CLAUDE.md: tokens are CSS custom properties in `app/globals.css`, with no hardcoded colors in components. Extend the tokens that already exist, and don't create a parallel system.

## 1. Look in one line
Frosted glass panels floating over soft coloured light, with bright light-catching rims, one cyan accent, and generous rounding.

## 2. Tokens to add or update in `app/globals.css`

| Token | Dark | Light | Use |
|---|---|---|---|
| `--bg-app` | `#05060A` | `#EEF1F6` | page background under the blobs |
| `--text-primary` | `#F4F6FA` | `#0E1320` | |
| `--text-secondary` | `rgba(235,240,255,.62)` | `rgba(14,19,32,.70)` | must keep 4.5:1 contrast (light was .62 in the first draft; .70 is what passes over a blob) |
| `--accent-primary` | `#7FE7F5` | `#085F74` | links, active icons (light uses a darker teal: `#0A6F87` measured 4.43:1 over glass on a blob) |
| `--text-tertiary` | `#6E6E73` | `#4E5668` | helper text, meta lines |
| `--accent-secondary`, `--success`, `--warning`, `--danger` | brand values | `#0C5A92`, `#15603A`, `#744200`, `#A61F16` | used for text and badges, so the light values are darkened to ≥ 4.5:1 |
| `--on-accent` | `#03141B` | `#FFFFFF` | text on a solid `--accent-primary` fill |
| `--accent-violet`, `--star` | `#C084FC`, `#E8A93B` | `#5F2FB5`, `#A86400` | violet labels and the starred-angle icon |

Light contrast is measured against the **worst** background: the thinnest glass (42% white) over the indigo blob (`#D8E1FC`), not the flat page colour.
| `--glass` | `linear-gradient(160deg, rgba(255,255,255,.10), rgba(255,255,255,.045) 42%, rgba(255,255,255,.025))` | `linear-gradient(160deg, rgba(255,255,255,.78), rgba(255,255,255,.52) 45%, rgba(255,255,255,.42))` | panel fill |
| `--glass-inner` | `rgba(255,255,255,.055)` | `rgba(255,255,255,.55)` | nested chips, inner tiles |
| `--glass-rim` | `linear-gradient(135deg, rgba(255,255,255,.55), rgba(255,255,255,.08) 30%, transparent 55%, rgba(255,255,255,.06) 75%, rgba(255,255,255,.3))` | `linear-gradient(135deg, #fff, rgba(255,255,255,.5) 30%, rgba(255,255,255,.15) 55%, rgba(180,195,225,.35) 80%, rgba(255,255,255,.9))` | 1px gradient border (see §3) |
| `--card-shadow` | `inset 0 1px 0 rgba(255,255,255,.22), 0 1px 2px rgba(0,0,0,.3), 0 30px 60px -24px rgba(0,0,0,.7)` | `inset 0 1px 0 rgba(255,255,255,.95), 0 1px 2px rgba(20,30,60,.06), 0 24px 50px -24px rgba(30,45,90,.28)` | |
| `--well` | `rgba(0,0,0,.28)` + `inset 0 2px 6px rgba(0,0,0,.35)` | `rgba(255,255,255,.6)` + `inset 0 1px 3px rgba(20,30,60,.12)` | inputs and textareas (recessed) |
| `--liquid` | `linear-gradient(180deg, #A8F4FF, #5AD2EC 52%, #2BA3C9)` | `linear-gradient(180deg, #9EEFFF, #43C6E6 52%, #1C98C2)` | primary button fill, text `#03141B` |
| `--blob-a/b/c/d` | cyan `rgba(64,214,236,.5)`, indigo `rgba(70,110,255,.42)`, violet `rgba(167,120,250,.3)`, amber `rgba(255,170,90,.22)` | same hues, lighter: `rgba(80,215,240,.55)`, `rgba(120,150,255,.42)`, `rgba(196,170,255,.45)`, `rgba(255,190,140,.45)` | background lights |

Radii: inputs/chips `14px`, small tiles `16–20px`, cards `24–28px`, dialog `34px`, pills `999px`.

## 3. Reusable classes (add to globals.css)

- **`.glass`**: `background: var(--glass); backdrop-filter: blur(30px) saturate(180%); box-shadow: var(--card-shadow); position: relative; isolation: isolate;`, plus the rim:
  ```css
  .glass::before{content:"";position:absolute;inset:0;border-radius:inherit;padding:1px;
    background:var(--glass-rim);
    -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
    -webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none;z-index:-1}
  ```
- **`.glass-inner`**: `background: var(--glass-inner); box-shadow: inset 0 1px 0 rgba(255,255,255,.14), inset 0 0 0 1px rgba(255,255,255,.07)`. Use it for chips, stat tiles and button tracks. **No backdrop-filter** (performance).
- **`.btn-liquid`**: `background: var(--liquid); color:#03141B; font-weight:700; box-shadow: inset 0 1px 0 rgba(255,255,255,.75), inset 0 -3px 8px rgba(0,60,80,.35), 0 12px 30px -10px rgba(76,201,230,.75)`. Use it for **one primary action per screen**.
- **`.segmented` / `.segmented-item[aria-selected=true]`**: glass track; the selected item is a white pill `linear-gradient(180deg,#fff,#DDE6F0)` with dark text in dark mode, and a dark pill `linear-gradient(180deg,#2A3040,#0E1320)` with white text in light mode.
- **`.chip` / `.chip[aria-pressed=true]`**: when selected, `linear-gradient(180deg, rgba(127,231,245,.24), rgba(127,231,245,.08))` plus `inset 0 0 0 1px rgba(127,231,245,.42)`.
- **`.input-well`**: recessed input, with focus ring `inset 0 0 0 1px rgba(127,231,245,.55), 0 0 0 4px rgba(127,231,245,.12)`.
- **`.ambient`**: 3–4 absolutely-positioned blurred radial gradients (`--blob-*`), each 600–850px, with `filter: blur(30–40px)`, placed top-right, bottom-left, centre and bottom-right.
- **Motion**: hover lift `translateY(-3px)` over 250ms `cubic-bezier(.2,.8,.2,1)`, and a shimmer skeleton for loading. The existing reduced-motion rule must still apply.

Also: `.import-panel` (+ `.import-badge`) is the cyan-tinted "Start from a product link" box in the New Project dialog, and `.or-divider` the "Or fill in manually" rule under it.

## Brand assets
Source sheet: `Logo.jpeg` (repo root). Generated from it: `app/icon.png`, `app/apple-icon.png` and `app/favicon.ico` (Next.js picks these up automatically), `public/logo-icon.png` (app-icon tile, used on the sign-in page via `.brand-mark`), and `public/brand/` (`logo-vertical.png`, `logo-horizontal.png` with transparent backgrounds, `icon-192.png`, `icon-512.png`). The lockups use dark navy text, so use them on light backgrounds only; on dark surfaces use the icon tile plus live text.

## 4. Type
- Latin UI: **Inter Tight** (400/500/600/700). Arabic: **Cairo**. Stack: `"Inter Tight", "Cairo", system-ui, sans-serif`. Load both via `next/font/google`.
- Numbers: `font-variant-numeric: tabular-nums`.
- Page title 34px/600/-0.025em; section title 22px/600; labels 11px/600 uppercase, letter-spacing .12em.
- Any user or AI-generated text uses `dir="auto"`. Arabic option chips use `dir="rtl"` and the Cairo font.

## 5. Rules
- Blur (`backdrop-filter`) only on large surfaces: cards, dialogs and the profile widget. Never on chips or list items, because it lags older laptops.
- Red and green are for status only. Cyan is the only accent.
- Every empty state shows the one next action, never a bare "—".
- Touch targets are ≥ 40px tall, and icon-only buttons have an `aria-label`.
- Selected/checked state uses `aria-pressed`, `aria-selected` or `aria-current`, and the CSS styles that attribute.
