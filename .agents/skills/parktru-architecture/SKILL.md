---
name: parktru-architecture
description: Use when working on ParkTru app architecture, feature structure, Next.js App Router pages, ElysiaJS routes, Eden client usage, TanStack Query, Better Auth, MongoDB, or local-first persistence with idb-keyval and Eden-backed sync. This skill keeps changes aligned with the repo's feature-first MVC direction and prevents invented abstractions.
---

# ParkTru Architecture

Use this skill for any task that touches app structure, data flow, server routes, caching, auth, MongoDB, or sync.

## Read Before Coding

Inspect these files first:

- `AGENTS.md`
- `package.json`
- `src/server/index.ts`
- `src/server/eden.ts`
- `src/server/mongodb.ts`
- `src/server/better-auth/config.ts`
- `src/server/better-auth/server.ts`
- `src/server/better-auth/client.ts`
- `src/app/providers.tsx`
- `src/app/api/[[...slugs]]/route.ts`

## What Exists Today

- Next.js App Router is the web shell.
- Elysia is mounted behind the Next catch-all API route.
- Eden is the typed internal API client.
- TanStack Query is already available in the app provider.
- Better Auth is already configured.
- MongoDB is already connected through a shared helper.
- Serwist handles offline document fallback.
- `idb-keyval` is the planned client store for durable local-first data (see `AGENTS.md` and `docs/trd.md`).

## What Does Not Exist Yet

Explicit feature-level sync modules (outbox, retries, key layout) that wrap `idb-keyval` and call Eden—those are to be added per feature, not invented as placeholders.

Rules:

- Never fabricate `idb-keyval` APIs beyond the installed package.
- Do not add `zero` / `@rocicorp/zero` unless the project explicitly adopts them later.
- If a task needs local persistence, add thin wrappers under `src/features/<feature>/sync/` and real types—no fake sync layers.

## Default Placement

For new feature work, prefer this structure:

```text
src/features/<feature>/
  controllers/
  models/
  views/
  sync/
  lib/
  index.ts
```

Use the folders like this:

- `controllers/`: use-case orchestration, auth-aware flows, query/mutation wrappers, route handlers
- `models/`: schemas, types, repositories, DB mapping
- `views/`: React components and page-level UI composition
- `sync/`: `idb-keyval` stores, outbox, and Eden flush/reconciliation (no JSX)
- `lib/`: feature-local constants and helpers

## Decision Rules

### When editing `src/app`

Keep route files thin. A page/layout/route file should mostly:

- parse route params
- call a feature entrypoint
- render a feature view
- wire metadata when needed

Do not bury feature logic in route files.

### When editing `src/server`

Keep `src/server` focused on transport and infrastructure.

- `src/server/index.ts` should compose or mount feature controllers.
- Avoid business rules in the root Elysia setup.
- Reuse the shared MongoDB and Better Auth modules.

### When making internal API calls

- Use `src/server/eden.ts`.
- Do not use raw `fetch("/api/...")`.
- Let Elysia and Eden infer request/response types.

### When using TanStack Query

Use it for:

- server-backed client caching
- async mutations
- cache invalidation
- data that is not locally canonical in `idb-keyval`

Do not spread query keys across random files. Keep them inside the owning feature.

### When using `idb-keyval`

Use it for:

- durable local-first reads/writes for operational entities
- offline-tolerant flows that later reconcile via Eden

Keep ownership clear:

- `idb-keyval` holds the local canonical copy for entities you designate as local-first.
- TanStack Query holds server-backed cache and one-off workflows that do not need that contract.

Do not mirror the same entity in both without an explicit boundary documented in the feature.

## Reuse Workflow

Before adding any new module:

1. Search for an existing schema, hook, helper, or Eden call with `rg`.
2. Reuse the existing auth and DB helpers.
3. Extend the feature entrypoint if the logic belongs to the same domain.
4. Only extract a shared utility after the second real reuse case.

## Coding Style

- Favor small, obvious functions.
- Prefer inference over duplicate types.
- Avoid `any` unless the boundary forces it.
- Keep names domain-specific and explicit.
- Prefer one canonical helper per concern.
- Choose readability over over-abstraction.

## Validation

After changes, run what applies:

- `bun run check`
- `bun run typecheck`

If a change touches runtime behavior, verify the actual entrypoint or state what was not tested.
