# ParkTru TRD

## Overview

This document describes the target technical architecture for ParkTru, a secure multi-tenant parking management system with offline-first support, geo-fenced lot operations, and PWA delivery.

The design should align with the repo direction already defined in `AGENTS.md`:

- Next.js App Router for the application shell
- ElysiaJS for typed server endpoints
- Eden for end-to-end typed client calls
- TanStack Query for server-backed caching and async workflows
- MongoDB for durable storage
- Better Auth for authentication
- `idb-keyval` on the client (IndexedDB) for durable local-first data, with explicit sync to MongoDB via Eden/Elysia as the target offline architecture

## Technical Goals

- Fast gate operations under unstable network conditions
- Strict tenant and lot isolation
- Simple and maintainable feature-first architecture
- Strong type safety end to end
- Local-first writes for critical operational workflows
- Clear auditability and security boundaries

## Proposed Architecture

### Client

- Next.js App Router web app
- Installable PWA with service worker
- React UI with feature-scoped views
- Camera-based plate capture workflow
- Geo-location access for geo-fence validation
- Local-first data access through `idb-keyval` stores plus feature sync modules
- TanStack Query for server-backed async data and cache flows that are not locally canonical

### Server

- ElysiaJS API mounted through Next catch-all route
- Better Auth for auth/session handling
- Feature controllers for business orchestration
- MongoDB repositories for persistence
- Audit/event logging pipeline
- Elysia endpoints for mutations and reads that reconcile server state with client outbox/sync queues (no separate change-stream client protocol required for v1)

### Data

- MongoDB as primary server database
- `idb-keyval` keyspaces on the client for operational entities (sessions, receipts, etc.) as designed per feature
- Background sync between local client state and server state
- Event timestamps stored in UTC

## Architecture Principles

- Feature-first folder structure
- MVC inside each feature
- Thin transport layer
- One source of truth per concern
- Local-first for gate-critical workflows
- Reuse inferred types instead of duplicating contracts
- Prefer less code and clearer code over speculative abstractions

## Proposed Folder Structure

```text
src/
  app/
    (marketing)/
    (dashboard)/
    api/
    layout.tsx
    providers.tsx
  features/
    auth/
      controllers/
      models/
      views/
    parking-sessions/
      controllers/
      models/
      views/
      sync/
    vehicles/
      controllers/
      models/
      views/
      sync/
    customers/
      controllers/
      models/
      views/
      sync/
    parking-lots/
      controllers/
      models/
      views/
    receipts/
      controllers/
      models/
      views/
    analytics/
      controllers/
      models/
      views/
    geofence/
      controllers/
      models/
      lib/
  components/
    ui/
  lib/
  server/
    better-auth/
    mongodb.ts
    index.ts
    eden.ts
  styles/
```

## MVC Mapping

### Models

- MongoDB schemas
- Typebox validation schemas where needed
- repositories
- domain types
- pricing rules
- geo-fence definitions
- Typed keys and value shapes for `idb-keyval` stores, plus outbox/sync metadata for local-first entities

### Controllers

- Elysia route handlers
- business rules
- auth checks
- tenant scoping
- lot scoping
- sync orchestration
- query option factories and mutation wrappers

### Views

- Next.js pages
- React forms and flows
- dashboards
- receipt rendering
- operator action screens

## Primary Features

### 1. Authentication and Authorization

- Better Auth for sign-in/session management
- roles:
  - platform-super-admin
  - tenant-admin
  - lot-operator
  - viewer
- every request must resolve:
  - user id
  - tenant id
  - lot access set

Implementation notes:

- Keep auth primitives in `src/server/better-auth`
- Expose current-session helpers for server and client use
- Add authorization guards in feature controllers, not in view code

### 2. Multi-Tenant Data Isolation

Every tenant-owned document should include:

- `tenantId`
- `createdAt`
- `updatedAt`
- `createdBy`
- `updatedBy`

Lot-owned data should also include:

- `parkingLotId`

Isolation rules:

- never query mutable business data without tenant filters
- lot operators must be constrained to authorized lots
- analytics must aggregate only within tenant scope

