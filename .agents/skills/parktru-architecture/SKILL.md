---
name: parktru-architecture
description: Use when working on ParkTru app architecture, feature structure, Next.js App Router pages, ElysiaJS routes, Eden client usage, TanStack Query, Better Auth, MongoDB, or planned Zero offline-sync integration. This skill keeps changes aligned with the repo's feature-first MVC direction and prevents invented abstractions.
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

## What Does Not Exist Yet

Zero and `zero-sources` are planned architecture, not live dependencies in this repo right now.

Rules:

- Never fabricate Zero package names, imports, or APIs.
- If a task truly needs Zero, add the real dependency first.
- If Zero is not part of the task, do not add placeholder sync layers "for later".

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
- `sync/`: Zero/local-first sync code once Zero exists
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
- data that is not owned by a local-first sync engine

Do not spread query keys across random files. Keep them inside the owning feature.

### When Zero is eventually added

Use Zero for:

- offline-first synced collections
- optimistic local writes that later sync to the server
- domain data that benefits from local-first reads

Keep ownership clear:

- Zero owns synced local-first entities.
- TanStack Query owns non-sync server cache and one-off workflows.

Do not make both tools own the same data model without an explicit reason.

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
