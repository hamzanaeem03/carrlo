# Carrlo Implementation Status

Last updated: October 29, 2026

## Implemented

- Next.js App Router SaaS shell using the existing MUI/Tailwind foundation.
- Incremental TypeScript configuration, linting, unit tests, production build, Prisma scripts, and seed workflow.
- PostgreSQL/Prisma schema and initial migration for organizations, memberships, branches, vehicles, customers, bookings, inspections, maintenance, damage, files, financial transactions, and audit logs.
- Auth.js credentials authentication with bcrypt password verification, JWT sessions, protected dashboard routes, and basic login rate limiting.
- Organization-scoped tenant context, server-side RBAC checks, and organization-filtered services.
- Railway PostgreSQL development connection verified through an SSH tunnel; migrations are current and development seed data was applied.
- Vehicle and customer management backed by PostgreSQL.
- Booking request workflow with pricing snapshots and status history.
- Confirmation protected by a PostgreSQL vehicle row lock and overlap/maintenance checks.
- Vehicle reassignment and booking extension protected by the same lock and conflict checks.
- Cancellation/rejection, pickup inspection, return inspection, odometer validation, vehicle status updates, and audit events.
- Financially distinct charge, adjustment, payment, refund, deposit-held, and deposit-released ledger entries.
- Payment and deposit operations with server-side limits for refundable payments, required deposits, and held-deposit releases.
- Real dashboard, booking, and payment summaries calculated from persisted data.
- User-visible success/error messages for booking and financial server actions.
- Unit coverage for interval behavior, pricing, ledger calculations, booking transitions, and RBAC.

## Verification Results

- `npm run db:deploy`: passed through the Railway SSH tunnel; no pending migrations.
- `npm run db:seed`: passed; demo owner, organization, branch, vehicle, and customer exist.
- Seeded login verification: password hash and active OWNER membership passed.
- Authenticated live checks: `/dashboard`, `/dashboard/bookings`, and `/dashboard/payments` returned HTTP 200 against Railway PostgreSQL.
- `npm run typecheck`: passed.
- `npm run lint`: passed with no warnings or errors.
- `npm run test`: passed, 8 unit tests; 1 PostgreSQL integration suite remains skipped.
- `npm run build`: passed after clearing a stale `.next` cache entry.

Non-blocking warnings:

- Vitest reports that its TypeScript config uses ESM syntax through the current config loader.
- Next.js reports an outdated Browserslist dataset.
- The Prisma seed configuration in `package.json` is deprecated for Prisma 7 and should move to `prisma.config.ts` before upgrading.

## Running Development

The Railway public TCP proxy is not reachable from the current local network. Local development currently uses a Railway CLI SSH tunnel:

```powershell
railway.cmd connect Postgres --tunnel-only --port 55432
```

The local Prisma URL must point to `127.0.0.1:55432` and include `sslmode=disable`; the SSH tunnel already encrypts the connection. Never commit the real URL or password.

The verified development instance is running at `http://localhost:3002`. Port 3001 was occupied by an older process using the unreachable public database URL.

## Remaining Pilot Work

- Add maintenance creation, start, completion, cancellation, cost tracking, and vehicle availability updates.
- Add damage records linked to return inspections and an explicit post-return vehicle disposition.
- Add private document byte storage and authorized download routes; only file metadata is currently modeled.
- Add a separate migrated `TEST_DATABASE_URL` and enable true integration tests for tenant isolation and concurrent booking conflicts.
- Add Playwright E2E coverage for login, vehicle/customer creation, booking request, confirmation/conflict rejection, pickup, payment, return, and dashboard updates.
- Add account recovery, email verification, staff invitations, and persistent/distributed login rate limiting before production launch.
- Add operator validation findings and pilot feedback; customer interviews cannot be completed from code alone.

## Exact Next Steps

1. Implement maintenance blocks and their booking-conflict workflow.
2. Implement return damage capture and vehicle disposition.
3. Provision an isolated test database and activate concurrency/tenant integration tests.
4. Add the critical Playwright pilot workflow.
5. Implement authorized private document storage.
6. Run the complete verification suite again and begin pilot onboarding.
