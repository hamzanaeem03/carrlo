import { describe, expect, it } from "vitest";
import { canTransitionBooking } from "@/lib/bookings";
import { intervalsOverlap } from "@/lib/dates";
import { calculateRentalTotal, summarizeLedger } from "@/lib/money";
import { hasPermission } from "@/lib/permissions";

describe("booking interval rules", () => {
  it("uses half-open intervals so exact handoffs do not conflict", () => {
    const firstStart = new Date("2026-10-01T10:00:00.000Z");
    const firstEnd = new Date("2026-10-02T10:00:00.000Z");
    const nextStart = new Date("2026-10-02T10:00:00.000Z");
    const nextEnd = new Date("2026-10-03T10:00:00.000Z");

    expect(intervalsOverlap(firstStart, firstEnd, nextStart, nextEnd)).toBe(false);
  });

  it("detects overlapping reservations", () => {
    expect(
      intervalsOverlap(
        new Date("2026-10-01T10:00:00.000Z"),
        new Date("2026-10-03T10:00:00.000Z"),
        new Date("2026-10-02T10:00:00.000Z"),
        new Date("2026-10-04T10:00:00.000Z"),
      ),
    ).toBe(true);
  });
});

describe("pricing", () => {
  it("calculates rental totals in integer minor units", () => {
    const total = calculateRentalTotal({
      startsAt: new Date("2026-10-01T10:00:00.000Z"),
      endsAt: new Date("2026-10-03T10:00:00.000Z"),
      dailyRateMinor: 6500,
      discountMinor: 500,
      taxMinor: 250,
    });

    expect(total).toEqual({
      days: 2,
      chargesMinor: 13000,
      totalMinor: 12750,
    });
  });

  it("keeps charges, payments, refunds, and deposits financially distinct", () => {
    expect(
      summarizeLedger([
        { kind: "CHARGE", amountMinor: 20_000 },
        { kind: "ADJUSTMENT", amountMinor: -2_000 },
        { kind: "PAYMENT", amountMinor: 10_000 },
        { kind: "REFUND", amountMinor: 1_000 },
        { kind: "DEPOSIT_HELD", amountMinor: 5_000 },
        { kind: "DEPOSIT_RELEASED", amountMinor: 2_000 },
      ]),
    ).toEqual({
      owedMinor: 18_000,
      paidMinor: 10_000,
      refundedMinor: 1_000,
      depositHeldMinor: 3_000,
      balanceMinor: 9_000,
    });
  });
});

describe("booking lifecycle", () => {
  it("allows the pilot workflow from request through return", () => {
    expect(canTransitionBooking("REQUESTED", "CONFIRMED")).toBe(true);
    expect(canTransitionBooking("CONFIRMED", "ACTIVE")).toBe(true);
    expect(canTransitionBooking("ACTIVE", "COMPLETED")).toBe(true);
  });

  it("blocks unsafe terminal and pickup transitions", () => {
    expect(canTransitionBooking("REQUESTED", "ACTIVE")).toBe(false);
    expect(canTransitionBooking("COMPLETED", "ACTIVE")).toBe(false);
    expect(canTransitionBooking("CANCELLED", "CONFIRMED")).toBe(false);
  });
});

describe("permissions", () => {
  it("allows finance to manage payments but not vehicles", () => {
    expect(hasPermission("FINANCE", "payments:manage")).toBe(true);
    expect(hasPermission("FINANCE", "vehicles:manage")).toBe(false);
  });

  it("allows owners to manage settings", () => {
    expect(hasPermission("OWNER", "settings:manage")).toBe(true);
  });
});