## Domain Model

### Tenant

- id
- name
- status
- branding
- billing plan if needed later

### User

- id
- tenantId
- role
- allowedParkingLotIds
- auth metadata

### ParkingLot

- id
- tenantId
- name
- code
- address
- geoFence
- timezone
- pricingPolicyId
- status

### Vehicle

- id
- tenantId
- normalizedPlateNumber
- displayPlateNumber
- vehicleType
- notes

### Customer

- id
- tenantId
- name
- phone
- optional metadata

### ParkingSession

- id
- tenantId
- parkingLotId
- vehicleId
- customerId
- entryAt
- exitAt
- status
- source
- offlineCreated
- geoValidationStatus
- createdBy
- closedBy

### Receipt

- id
- tenantId
- parkingLotId
- parkingSessionId
- receiptNumber
- amountBreakdown
- issuedAt
- issuedBy
- reprintCount

### AuditEvent

- id
- tenantId
- parkingLotId optional
- actorUserId
- action
- targetType
- targetId
- metadata
- createdAt

## Entry Flow Technical Design

1. App opens operator entry screen.
2. Client obtains current lot context and session.
3. Client requests camera or manual plate input.
4. OCR pipeline extracts possible plate candidates.
5. Client normalizes plate format.
6. Client checks local `idb-keyval` data first for:
   - active session
   - known vehicle
   - known customer linkage
7. If no record exists, operator fills customer details.
8. Client writes new or updated entities to local store first.
9. Sync layer pushes changes to the server when possible.
10. Server validates tenant, lot, geo policy, duplication rules, and persists canonical state.

## Exit Flow Technical Design

1. Operator scans or enters plate.
2. Client resolves active session locally.
3. Client requests pricing calculation or uses synced pricing rules depending on architecture choice.
4. Operator confirms exit.
5. Session and receipt records are written locally first.
6. Sync propagates changes to server.
7. Server validates closure, calculates final canonical totals, and stores receipt record.

## Offline-First Strategy

### Target Approach

Use `idb-keyval` as the durable local-first store for operational entities (namespaced keys per feature):

- vehicles
- customers
- parking sessions
- receipts
- parking-lot configuration needed for operation

Use TanStack Query for:

- auth/session reads
- analytics and aggregated reports
- non-sync administrative workflows
- background fetches where the server is the source of truth and local persistence is not required

### Local-First Rules

- gate-critical writes should succeed locally even without network
- sync state should be visible but lightweight
- local IDs may be temporary until canonical IDs are confirmed if needed
- server reconciliation must be deterministic

### Conflict Handling

Potential conflicts:

- duplicate active sessions across devices
- simultaneous exit updates
- customer detail edits from multiple devices
- stale pricing rules

Recommended approach:

- prefer idempotent commands where possible
- maintain mutation/event timestamps
- use explicit conflict states for records requiring manual review
- keep an admin review queue for unresolved sync conflicts

## Client persistence and sync plan (`idb-keyval`)

Local-first storage uses **`idb-keyval`** (IndexedDB). Sync is **explicit**: features read/write keys locally, enqueue or flush changes, and call **Eden → Elysia** to reconcile with MongoDB—there is no separate realtime sync product in scope for v1.

When implementing:

1. Depend on `idb-keyval` from `package.json` and wrap it in thin feature modules under `src/features/<feature>/sync/` (for example `<feature>.idb.ts` for stores, `<feature>.sync.ts` for outbox/retry).
2. Define which entities are **idb-keyval–canonical** on the client vs **TanStack Query–only** server cache.
3. Design idempotent server commands where possible so retries after offline periods are safe.
4. Follow the real `idb-keyval` API; do not invent storage APIs.

Recommended initial idb-keyval–backed entities:

- parking sessions
- vehicles
- customers
- receipts

Recommended Query-only (no local canonical store) at first:

- analytics aggregates
- admin dashboards
- audit search views

## Geo-Fencing Design

### ParkingLot GeoFence Model

