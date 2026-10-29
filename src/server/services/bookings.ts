import { Prisma, type BookingStatus } from "@prisma/client";
import { assertBookingTransition } from "@/lib/bookings";
import { prisma } from "@/lib/db";
import { calculateRentalTotal } from "@/lib/money";
import { assertPermission } from "@/lib/permissions";
import {
  bookingDecisionSchema,
  bookingIdSchema,
  bookingInspectionSchema,
  createBookingSchema,
  type CreateBookingInput,
  extendBookingSchema,
  reassignBookingSchema,
} from "@/lib/validation/booking";
import type { TenantContext } from "@/server/context";
import { writeAuditLog } from "@/server/services/audit";

const blockingBookingStatuses: BookingStatus[] = ["CONFIRMED", "ACTIVE"];
const blockingMaintenanceStatuses = ["SCHEDULED", "IN_PROGRESS"] as const;

function createReference() {
  return `CAR-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

async function lockVehicle(
  tx: Prisma.TransactionClient,
  organizationId: string,
  vehicleId: string,
) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "Vehicle"
    WHERE "id" = ${vehicleId}
      AND "organizationId" = ${organizationId}
      AND "archivedAt" IS NULL
    FOR UPDATE
  `;

  if (rows.length !== 1) {
    throw new Error("Vehicle was not found in this organization.");
  }
}

async function getVehicleForBooking(
  tx: Prisma.TransactionClient,
  context: TenantContext,
  vehicleId: string,
  branchId?: string,
) {
  const vehicle = await tx.vehicle.findFirst({
    where: {
      id: vehicleId,
      organizationId: context.organizationId,
      archivedAt: null,
      ...(branchId ? { branchId } : {}),
    },
  });

  if (!vehicle) {
    throw new Error("Vehicle was not found in the selected branch.");
  }
  if (vehicle.status === "ARCHIVED" || vehicle.status === "UNAVAILABLE") {
    throw new Error("Vehicle is not available for bookings.");
  }
  return vehicle;
}

async function assertCustomerBelongsToTenant(
  tx: Prisma.TransactionClient,
  context: TenantContext,
  customerId: string,
) {
  const customer = await tx.customer.findFirst({
    where: { id: customerId, organizationId: context.organizationId },
    select: { id: true },
  });
  if (!customer) {
    throw new Error("Customer was not found in this organization.");
  }
}

async function assertVehicleAvailable(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    vehicleId: string;
    startsAt: Date;
    endsAt: Date;
    excludeBookingId?: string;
  },
) {
  const conflictingBooking = await tx.booking.findFirst({
    where: {
      organizationId: input.organizationId,
      vehicleId: input.vehicleId,
      status: { in: blockingBookingStatuses },
      startsAt: { lt: input.endsAt },
      endsAt: { gt: input.startsAt },
      ...(input.excludeBookingId
        ? { id: { not: input.excludeBookingId } }
        : {}),
    },
    select: { reference: true },
  });

  if (conflictingBooking) {
    throw new Error(
      `Vehicle is unavailable because of booking ${conflictingBooking.reference}.`,
    );
  }

  const conflictingMaintenance = await tx.maintenanceRecord.findFirst({
    where: {
      organizationId: input.organizationId,
      vehicleId: input.vehicleId,
      status: { in: [...blockingMaintenanceStatuses] },
      startsAt: { lt: input.endsAt },
      endsAt: { gt: input.startsAt },
    },
    select: { id: true },
  });

  if (conflictingMaintenance) {
    throw new Error("Vehicle is unavailable because of scheduled maintenance.");
  }
}

async function createInitialLedgerEntries(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    bookingId: string;
    totalMinor: number;
    currency: string;
    userId: string;
  },
) {
  const entries: Prisma.PaymentTransactionCreateManyInput[] = [
    {
      organizationId: input.organizationId,
      bookingId: input.bookingId,
      kind: "CHARGE",
      amountMinor: input.totalMinor,
      currency: input.currency,
      notes: "Rental charge snapshot.",
      idempotencyKey: `booking:${input.bookingId}:rental-charge`,
      createdById: input.userId,
    },
  ];

  await tx.paymentTransaction.createMany({ data: entries, skipDuplicates: true });
}

