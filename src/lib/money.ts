export function formatMoney(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
  }).format(amountMinor / 100);
}

export function calculateRentalTotal(input: {
  startsAt: Date;
  endsAt: Date;
  dailyRateMinor: number;
  discountMinor?: number;
  taxMinor?: number;
}) {
  if (input.endsAt <= input.startsAt) {
    throw new Error("Booking end must be after start.");
  }

  const durationMs = input.endsAt.getTime() - input.startsAt.getTime();
  const days = Math.max(1, Math.ceil(durationMs / (24 * 60 * 60 * 1000)));
  const chargesMinor = days * input.dailyRateMinor;
  const discountMinor = input.discountMinor ?? 0;
  const taxMinor = input.taxMinor ?? 0;

  return {
    days,
    chargesMinor,
    totalMinor: chargesMinor - discountMinor + taxMinor,
  };
}

type LedgerEntry = {
  kind:
    | "CHARGE"
    | "PAYMENT"
    | "REFUND"
    | "DEPOSIT_HELD"
    | "DEPOSIT_RELEASED"
    | "ADJUSTMENT";
  amountMinor: number;
};

export function summarizeLedger(entries: LedgerEntry[]) {
  const totals = entries.reduce(
    (summary, entry) => {
      if (entry.kind === "CHARGE" || entry.kind === "ADJUSTMENT") {
        summary.owedMinor += entry.amountMinor;
      } else if (entry.kind === "PAYMENT") {
        summary.paidMinor += entry.amountMinor;
      } else if (entry.kind === "REFUND") {
        summary.refundedMinor += entry.amountMinor;
      } else if (entry.kind === "DEPOSIT_HELD") {
        summary.depositHeldMinor += entry.amountMinor;
      } else if (entry.kind === "DEPOSIT_RELEASED") {
        summary.depositHeldMinor -= entry.amountMinor;
      }
      return summary;
    },
    {
      owedMinor: 0,
      paidMinor: 0,
      refundedMinor: 0,
      depositHeldMinor: 0,
    },
  );

  return {
    ...totals,
    depositHeldMinor: Math.max(0, totals.depositHeldMinor),
    balanceMinor: totals.owedMinor - totals.paidMinor + totals.refundedMinor,
  };
}
