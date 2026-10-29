import { describe, it } from "vitest";

describe.skip("booking concurrency", () => {
  it("rejects simultaneous confirmed bookings for the same vehicle", async () => {
    // Requires TEST_DATABASE_URL and migrated PostgreSQL.
    // The service strategy locks the Vehicle row with SELECT ... FOR UPDATE
    // before checking overlapping confirmed/active bookings.
  });
});