- center latitude/longitude plus radius for v1
- optional polygon support later
- allowed accuracy threshold
- override policy

### Enforcement

Entry and exit attempts should include:

- device coordinates
- accuracy
- timestamp
- parkingLotId

Server and/or sync validator should evaluate:

- inside geo-fence
- outside geo-fence
- unknown due to missing location
- bypassed with override

All overrides must be audit logged.

## Receipt Generation Design

Receipt types:

- on-screen confirmation receipt
- print-friendly receipt view
- reprintable receipt history

Receipt content:

- tenant and lot identity
- receipt number
- plate number
- customer name/phone if available
- entry time
- exit time
- duration
- pricing and taxes
- operator identity

Implementation direction:

- render receipt from canonical session + pricing data
- keep printable HTML/CSS simple
- support PWA-friendly print flow

## Analytics Design

Analytics should be server-calculated or materialized rather than computed entirely on-device for large data ranges.

Core dashboards:

- live occupancy
- entries and exits by period
- revenue trend
- average duration
- lot comparison
- operator activity
- offline and sync health

Technical approach:

- use TanStack Query for analytics fetches
- build analytics endpoints under feature controllers
- consider pre-aggregation for large tenants

## Security Design

### Authentication

- Better Auth sessions
- secure cookie/session handling
- logout and session invalidation support

### Authorization

- role-based access control
- tenant-aware guards
- lot-aware guards
- action-level permissions for overrides, reprints, and admin reports

### Data Protection

- HTTPS only in production
- validated request payloads
- server-side tenant enforcement
- no trust in client-supplied tenant or role context without verification

### Audit Logging

Log at minimum:

- sign in and sign out
- failed auth attempts
- vehicle entry and exit
- duplicate-session warnings
- geo-fence override
- receipt reprint
- manual data corrections
- sync conflict resolution

## API Design Direction

Use Elysia feature controllers mounted into the main API.

Illustrative endpoint groups:

- `/api/auth/*`
- `/api/parking-sessions/*`
- `/api/vehicles/*`
- `/api/customers/*`
- `/api/parking-lots/*`
- `/api/receipts/*`
- `/api/analytics/*`
- `/api/audit/*`

Client access rules:

- use Eden for all internal typed API calls
- do not use raw `fetch` for internal business endpoints

## Caching Strategy

### `idb-keyval`

- durable store for local-first operational entities on the client

### TanStack Query

- server-backed cache for remote aggregates and workflows that do not use local canonical persistence

### Service Worker

- shell assets
- static resources
- offline route fallback

## Observability

Track:

- API latency
- sync queue length
- sync failures
- OCR success/failure rate
- geo-fence failures
- duplicate active session attempts
- entry and exit completion time

## Performance Targets

- first usable operator screen under 3 seconds on typical mobile network
- plate lookup response near-instant from local store
- offline writes under 1 second for normal entry/exit flow
- dashboards usable within 2 seconds for common date ranges

## Testing Strategy

### Unit

- pricing calculation
- geo-fence evaluation
- plate normalization
- authorization guards
- conflict resolution rules

### Integration

- Elysia controllers with auth and tenant scoping
- MongoDB repositories
- receipt generation
- sync validation

### End-to-End

- sign in
- vehicle entry
- vehicle exit
- offline entry then online sync
- geo-fence allowed vs blocked flows
- receipt reprint

## Rollout Plan

### Phase 1

- auth
- tenant and lot management basics
- manual vehicle entry and exit
- receipt generation
- basic dashboards

### Phase 2

- PWA hardening
- `idb-keyval` local-first integration and sync/outbox
- offline sync conflict handling
- geo-fence enforcement

### Phase 3

- OCR plate capture
- advanced analytics
- operator productivity and anomaly reporting

## Open Technical Decisions

- exact `idb-keyval` key layout and migration strategy per feature
- conflict resolution UX for multi-device edits
- OCR provider or in-browser model choice
- whether pricing calculation is fully server-authoritative or partially synced
- whether receipts need PDF export
- whether location enforcement happens client-side only, server-side only, or both
