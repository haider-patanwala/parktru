# ParkTru PRD

## Product Name

ParkTru

## Product Summary

ParkTru is a secure multi-tenant parking management system used by parking operators and admins to manage vehicle entry and exit across one or more parking lots. The application must work as both a web app and a PWA, support offline-first operations, and provide a fast operator workflow for vehicle check-in, vehicle check-out, receipt generation, and operational analytics.

The core job of the product is to reduce parking-lot processing time at the gate while keeping records accurate, secure, auditable, and simple enough for high-throughput daily use.

## Problem Statement

Parking-lot staff often work in noisy, time-sensitive environments with inconsistent network coverage and high transaction volume. Existing workflows are commonly:

- manual and slow
- dependent on stable internet
- weak on auditability
- hard to use across multiple lots and operators
- poor at linking entries, exits, receipts, and reporting

This creates queueing, revenue leakage, poor operator experience, and limited visibility for business admins.

## Vision

Build a simple and reliable parking operations system that lets staff process cars in seconds, works offline when needed, enforces tenant and lot boundaries, and gives admins clear visibility into usage, revenue, occupancy, and operator activity.

## Product Goals

- Minimize time to check in and check out a vehicle.
- Support real-world parking operations with unstable connectivity.
- Enforce strict multi-tenant isolation across organizations and parking lots.
- Prevent misuse by restricting actions to approved geo-fenced parking lots.
- Maintain accurate parking session, customer, and receipt records.
- Provide clear dashboards and analytics without increasing cognitive load.
- Keep the operator experience simple enough for repeated daily use.

## Non-Goals

- Consumer self-service parking discovery marketplace.
- Complex valet logistics in v1.
- Hardware gate control integration in v1.
- Automated payment gateway integration in v1 unless explicitly added later.
- Public customer-facing portal beyond receipt delivery.

## Primary Users

### Platform Super Admin

- manages tenants or organizations
- configures global settings
- audits security and tenant health

### Tenant Admin

- manages one organization
- configures parking lots, rates, geo-fences, operators, and receipt settings
- views dashboards, activity, and analytics

### Parking Lot Operator / Gate Admin

- performs vehicle entry and exit
- scans number plates or enters them manually
- collects or confirms customer details
- issues receipts

### Finance / Operations Viewer

- views reports, receipts, occupancy, and revenue trends
- limited operational access

## Core Use Cases

- check in a vehicle at a parking lot gate
- check out a vehicle and close the parking session
- search active or historical parking sessions
- capture or update customer details
- generate and reprint parking receipts
- operate while offline and sync later
- restrict use to authorized parking lot geography
- view dashboards and analytics
- audit operator activity and exceptions

## Key User Flow

### Vehicle Entry

1. Operator opens the entry screen on web or PWA.
2. App verifies the operator belongs to the tenant and is authorized for the selected parking lot.
3. App verifies the device is within the lot’s geo-fence or follows configured fallback rules.
4. Operator scans the number plate using video camera OCR, or enters the plate manually.
5. System searches local-first synced data first for an existing vehicle or customer match.
6. If a matching active parking session exists, the app shows a warning and suggested next action.
7. If the vehicle or customer does not exist, the operator captures customer details such as name and phone number.
8. Operator confirms vehicle entry.
9. Parking session is created in the local-first store immediately and queued for sync if offline.
10. Entry acknowledgement and optional receipt/ticket is generated.

### Vehicle Exit

1. Operator scans or enters the plate number.
2. App finds the active parking session.
3. System calculates duration, charges, discounts, taxes, and outstanding amount based on tenant lot rules.
4. Operator reviews and confirms exit.
5. Session is closed and receipt is generated.
6. Exit event syncs to the server if online, or queues for background sync if offline.

## Functional Requirements

### Multi-Tenant and Access Control

- The system must support multiple tenants with strict data isolation.
- Users must only access tenants, lots, and records they are authorized for.
- Parking lots must belong to exactly one tenant.
- Users may belong to one or more lots within a tenant according to role configuration.
- All tenant-sensitive queries, mutations, analytics, and exports must be tenant scoped.

