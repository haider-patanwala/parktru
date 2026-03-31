# ParkTru Agent Rules

This file is the single source of truth for AI agents working in this repo.

## Read First

Before making changes, inspect these files instead of assuming structure:

- `package.json`
- `tsconfig.json`
- `src/app/layout.tsx`
- `src/app/providers.tsx`
- `src/app/api/[[...slugs]]/route.ts`
- `src/server/index.ts`
- `src/server/eden.ts`
- `src/server/mongodb.ts`
- `src/server/better-auth/config.ts`

## Current Stack

- Next.js 16 App Router
- React 19
- Tailwind CSS 4
- ElysiaJS 1.4
- Eden treaty client for end-to-end typing
- TanStack Query 5 for client caching
- Better Auth
- MongoDB via Mongoose
- Serwist PWA/offline document fallback

## Important Constraint

`zero` / `@rocicorp/zero` and the MongoDB change-source setup from `cbnsndwch/zero-sources` are target architecture for this project, but they are not installed in `package.json` yet.

Rules:

- Do not invent `zero` imports, hooks, client APIs, or server adapters.
- If a task requires Zero, add the real packages and wire them intentionally.
- Until Zero is installed, use the existing stack and clearly separate planned Zero code from live code.

## Non-Negotiables

- Reuse existing modules before adding new helpers.
- Do not use raw `fetch("/api/...")` for internal app calls. Use `src/server/eden.ts`.
- Do not create a second MongoDB connection helper.
- Do not create a second auth client or session wrapper.
- Keep `src/app` route files thin.
- Keep Elysia transport thin. Business logic belongs in feature modules, not in `src/server/index.ts`.
- Prefer strict TypeScript and inference over hand-written duplicate types.
- If a dependency or abstraction does not exist in the repo, say so in code/comments/PR notes instead of faking it.

## Architecture Direction

The repo should grow into a feature-first MVC structure.

Target shape for new work:

```text
src/
  app/
    ... route entries only
  features/
    <feature>/
      controllers/
        <feature>.controller.ts
        <feature>.queries.ts
        <feature>.mutations.ts
      models/
        <feature>.schema.ts
        <feature>.types.ts
        <feature>.repository.ts
      views/
        <feature>-page.tsx
        <feature>-form.tsx
        <feature>-list.tsx
      sync/
        <feature>.zero.ts
        <feature>.sync.ts
      lib/
        <feature>.constants.ts
        <feature>.helpers.ts
      index.ts
  server/
    ... shared transport/infrastructure only
  styles/
    ... tokens and globals
```

## MVC Mapping

- Models:
  Schemas, domain types, repositories, database access, Zero collection definitions, sync metadata.
- Controllers:
  Use-case orchestration, validation handoff, auth checks, route handlers, query/mutation wrappers, invalidation logic.
- Views:
  React components, page composition, form rendering, interaction wiring.

What not to do:

- No DB calls inside `views/`.
- No JSX inside `models/`.
- No long business rules inside Next route files or Elysia root setup.

## File Placement Rules

- `src/app/**`:
  Route entrypoints, layouts, metadata, and composition only.
- `src/server/**`:
  Shared infrastructure and transport setup only.
- `src/features/<feature>/**`:
  All feature-specific logic.
- `src/components/**`:
  Only shared presentational components used by multiple features.
- `src/lib/**`:
  Only shared framework-agnostic utilities used by multiple features.

If code is only used by one feature, keep it inside that feature.

## Data Flow Rules

Preferred flow:

`View -> feature controller/query hook -> Eden client or Zero client -> Elysia route/controller -> model/repository -> MongoDB`

Specific rules:

- Define request and response contracts once in Elysia and consume them through Eden.
- Do not duplicate API request types on the client if Eden can infer them.
- Query keys and query options must live with the feature that owns the data.
- Use TanStack Query for server-backed cache and async workflows that are not local-first synced collections.
- Once Zero is added, use Zero as the source of truth for offline/shared synced entities.
- Do not cache the same entity in both TanStack Query and Zero unless there is an explicit boundary and ownership is clear.

## Offline-First Rules

When Zero is added:

- Local-first writes should update local state first and sync afterward.
- Syncable domain data should live under `src/features/<feature>/sync/`.
- Keep sync logic out of React components.
- Keep MongoDB change-source logic on the server/infrastructure side, not in view code.
- If the MongoDB change-source implementation depends on `zero-sources`, use the real package/docs and do not approximate the API.

## Reuse Rules

Before adding new code, search for:

- existing schema
- existing query key
- existing Eden call
- existing auth helper
- existing transform/helper
- existing component variant

Prefer extending an existing module over creating near-duplicate utilities.

## Server and Auth Rules

- MongoDB access must go through `src/server/mongodb.ts` or feature repositories built on top of it.
- Better Auth usage must reuse `src/server/better-auth/*`.
- Server session reads should reuse the existing server helper pattern.
- Keep auth-aware logic in controllers, not in dumb view components.

## Type Safety Rules

- Prefer inferred types from Elysia, Eden, Zod, and React Query helpers.
- Avoid `any`.
- Avoid hand-maintained request/response mirror types when inference is available.
- Co-locate schemas with the model that owns them.

## UI Direction

The default UI bar for this repo:

- modern
- clean
- calm
- low cognitive load
- readable on first scan

Rules:

- Prefer simple layouts with strong spacing and hierarchy.
- Use a restrained palette with clear contrast.
- Keep surfaces and borders subtle.
- Use motion sparingly and only when it improves comprehension.
- Prefer clear empty states, loading states, and error states over decorative complexity.
- Optimize for mobile and desktop from the start.

## Quality Bar

- Favor less code over clever code.
- Prefer composition over duplication.
- Prefer explicit names over short names.
- Keep modules small and readable.
- Extract only after a second real use case.
- Apply SOLID and DRY pragmatically, not mechanically.

## Expected Verification

After code changes, run the relevant checks when possible:

- `bun run check`
- `bun run typecheck`

If a task adds runtime behavior, also verify the touched path manually or explain what could not be verified.

## Project Skills

When relevant, load these repo-local skills:

- Architecture/data work:
  `.agents/skills/parktru-architecture/SKILL.md`
- UI/design work:
  `.agents/skills/parktru-ui/SKILL.md`
