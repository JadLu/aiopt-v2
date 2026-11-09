# POLARIS SM

AI marketing workspace for MENA e-commerce sellers: marketing plan, creatives and landing pages for each product. See [specification.md](specification.md) for the product and [CLAUDE.md](CLAUDE.md) for the code conventions.

## Setup

```bash
pnpm install --ignore-scripts
cp .env.local.example .env.local   # fill in the values
pnpm dev                           # http://localhost:3000
```

Required variables are listed in `.env.local.example`.

## Scripts

- `pnpm dev` — development server
- `pnpm build` — production build and type check
- `pnpm lint` — ESLint
