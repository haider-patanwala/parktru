# Operator Gate Flow Design

Date: 2026-04-01
Status: Draft approved for planning
Scope: First implementation slice for ParkTru operator operations

## Summary

This design defines the first vertical slice of ParkTru as a real authenticated, tenant-aware operator workflow for parking lot entry and exit. The slice prioritizes speed at the gate, low cognitive load, and clean feature boundaries over broad product coverage.

The first slice includes:

- unified operator entry and exit screen
- explicit parking lot switching for authorized lots
- plate-first lookup workflow
- compact active and recent session list
- duplicate active-session warning
- entry-time correction by any operator with audit visibility
- required customer phone capture
- lot-level base rate setup by operators
- manual exit amount override
- receipt preview after exit
- receipt skip or share-link handoff

The first slice intentionally excludes:

- OCR implementation
- Zero and local-first offline sync
- admin configuration console
- analytics dashboards
- messaging provider integrations

## Product Decisions Captured

- Build the operator gate flow first.
- Use one unified screen for both entry and exit.
- OCR is visible only as a placeholder marked coming soon.
- If a plate already has an active session, warn and suggest exit.
- Any operator can edit entry timing for an active session.
- Operators may switch between authorized lots.
- Receipts are optional after exit: operator may skip or share.
- The app should show receipt preview before share.
- Sharing is done through an auto-generated receipt link, not a direct WhatsApp integration.
- Operators set lot pricing rates for different lots in this phase.
- Operators may manually override the exit price.
- Plate search should be supported by a compact active and recent session list.
- Customer phone number is required at entry.
- Authentication and tenant and lot aware context are required from day one.

## Goals

- Let operators process vehicle entry and exit from a single workspace.
- Keep the primary operator action obvious within a few seconds.
- Preserve strict tenant and lot boundaries from the first implementation.
- Keep transport and route files thin and push feature logic into a feature module.
- Shape the first slice so Zero-based sync can be added later without rewriting the UI.

## Non-Goals

- Full offline-first local write support in this phase
- OCR plate capture in this phase
- Tenant-admin setup flows in this phase
- Analytics and reporting in this phase
- Automated WhatsApp or messaging delivery in this phase

## Architecture

The implementation should use the existing repo stack:

- Next.js App Router for the application shell
- Better Auth for authenticated user context
- Elysia mounted under the existing catch-all API route
- Eden for client-side typed API calls
- TanStack Query for server-backed query and mutation flows
- MongoDB via the existing shared connection helper

Zero is target architecture but is not installed and must not be approximated in live code. The first slice remains server-backed and should leave clean seams for future sync work.

### Feature Placement

New work should center on a new feature module at this path:

```text
src/
  app/
    (app)/
      operator/
        page.tsx
  features/
    operator-operations/
      controllers/
        operator-operations.controller.ts
        operator-operations.queries.ts
        operator-operations.mutations.ts
      models/
        parking-session.schema.ts
        parking-session.repository.ts
        parking-session.types.ts
        parking-lot-rate.schema.ts
        parking-lot-rate.repository.ts
        receipt.types.ts
      views/
        operator-operations-page.tsx
        plate-lookup-panel.tsx
        session-sidebar.tsx
        duplicate-session-alert.tsx
        receipt-preview-dialog.tsx
      lib/
        operator-operations.constants.ts
        operator-operations.helpers.ts
      index.ts
```

Implementation can split or merge small files if needed, but these boundaries should stay:

- `src/app/**` stays thin and composes the feature page.
- `src/server/**` remains transport and infrastructure only.
- feature controllers own orchestration and auth-aware logic.
- feature models own persistence and domain representation.
- feature views own the unified operator UI.

## UI and Interaction Design

The operator experience should be a single screen with two clear areas:

- a primary action rail for plate-first work
- a context and recovery rail for recent and active sessions, selected lot info, and receipt actions

### Header

The header should contain:

- active parking lot switcher
- network and sync status indicator
- operator identity
- minimal session context

The lot switcher must only display authorized lots. Switching lots must update the visible session list, current lot pricing rate, and all create and close actions.

### Primary Action Rail

The main workflow starts with plate lookup every time. The top of the rail should include:

- plate input
- primary lookup action
- disabled OCR control labeled coming soon

After lookup, the panel can move into one of three states:

1. Create entry
2. Close exit
3. Resolve duplicate active session

The primary submit button should change label and purpose based on the current state rather than sending operators to separate screens.

### Entry Flow

If there is no active session for the plate, the screen should support creating a new entry with:

- required customer phone number
- customer name
- vehicle plate information
- optional vehicle metadata
- selected lot context

The form should prefer reuse of any matched vehicle or customer information but still allow fresh entry when needed.

### Duplicate Session Flow

If the plate already has an active session, the UI must show an inline warning state instead of redirecting away. That warning should show:

- matched session context
- matched lot
- original entry time
- clear suggested next action

The available actions are:

- switch intent to exit
- edit entry time
- return to review

Editing entry time is allowed for any operator in the active lot workflow and must be audit logged.

### Exit Flow

If the operator is closing an active session, the exit panel should show:

