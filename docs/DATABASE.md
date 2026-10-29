# Carrlo Database Notes

- PostgreSQL is the required production and development database.
- Prisma manages the schema, with custom SQL migration comments documenting transaction-level concurrency rules.
- The initial schema includes organizations, memberships, branches, vehicles, customers, bookings, booking status history, payment transactions, maintenance, inspections, damage records, file metadata, and audit logs.
- Prisma cannot express the row-locking booking policy in schema syntax. The booking service uses `SELECT ... FOR UPDATE` inside a transaction before checking conflicts.
- Use a separate test database through `TEST_DATABASE_URL`.
