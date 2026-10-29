import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { summarizeLedger } from "@/lib/money";
import { assertPermission } from "@/lib/permissions";
import type { TenantContext } from "@/server/context";
import { writeAuditLog } from "@/server/services/audit";

type MoneyInput = {
  bookingId: string;
  amountMinor: number;
  method?: string;
  reference?: string;
  notes?: string;
  idempotencyKey?: string;
};

function assertPositiveAmount(amountMinor: number) {
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    throw new Error("Amount must be a positive value in minor units.");
  }
}

async function bookingWithLedger(
  tx: Prisma.TransactionClient,
  context: TenantContext,
  bookingId: string,
) {
  const booking = await tx.booking.findFirst({
    where: { id: bookingId, organizationId: context.organizationId },
    include: { payments: true },
  });
  if (!booking) throw new Error("Booking was not found.");
  return { booking, ledger: summarizeLedger(booking.payments) };
}

export async function listFinancialBookings(context: TenantContext) {
  assertPermission(context.role, "payments:manage");
  return prisma.booking.findMany({
    where: { organizationId: context.organizationId },
    include: {
      customer: true,
      vehicle: true,
      payments: { orderBy: { occurredAt: "desc" } },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
}

export async function listTransactions(context: TenantContext) {
  assertPermission(context.role, "payments:manage");
  return prisma.paymentTransaction.findMany({
    where: { organizationId: context.organizationId },
    include: {
      booking: {
        include: { customer: true, vehicle: true },
      },
    },
    orderBy: { occurredAt: "desc" },
    take: 200,
  });
}

export async function recordManualPayment(
  context: TenantContext,
  input: MoneyInput,
) {
  assertPermission(context.role, "payments:manage");
  assertPositiveAmount(input.amountMinor);

  const payment = await prisma.$transaction(async (tx) => {
    const { booking } = await bookingWithLedger(
      tx,
      context,
      input.bookingId,
    );
    if (!(["CONFIRMED", "ACTIVE", "COMPLETED"] as string[]).includes(booking.status)) {
      throw new Error("Payments can only be recorded for confirmed rentals.");
    }
    return tx.paymentTransaction.create({
      data: {
        organizationId: context.organizationId,
        bookingId: booking.id,
        kind: "PAYMENT",
        amountMinor: input.amountMinor,
        currency: booking.currency,
        method: input.method,
        reference: input.reference,
        notes: input.notes,
        idempotencyKey: input.idempotencyKey,
        createdById: context.userId,
      },
    });
  });

  await writeAuditLog({
    organizationId: context.organizationId,
    actorUserId: context.userId,
    action: "PAYMENT_RECORDED",
    entityType: "PaymentTransaction",
    entityId: payment.id,
    message: "Manual payment recorded.",
  });
  return payment;
}

export async function recordRefund(
  context: TenantContext,
  input: MoneyInput,
) {
  assertPermission(context.role, "payments:manage");
  assertPositiveAmount(input.amountMinor);

  const refund = await prisma.$transaction(async (tx) => {
    const { booking, ledger } = await bookingWithLedger(
      tx,
      context,
      input.bookingId,
    );
    const refundableMinor = ledger.paidMinor - ledger.refundedMinor;
    if (input.amountMinor > refundableMinor) {
      throw new Error("Refund exceeds the net payments received for this booking.");
    }
    return tx.paymentTransaction.create({
      data: {
        organizationId: context.organizationId,
        bookingId: booking.id,
        kind: "REFUND",
        amountMinor: input.amountMinor,
        currency: booking.currency,
        method: input.method,
        reference: input.reference,
        notes: input.notes,
        idempotencyKey: input.idempotencyKey,
        createdById: context.userId,
      },
    });
  });

  await writeAuditLog({
    organizationId: context.organizationId,
    actorUserId: context.userId,
    action: "PAYMENT_RECORDED",
    entityType: "PaymentTransaction",
    entityId: refund.id,
    message: "Customer refund recorded.",
  });
  return refund;
}

export async function holdDeposit(
  context: TenantContext,
  input: MoneyInput,
) {
  assertPermission(context.role, "payments:manage");
  assertPositiveAmount(input.amountMinor);

  const deposit = await prisma.$transaction(async (tx) => {
    const { booking, ledger } = await bookingWithLedger(
      tx,
      context,
      input.bookingId,
    );
    if (!(["CONFIRMED", "ACTIVE"] as string[]).includes(booking.status)) {
      throw new Error("Deposits can only be held for confirmed or active rentals.");
    }
    if (ledger.depositHeldMinor + input.amountMinor > booking.depositMinor) {
      throw new Error("Deposit received exceeds the booking deposit requirement.");
    }
    return tx.paymentTransaction.create({
      data: {
        organizationId: context.organizationId,
        bookingId: booking.id,
        kind: "DEPOSIT_HELD",
        amountMinor: input.amountMinor,
        currency: booking.currency,
        method: input.method,
        reference: input.reference,
        notes: input.notes || "Refundable deposit received.",
        idempotencyKey: input.idempotencyKey,
        createdById: context.userId,
      },
    });
  });

  await writeAuditLog({
    organizationId: context.organizationId,
    actorUserId: context.userId,
    action: "PAYMENT_RECORDED",
    entityType: "PaymentTransaction",
    entityId: deposit.id,
    message: "Refundable deposit received.",
  });
  return deposit;
}

export async function releaseDeposit(
  context: TenantContext,
  input: MoneyInput,
) {
  assertPermission(context.role, "payments:manage");
  assertPositiveAmount(input.amountMinor);

  const release = await prisma.$transaction(async (tx) => {
    const { booking, ledger } = await bookingWithLedger(
      tx,
      context,
      input.bookingId,
    );
    if (input.amountMinor > ledger.depositHeldMinor) {
      throw new Error("Deposit release exceeds the amount currently held.");
    }
    return tx.paymentTransaction.create({
      data: {
        organizationId: context.organizationId,
        bookingId: booking.id,
        kind: "DEPOSIT_RELEASED",
        amountMinor: input.amountMinor,
        currency: booking.currency,
        method: input.method,
        reference: input.reference,
        notes: input.notes || "Refundable deposit released.",
        idempotencyKey: input.idempotencyKey,
        createdById: context.userId,
      },
    });
  });

  await writeAuditLog({
    organizationId: context.organizationId,
    actorUserId: context.userId,
    action: "PAYMENT_RECORDED",
    entityType: "PaymentTransaction",
    entityId: release.id,
    message: "Refundable deposit released.",
  });
  return release;
}