- session duration
- current lot base rate
- default amount prefilled from the current lot base rate
- manual override amount field

The operator may change the exit amount before closing the session.

### Receipt Flow

After a successful exit, the operator should see a receipt preview before deciding what to do next. Available actions:

- skip receipt
- share receipt link

The share flow should generate a receipt link and hand it off through the native app or browser share action when available. If native sharing is unavailable on the device, the UI should fall back to a copyable receipt link action. This is not a direct WhatsApp integration and should not depend on external messaging services in this phase.

### Secondary Rail

The secondary rail should provide quick recovery context without crowding the main rail:

- selected lot summary
- current lot base rate
- compact active sessions list
- compact recent sessions list
- receipt action context when relevant

This rail is intentionally operational, not dashboard-like.

## Data Model

This slice needs only the domain entities necessary to support the operator workflow.

### Operator Lot Access

Derived from authenticated context:

- user id
- tenant id
- role
- allowed parking lot ids
- current selected parking lot id

This should be resolved from Better Auth backed user context and authorization logic, not invented on the client.

### Parking Session

Required fields for the first slice:

- id
- tenantId
- parkingLotId
- normalizedPlateNumber
- displayPlateNumber
- customerName
- customerPhone
- vehicleType optional
- entryAt
- exitAt optional
- status
- baseRateSnapshot
- overrideAmount optional
- finalAmount optional
- receiptId optional
- createdBy
- updatedBy
- createdAt
- updatedAt

### Parking Lot Rate

Lightweight lot pricing for this phase:

- id
- tenantId
- parkingLotId
- baseRate
- updatedBy
- updatedAt

This is intentionally simple and does not attempt to solve future tenant-admin pricing complexity.

### Receipt

Minimal receipt representation:

- id
- tenantId
- parkingLotId
- parkingSessionId
- receiptNumber
- generatedAt
- sharePath or shareToken
- createdBy

## Controller Responsibilities

Feature controllers should own:

- operator context resolution
- lot access checks
- plate lookup orchestration
- duplicate session detection
- entry creation
- exit closing
- entry-time correction
- lot-rate read and update
- receipt link generation
- audit event emission

Transport stays thin in the Elysia root setup. Business logic should not remain in `src/server/index.ts`.

## API Boundaries

The client should use Eden for all internal calls. Avoid raw internal `fetch`.

Expected first-slice API capabilities:

- `getOperatorContext`
- `switchLot`
- `findSessionByPlate`
- `listActiveAndRecentSessions`
- `createEntry`
- `closeExit`
- `updateEntryTime`
- `getLotRate`
- `setLotRate`
- `generateReceiptLink`

These capabilities must exist even if the final endpoint names are grouped slightly differently in the feature router.

## Auth and Access Control

Real auth is required from day one.

Rules:

- every operator action resolves tenant context from the authenticated session
- operators can only switch into authorized lots
- entry, exit, pricing, and correction actions must be lot scoped
- unauthorized lot access must block actions and reset visible context

Any operator may edit entry time in this slice, but the action must be audit visible.

## Error Handling

### Plate Lookup

- If lookup fails, keep the operator on the same screen.
- Allow fallback to manual entry creation.
- Do not lose the typed plate.

### Duplicate Active Session

- Show inline warning state.
- Do not navigate away.
- Keep resolution actions on the same screen.

### Lot Rate Update

- If lot rate update fails, preserve the previous saved value.
- Show a direct inline error near the edited control.

### Entry-Time Correction

- If correction fails, keep the original visible value and show the failure inline.
- Do not silently mutate the display.

### Receipt Link Generation

- If receipt link generation fails after exit, keep the exit closed.
- Allow receipt action retry without reopening the session.

### Unauthorized Lot Context

- If the selected lot is no longer allowed, block actions and force visible reset to a valid lot.

## Offline Stance For This Phase

This phase should not fake offline-first support. Because Zero is not installed, the operator flow remains server-backed.

Allowed in this phase:

- visible network state
- visible sync or connectivity state messaging
- clean seams for later local-first replacement

Not allowed in this phase:

- invented Zero APIs
- fake local queueing sold as real offline support
- duplicated temporary sync abstractions that will be thrown away immediately

## Audit Requirements

The following actions should emit audit-visible events in this slice:

- entry creation
- exit close
- lot switch
- entry-time correction
- lot-rate update
- receipt link generation

The audit implementation can begin minimally, but the design assumes these actions are traceable.

## Testing and Verification

Required repo checks:

- `bun run check`
- `bun run typecheck`

Required manual verification for the first slice:

- operator can access the screen only when authenticated
- operator sees only authorized lots in the switcher
- lot switching updates visible context
- plate lookup supports entry creation path
- duplicate active session warning appears correctly
- operator can edit entry time
- operator can close exit with base rate and manual override
- operator sees receipt preview
- operator can skip receipt
- operator can generate and share receipt link
- unauthorized lot context is blocked

## Delivery Notes

The first implementation should favor one usable end-to-end operator seam over broad coverage. The goal is not to approximate the final ParkTru platform in one pass. The goal is to establish the real product heartbeat with clean feature boundaries so later admin, analytics, OCR, and sync work can build on it without major rewrites.