### Parking Lot Operations

- Operators must be able to mark vehicle entry and exit quickly.
- The system must support both OCR-based plate capture and manual plate entry.
- Plate lookup must work against locally available synced data first for speed.
- Operators must be able to create new customer details when no prior record exists.
- The system must prevent or clearly flag duplicate active sessions for the same vehicle.
- The system must support lot-specific pricing and session policies.

### Customer and Vehicle Data

- A customer profile should support at least name and phone number.
- A vehicle record should support plate number and optional metadata such as vehicle type.
- The system should reuse existing customer or vehicle records when confidently matched.
- Customer edits must remain auditable.

### Offline-First Operation

- Entry and exit operations must remain usable without network connectivity.
- Core lot data needed for gate operations must be available locally.
- Writes must complete locally first and sync to the server later.
- Sync conflicts must be surfaced and resolvable by rules or admin workflows.
- Operators must see sync status without being overwhelmed.

### Geo-Fencing

- Each parking lot must support a configured geo-fence.
- Entry and exit actions should be restricted to devices operating within the allowed geo-fence.
- Configurable fallback behavior must exist for inaccurate GPS, poor signal, or approved override cases.
- Geo-fence violations and overrides must be logged for audit.

### Receipts

- The system must generate a parking receipt on exit.
- Receipt must include tenant, lot, operator, vehicle, timing, amount, and receipt identifier.
- Receipt must support digital display and print-friendly rendering.
- Reprint and resend must be audit logged.

### Dashboard and Analytics

- Tenant admins need dashboards for occupancy, entries, exits, revenue, average duration, and peak times.
- Analytics should support date range, parking lot, and operator filters.
- Dashboards should prioritize clarity over density.
- Visuals should be simple, legible, and fast to understand.

### Audit and Security

- Critical actions must be auditable, including login, entry, exit, override, receipt reprint, and lot switching.
- The product must support secure authentication and role-based authorization.
- Sensitive data access must be minimized and logged where appropriate.

## UX Principles

- Optimize for speed at the gate.
- Minimize taps and cognitive load.
- Make the primary action obvious on every screen.
- Prefer large readable inputs and clear success/error feedback.
- Design for gloves, glare, movement, and partial attention.
- Dashboards must be informative without feeling crowded.
- UI should feel modern, clean, and trustworthy.

## Platform Requirements

- Must work as a responsive web application.
- Must work as an installable PWA.
- Must support offline operation for critical workflows.
- Must support camera access on supported devices for plate capture.

## Security Requirements

- Enforce authentication for all non-public actions.
- Enforce tenant scoping on every request and sync path.
- Encrypt data in transit.
- Protect sensitive secrets and admin operations.
- Record security-relevant audit events.
- Support session management, logout, and role revocation.

## Reporting and Analytics KPIs

- active vehicles in lot
- daily entries and exits
- occupancy by lot
- average parking duration
- revenue by day, lot, and operator
- repeat customers
- offline operations count
- sync failure count
- geo-fence override count

## Success Metrics

- Median entry processing time under 15 seconds.
- Median exit processing time under 20 seconds.
- Successful offline processing for critical gate operations.
- Sync success rate above 99% for queued actions.
- Reduction in duplicate or missing parking session records.
- High daily active use among assigned operators.

## Risks

- OCR quality may vary by device, lighting, and plate format.
- GPS accuracy may be weak in covered or dense parking structures.
- Offline conflicts may occur with multi-device operations.
- Receipt and pricing rules may vary significantly by tenant.
- Operator adoption will drop if the UI becomes too dense.

## Open Product Decisions

- whether payment collection is in scope for v1
- whether receipts are printable only or also shareable by SMS/WhatsApp/email
- whether geo-fence overrides require supervisor approval
- whether duplicate plate detection auto-blocks or warns
- whether a customer can have multiple active sessions across lots
- whether tenants can customize pricing rules directly
