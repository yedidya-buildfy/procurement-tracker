# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- **Dev server:** `npm run dev` (runs on port 3001)
- **Build:** `npm run build`
- **Lint:** `npm run lint`
- **Convex dev:** `npx convex dev` (must run alongside Next.js dev server)
- **Convex deploy:** `npx convex deploy`

## Architecture

This is a **Hebrew RTL** procurement tracking app built with **Next.js 16 (App Router)** + **Convex** as the backend database. It manages international purchase orders, kits/samples sourcing, and supplier relationships.

### Stack
- **Frontend:** Next.js 16, React 19, Tailwind CSS v4, Heroicons (24/outline, thin style)
- **Backend:** Convex (real-time database, no REST API for data — uses Convex queries/mutations directly from React via `useQuery`/`useMutation`)
- **Font:** Heebo (Hebrew + Latin)
- **Styling utility:** `cn()` from `src/lib/utils.ts` (clsx + tailwind-merge)

### Data Flow
- Convex schema and server functions live in `convex/` — this is the source of truth for all data
- `convex/schema.ts` defines all tables; `convex/helpers.ts` has shared business logic (currency conversion, cost allocation, ID generation)
- React components call Convex directly via `useQuery(api.xxx.yyy)` and `useMutation(api.xxx.yyy)` — there is no intermediate API layer for Convex data
- `src/app/api/` routes exist for Google Sheets sync operations (legacy), not for Convex data

### Two Main Modules

**Orders Module** (`src/app/orders/`, `src/components/order/`):
- Tracks purchase orders with products, additional costs, payments, and milestones
- Cost allocation system distributes additional costs to products by method: equal, volume, weight, cost, or quantity (Hebrew: שווה, נפח, משקל, עלות, כמות)
- Three currencies: USD, CNY, ILS — all converted to ILS for totals using per-order exchange rates

**Kits Module** (`src/app/kits/`, `src/components/kits/`):
- Manages product kits with samples sourcing workflow
- Sample stages pipeline: הוזמן → נשלח לסוכן → הגיע לסוכן → נשלח אלינו → הגיע (defined in `src/lib/sampleStages.ts`)
- Kit products → samples (from suppliers) → final products (chosen supplier/specs for production)
- Kit final products can auto-fill into order products via `sourceKitId`/`sourceKitFinalProductId`

### Key Patterns
- All IDs are generated as `{prefix}-{timestamp}-{random}` strings (not Convex `_id`)
- Convex tables use custom string IDs with secondary indexes (e.g., `by_orderId`, `by_kitId`)
- Link tables (`costProductLinks`, `paymentProductLinks`, `paymentCostLinks`) connect entities many-to-many
- File uploads use Convex storage (`_storage`) with separate tables for file metadata
- UI components in `src/components/ui/` are custom (no component library)

## Conventions

- All UI text is in **Hebrew** — maintain Hebrew for user-facing strings
- Layout is **RTL** (`dir="rtl"` on `<html>`)
- Icons: use `@heroicons/react/24/outline` exclusively (thin outline style, never solid/filled)
- Never use emojis in code — use Heroicons instead
- Environment variable `NEXT_PUBLIC_CONVEX_URL` is required for Convex connection

## Production deployment (Coolify + self-hosted Convex)

The app runs on a **self-hosted Coolify** VPS, not Vercel/Render. Anything you change in this repo only reaches users after **two** deploys: the Next.js app to Coolify, and the Convex schema/functions to the self-hosted Convex backend.

### Coolify access (read the full reference first)

The complete Coolify recipe — auth gotcha, all UUIDs, list/inspect/deploy/env/create/delete examples, build pitfalls — lives at `/Users/yedidya/Desktop/dashbord/docs/integrations/coolify.md`. **Read it before touching anything.**

The token is in `/Users/yedidya/Desktop/dashbord/.env` as `COOLIFY_API_TOKEN`. It contains a literal `|` so never `source` the file — read it with grep+cut:

```bash
TOKEN=$(grep '^COOLIFY_API_TOKEN=' /Users/yedidya/Desktop/dashbord/.env | cut -d'=' -f2-)
BASE=http://172.233.209.162:8000/api/v1
H="Authorization: Bearer $TOKEN"
```

### This project's Coolify resources

- **App** `procurement-tracker` uuid `sscc044csgwwsco4ooowcgw0` — Nixpacks build, repo `yedidya-buildfy/procurement-tracker` branch `main`, fqdn `https://procurement.drive-buddy.com`, `NIXPACKS_NODE_VERSION=22`, port 3000.
- **Self-hosted Convex service** `convex-backend` uuid `l8ckckkcsooo040gcog8goos`, instance name `procurement-07cd633f`, fqdn `https://convex.drive-buddy.com`. **Production runs against this**, not Convex Cloud.
- Project "Production" uuid `i8sw0044g4w48k8ksoogs04s` (env `production`).
- Server uuid `xo8owkswg8ggs4c0koscgcko`.

### No GitHub auto-deploy

Coolify is not wired to a GitHub webhook. After pushing to `main` you must trigger a deploy:

```bash
curl -sH "$H" "$BASE/deploy?uuid=sscc044csgwwsco4ooowcgw0&force=true"
```

### Convex schema — local dev cloud vs production self-hosted

`.env.local` points at the cloud dev deployment (`giddy-crab-311.convex.cloud`). `npx convex dev` only updates that one. **Production lives on the self-hosted backend** at `https://convex.drive-buddy.com` and only refreshes when you run `npx convex deploy` against it with the self-hosted admin key.

To deploy schema/mutation changes to production:

```bash
export CONVEX_SELF_HOSTED_URL=https://convex.drive-buddy.com
export CONVEX_SELF_HOSTED_ADMIN_KEY=<from VPS: docker exec convex-backend-... ./generate_admin_key.sh>
npx convex deploy
```

The admin key is **not** stored in this repo. To regenerate, SSH the VPS and exec into the convex-backend container.

If you ship a code change that calls a mutation with a new arg or queries a new table without first deploying the schema, the production frontend will throw `ArgumentValidationError: Object contains extra field …` and the feature silently fails for users. Always update the schema first, then trigger the Coolify deploy.

### Releasing a change end-to-end

1. Commit & push to `main`.
2. `npx convex deploy` against the self-hosted backend (only if `convex/schema.ts` or any mutation/query validator changed).
3. `curl -sH "$H" "$BASE/deploy?uuid=sscc044csgwwsco4ooowcgw0&force=true"` to build the new app image.
4. Watch `curl -sH "$H" "$BASE/applications/sscc044csgwwsco4ooowcgw0/logs?lines=80"` for runtime errors.
