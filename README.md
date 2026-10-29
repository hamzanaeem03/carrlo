# Carrlo

Carrlo is a pilot-first vehicle rental and fleet management SaaS. This repository is being built as a modular Next.js application with real persistence, authentication, tenant isolation, booking conflict rules, financial records, and operational reporting.

## Current Modules

- Auth.js credentials sign-in.
- Organization, membership, branch, vehicle, customer, booking, payment, maintenance, inspection, damage, file metadata, and audit-log schema.
- Dashboard metrics from persisted data.
- Vehicle inventory, customer registration, confirmed bookings, pickup, return, and manual payment recording.
- Unit tests for core business rules.

## Stack

- Next.js App Router
- React
- TypeScript, incrementally adopted
- Material UI plus Tailwind CSS
- PostgreSQL
- Prisma
- Auth.js credentials auth
- Zod
- Vitest

## Environment

Copy `.env.example` to `.env` and configure:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/carrlo_dev?schema=public"
TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/carrlo_test?schema=public"
AUTH_SECRET="replace-with-a-long-random-secret"
AUTH_URL="http://localhost:3000"
```

Use a development database only. Do not point seeds or tests at production data.

## Local Setup

```bash
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Seed credentials:

```text
owner@carrlo.test
CarrloDemo123!
```

## Checks

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

`npm run test:e2e` is reserved for Playwright once browser workflows are fully scripted.

## Important Rules

- Money is stored as integer minor units with explicit currency.
- Booking intervals are half-open: `[startsAt, endsAt)`.
- Confirmed and active bookings block vehicle availability.
- Scheduled and in-progress maintenance blocks vehicle availability.
- Booking creation locks the vehicle row inside a transaction before conflict checks.
- Tenant isolation and RBAC checks must happen on the server.
- Private file support is modeled but production object storage is not yet configured.

## Current Limitations

This is not yet pilot-complete. See `docs/IMPLEMENTATION_STATUS.md` for exact status, blocked checks, and next steps.