export async function listBookings(context: TenantContext) {
  assertPermission(context.role, "bookings:manage");
  return prisma.booking.findMany({
    where: { organizationId: context.organizationId },
    include: {
      vehicle: true,
      customer: true,
      branch: true,
      payments: { orderBy: { occurredAt: "asc" } },
      statusHistory: { orderBy: { createdAt: "desc" }, take: 5 },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

async function createBooking(
  context: TenantContext,
  input: CreateBookingInput,
  status: "REQUESTED" | "CONFIRMED",
) {
  assertPermission(context.role, "bookings:manage");
  const data = createBookingSchema.parse({
    ...input,
    organizationId: context.organizationId,
  });

  const booking = await prisma.$transaction(async (tx) => {
    if (status === "CONFIRMED") {
      await lockVehicle(tx, context.organizationId, data.vehicleId);
    }
    const vehicle = await getVehicleForBooking(
      tx,
      context,
      data.vehicleId,
      data.branchId,
    );
    await assertCustomerBelongsToTenant(tx, context, data.customerId);

    if (status === "CONFIRMED") {
      await assertVehicleAvailable(tx, {
        organizationId: context.organizationId,
        vehicleId: data.vehicleId,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
      });
    }

    const totals = calculateRentalTotal({
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      dailyRateMinor: vehicle.dailyRateMinor,
    });
    const created = await tx.booking.create({
      data: {
        organizationId: context.organizationId,
        branchId: data.branchId,
        customerId: data.customerId,
        vehicleId: data.vehicleId,
        reference: createReference(),
        status,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
        dailyRateMinor: vehicle.dailyRateMinor,
        depositMinor: vehicle.depositMinor,
        chargesMinor: totals.chargesMinor,
        totalMinor: totals.totalMinor,
        currency: vehicle.currency,
        notes: data.notes,
        createdById: context.userId,
        statusHistory: {
          create: {
            toStatus: status,
            reason:
              status === "REQUESTED"
                ? "Booking request created."
                : "Booking created and confirmed.",
            createdById: context.userId,
          },
        },
      },
    });

    if (status === "CONFIRMED") {
      await createInitialLedgerEntries(tx, {
        organizationId: context.organizationId,
        bookingId: created.id,
        totalMinor: created.totalMinor,
        currency: created.currency,
        userId: context.userId,
      });
    }
    return created;
  });

  await writeAuditLog({
    organizationId: context.organizationId,
    actorUserId: context.userId,
    action: "CREATE",
    entityType: "Booking",
    entityId: booking.id,
    message:
      status === "REQUESTED"
        ? `Booking request ${booking.reference} created.`
        : `Booking ${booking.reference} created and confirmed.`,
  });
  return booking;
}

export function createBookingRequest(
  context: TenantContext,
  input: CreateBookingInput,
) {
  return createBooking(context, input, "REQUESTED");
}

export function createConfirmedBooking(
  context: TenantContext,
  input: CreateBookingInput,
) {
  return createBooking(context, input, "CONFIRMED");
}

export async function confirmBooking(
  context: TenantContext,
  rawBookingId: string,
) {
  assertPermission(context.role, "bookings:manage");
  const bookingId = bookingIdSchema.parse(rawBookingId);

  const booking = await prisma.$transaction(async (tx) => {
    const snapshot = await tx.booking.findFirst({
      where: { id: bookingId, organizationId: context.organizationId },
    });
    if (!snapshot) throw new Error("Booking was not found.");

    await lockVehicle(tx, context.organizationId, snapshot.vehicleId);
    const existing = await tx.booking.findFirstOrThrow({
      where: { id: bookingId, organizationId: context.organizationId },
    });
    assertBookingTransition(existing.status, "CONFIRMED");
    await assertVehicleAvailable(tx, {
      organizationId: context.organizationId,
      vehicleId: existing.vehicleId,
      startsAt: existing.startsAt,
      endsAt: existing.endsAt,
      excludeBookingId: existing.id,
    });

    const updated = await tx.booking.update({
      where: { id: existing.id },
      data: {
        status: "CONFIRMED",
        statusHistory: {
          create: {
            fromStatus: existing.status,
            toStatus: "CONFIRMED",
            reason: "Booking request approved.",
            createdById: context.userId,
          },
        },
      },
    });
    await createInitialLedgerEntries(tx, {
      organizationId: context.organizationId,
      bookingId: updated.id,
      totalMinor: updated.totalMinor,
      currency: updated.currency,
      userId: context.userId,
    });
    return updated;
  });

  await writeAuditLog({
    organizationId: context.organizationId,
    actorUserId: context.userId,
    action: "STATUS_CHANGE",
    entityType: "Booking",
    entityId: booking.id,
    message: `Booking ${booking.reference} confirmed.`,
  });
  return booking;
}

export async function rejectBooking(
  context: TenantContext,
  input: { bookingId: string; reason?: string },
) {
  assertPermission(context.role, "bookings:manage");
  const data = bookingDecisionSchema.parse(input);
  const booking = await prisma.$transaction(async (tx) => {
    const existing = await tx.booking.findFirstOrThrow({
      where: { id: data.bookingId, organizationId: context.organizationId },
    });
    assertBookingTransition(existing.status, "REJECTED");
    return tx.booking.update({
      where: { id: existing.id },
      data: {
        status: "REJECTED",
        cancellationReason: data.reason || "Booking request rejected.",
        statusHistory: {
          create: {
            fromStatus: existing.status,
            toStatus: "REJECTED",
            reason: data.reason || "Booking request rejected.",
            createdById: context.userId,
          },
        },
      },
    });
  });
  await writeAuditLog({
    organizationId: context.organizationId,
    actorUserId: context.userId,
    action: "STATUS_CHANGE",
    entityType: "Booking",
    entityId: booking.id,
    message: `Booking ${booking.reference} rejected.`,
  });
  return booking;
}

export async function cancelBooking(
  context: TenantContext,
  input: { bookingId: string; reason?: string },
) {
  assertPermission(context.role, "bookings:manage");
  const data = bookingDecisionSchema.parse(input);
  const booking = await prisma.$transaction(async (tx) => {
    const existing = await tx.booking.findFirstOrThrow({
      where: { id: data.bookingId, organizationId: context.organizationId },
    });
    assertBookingTransition(existing.status, "CANCELLED");

    if (existing.status === "CONFIRMED") {
      const reversals: Prisma.PaymentTransactionCreateManyInput[] = [
        {
          organizationId: context.organizationId,
          bookingId: existing.id,
          kind: "ADJUSTMENT",
          amountMinor: -existing.totalMinor,
          currency: existing.currency,
          notes: "Confirmed rental charge reversed on cancellation.",
          idempotencyKey: `booking:${existing.id}:cancellation-adjustment`,
          createdById: context.userId,
        },
      ];
      const depositEntries = await tx.paymentTransaction.findMany({
        where: {
          bookingId: existing.id,
          kind: { in: ["DEPOSIT_HELD", "DEPOSIT_RELEASED"] },
        },
        select: { kind: true, amountMinor: true },
      });
      const depositHeldMinor = depositEntries.reduce(
        (total, entry) =>
          total +
          (entry.kind === "DEPOSIT_HELD"
            ? entry.amountMinor
            : -entry.amountMinor),
        0,
      );
      if (depositHeldMinor > 0) {
        reversals.push({
          organizationId: context.organizationId,
          bookingId: existing.id,
          kind: "DEPOSIT_RELEASED",
          amountMinor: depositHeldMinor,
          currency: existing.currency,
          notes: "Deposit requirement released on cancellation.",
          idempotencyKey: `booking:${existing.id}:cancellation-deposit-release`,
          createdById: context.userId,
        });
      }
      await tx.paymentTransaction.createMany({
        data: reversals,
        skipDuplicates: true,
      });
    }

    return tx.booking.update({
      where: { id: existing.id },
      data: {
        status: "CANCELLED",
        cancellationReason: data.reason || "Booking cancelled.",
        statusHistory: {
          create: {
            fromStatus: existing.status,
            toStatus: "CANCELLED",
            reason: data.reason || "Booking cancelled.",
            createdById: context.userId,
          },
        },
      },
    });
  });
  await writeAuditLog({
    organizationId: context.organizationId,
    actorUserId: context.userId,
    action: "STATUS_CHANGE",
    entityType: "Booking",
    entityId: booking.id,
    message: `Booking ${booking.reference} cancelled.`,
  });
  return booking;
}

export async function extendBooking(
  context: TenantContext,
  input: { bookingId: string; endsAt: Date },
) {
  assertPermission(context.role, "bookings:manage");
  const data = extendBookingSchema.parse(input);
  const booking = await prisma.$transaction(async (tx) => {
    const snapshot = await tx.booking.findFirstOrThrow({
      where: { id: data.bookingId, organizationId: context.organizationId },
    });
    if (!(["CONFIRMED", "ACTIVE"] as BookingStatus[]).includes(snapshot.status)) {
      throw new Error("Only confirmed or active bookings can be extended.");
    }
    if (data.endsAt <= snapshot.endsAt) {
      throw new Error("The new return time must be later than the current return time.");
    }

    await lockVehicle(tx, context.organizationId, snapshot.vehicleId);
    await assertVehicleAvailable(tx, {
      organizationId: context.organizationId,
      vehicleId: snapshot.vehicleId,
      startsAt: snapshot.startsAt,
      endsAt: data.endsAt,
      excludeBookingId: snapshot.id,
    });
    const totals = calculateRentalTotal({
      startsAt: snapshot.startsAt,
      endsAt: data.endsAt,
      dailyRateMinor: snapshot.dailyRateMinor,
      discountMinor: snapshot.discountMinor,
      taxMinor: snapshot.taxMinor,
    });
    const additionalChargeMinor = totals.totalMinor - snapshot.totalMinor;
    const updated = await tx.booking.update({
      where: { id: snapshot.id },
      data: {
        endsAt: data.endsAt,
        chargesMinor: totals.chargesMinor,
        totalMinor: totals.totalMinor,
      },
    });
    if (additionalChargeMinor > 0) {
      await tx.paymentTransaction.create({
        data: {
          organizationId: context.organizationId,
          bookingId: snapshot.id,
          kind: "CHARGE",
          amountMinor: additionalChargeMinor,
          currency: snapshot.currency,
          notes: `Extension through ${data.endsAt.toISOString()}.`,
          idempotencyKey: `booking:${snapshot.id}:extension:${data.endsAt.toISOString()}`,
          createdById: context.userId,
        },
      });
    }
    return updated;
  });
  await writeAuditLog({
    organizationId: context.organizationId,
    actorUserId: context.userId,
    action: "UPDATE",
    entityType: "Booking",
    entityId: booking.id,
    message: `Booking ${booking.reference} extended.`,
  });
  return booking;
}

export async function reassignBooking(
  context: TenantContext,
  input: { bookingId: string; vehicleId: string },
) {
  assertPermission(context.role, "bookings:manage");
  const data = reassignBookingSchema.parse(input);
  const booking = await prisma.$transaction(async (tx) => {
    const existing = await tx.booking.findFirstOrThrow({
      where: { id: data.bookingId, organizationId: context.organizationId },
    });
    if (!(["REQUESTED", "PENDING", "CONFIRMED"] as BookingStatus[]).includes(existing.status)) {
      throw new Error("This booking can no longer be reassigned.");
    }
    if (existing.vehicleId === data.vehicleId) {
      throw new Error("Select a different vehicle for reassignment.");
    }

    await lockVehicle(tx, context.organizationId, data.vehicleId);
    const vehicle = await getVehicleForBooking(tx, context, data.vehicleId);
    if (existing.status === "CONFIRMED") {
      await assertVehicleAvailable(tx, {
        organizationId: context.organizationId,
        vehicleId: data.vehicleId,
        startsAt: existing.startsAt,
        endsAt: existing.endsAt,
        excludeBookingId: existing.id,
      });
    }
    const totals = calculateRentalTotal({
      startsAt: existing.startsAt,
      endsAt: existing.endsAt,
      dailyRateMinor: vehicle.dailyRateMinor,
      discountMinor: existing.discountMinor,
      taxMinor: existing.taxMinor,
    });

    if (existing.status === "CONFIRMED") {
      const totalDifference = totals.totalMinor - existing.totalMinor;
      const adjustments: Prisma.PaymentTransactionCreateManyInput[] = [];
      if (totalDifference !== 0) {
        adjustments.push({
          organizationId: context.organizationId,
          bookingId: existing.id,
          kind: "ADJUSTMENT",
          amountMinor: totalDifference,
          currency: vehicle.currency,
          notes: "Price adjustment after vehicle reassignment.",
          idempotencyKey: `booking:${existing.id}:reassignment:${data.vehicleId}:price`,
          createdById: context.userId,
        });
      }
      if (adjustments.length > 0) {
        await tx.paymentTransaction.createMany({
          data: adjustments,
          skipDuplicates: true,
        });
      }
    }

    return tx.booking.update({
      where: { id: existing.id },
      data: {
        vehicleId: vehicle.id,
        branchId: vehicle.branchId,
        dailyRateMinor: vehicle.dailyRateMinor,
        depositMinor: vehicle.depositMinor,
        chargesMinor: totals.chargesMinor,
        totalMinor: totals.totalMinor,
        currency: vehicle.currency,
      },
    });
  });
  await writeAuditLog({
    organizationId: context.organizationId,
    actorUserId: context.userId,
    action: "UPDATE",
    entityType: "Booking",
    entityId: booking.id,
    message: `Booking ${booking.reference} reassigned to another vehicle.`,
  });
  return booking;
}

export async function recordPickup(
  context: TenantContext,
  rawBookingId: string,
  input: { odometer: number; fuelLevel?: string; conditionNotes?: string },
) {
  assertPermission(context.role, "pickup_return:manage");
  const bookingId = bookingIdSchema.parse(rawBookingId);
  const inspection = bookingInspectionSchema.parse(input);
  const booking = await prisma.$transaction(async (tx) => {
    const snapshot = await tx.booking.findFirstOrThrow({
      where: { id: bookingId, organizationId: context.organizationId },
    });
    await lockVehicle(tx, context.organizationId, snapshot.vehicleId);
    const vehicle = await tx.vehicle.findFirstOrThrow({
      where: { id: snapshot.vehicleId, organizationId: context.organizationId },
    });
    const existing = await tx.booking.findFirstOrThrow({
      where: { id: bookingId, organizationId: context.organizationId },
    });
    assertBookingTransition(existing.status, "ACTIVE");
    if (inspection.odometer < vehicle.odometer) {
      throw new Error("Pickup odometer cannot be below the vehicle odometer.");
    }

    const updated = await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: "ACTIVE",
        actualPickupAt: new Date(),
        pickupOdometer: inspection.odometer,
        pickupFuelLevel: inspection.fuelLevel,
        statusHistory: {
          create: {
            fromStatus: existing.status,
            toStatus: "ACTIVE",
            reason: "Vehicle picked up.",
            createdById: context.userId,
          },
        },
        inspections: {
          create: {
            vehicleId: existing.vehicleId,
            type: "PICKUP",
            odometer: inspection.odometer,
            fuelLevel: inspection.fuelLevel,
            conditionNotes: inspection.conditionNotes,
            createdById: context.userId,
          },
        },
      },
    });
    await tx.vehicle.update({
      where: { id: existing.vehicleId },
      data: { status: "RENTED", odometer: inspection.odometer },
    });
    return updated;
  });
  await writeAuditLog({
    organizationId: context.organizationId,
    actorUserId: context.userId,
    action: "PICKUP_RECORDED",
    entityType: "Booking",
    entityId: booking.id,
    message: `Pickup recorded for booking ${booking.reference}.`,
  });
  return booking;
}

export async function recordReturn(
  context: TenantContext,
  rawBookingId: string,
  input: { odometer: number; fuelLevel?: string; conditionNotes?: string },
) {
  assertPermission(context.role, "pickup_return:manage");
  const bookingId = bookingIdSchema.parse(rawBookingId);
  const inspection = bookingInspectionSchema.parse(input);
  const booking = await prisma.$transaction(async (tx) => {
    const snapshot = await tx.booking.findFirstOrThrow({
      where: { id: bookingId, organizationId: context.organizationId },
    });
    await lockVehicle(tx, context.organizationId, snapshot.vehicleId);
    const existing = await tx.booking.findFirstOrThrow({
      where: { id: bookingId, organizationId: context.organizationId },
    });
    assertBookingTransition(existing.status, "COMPLETED");
    if (inspection.odometer < (existing.pickupOdometer ?? 0)) {
      throw new Error("Return odometer cannot be below the pickup odometer.");
    }

    const updated = await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: "COMPLETED",
        actualReturnAt: new Date(),
        returnOdometer: inspection.odometer,
        returnFuelLevel: inspection.fuelLevel,
        statusHistory: {
          create: {
            fromStatus: existing.status,
            toStatus: "COMPLETED",
            reason: "Vehicle returned.",
            createdById: context.userId,
          },
        },
        inspections: {
          create: {
            vehicleId: existing.vehicleId,
            type: "RETURN",
            odometer: inspection.odometer,
            fuelLevel: inspection.fuelLevel,
            conditionNotes: inspection.conditionNotes,
            createdById: context.userId,
          },
        },
      },
    });
    const activeMaintenance = await tx.maintenanceRecord.findFirst({
      where: {
        vehicleId: existing.vehicleId,
        organizationId: context.organizationId,
        status: "IN_PROGRESS",
      },
      select: { id: true },
    });
    await tx.vehicle.update({
      where: { id: existing.vehicleId },
      data: {
        status: activeMaintenance ? "MAINTENANCE" : "AVAILABLE",
        odometer: inspection.odometer,
      },
    });
    return updated;
  });
  await writeAuditLog({
    organizationId: context.organizationId,
    actorUserId: context.userId,
    action: "RETURN_RECORDED",
    entityType: "Booking",
    entityId: booking.id,
    message: `Return recorded for booking ${booking.reference}.`,
  });
  return booking;
}
