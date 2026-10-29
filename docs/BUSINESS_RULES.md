# Carrlo Business Rules

- Store all authoritative monetary values as integer minor units.
- Charges are amounts owed, payments are money received, refunds are money returned, deposits are held funds, and receipts/invoices represent financial documents.
- Store instants in UTC. Display and report using the configured organization or branch timezone.
- Booking intervals are half-open. A booking ending exactly when another begins does not conflict by default.
- Confirmed and active bookings block availability. Cancelled and rejected bookings do not.
- Scheduled and in-progress maintenance blocks availability.
- Booking creation, confirmation, reassignment, and extension must lock the relevant vehicle row before conflict checks.
- Organization-owned reads and writes must verify active membership and permission server-side.
