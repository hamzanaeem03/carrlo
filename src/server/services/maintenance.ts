import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertPermission } from "@/lib/permissions";
import {
  createMaintenanceSchema,
  maintenanceDecisionSchema,
} from "@/lib/validation/maintenance";
import type { TenantContext } from "@/server/context";
import { writeAuditLog } from "@/server/services/audit";

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

async function assertNoBookingConflict(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    vehicleId: string;
    startsAt: Date;
    endsAt: Date;
  },
) {
  const conflict = await tx.booking.findFirst({
    where: {
      organizationId: input.organizationId,
      vehicleId: input.vehicleId,
      status: { in: ["CONFIRMED", "ACTIVE"] },
      startsAt: { lt: input.endsAt },
      endsAt: { gt: input.startsAt },
    },
    select: { reference: true },
  });
  if (conflict) {
    throw new Error(
      `Maintenance conflicts with confirmed booking ${conflict.reference}.`,
    );
  }

  const maintenanceConflict = await tx.maintenanceRecord.findFirst({
    where: {
      organizationId: input.organizationId,
      vehicleId: input.vehicleId,
      status: { in: ["SCHEDULED", "IN_PROGRESS"] },
      startsAt: { lt: input.endsAt },
      endsAt: { gt: input.startsAt },
    },
    select: { id: true },
  });
  if (maintenanceConflict) {
    throw new Error("Vehicle already has maintenance in the selected period.");
  }
}

export async function listMaintenance(context: TenantContext) {
  assertPermission(context.role, "maintenance:manage");
  return prisma.maintenanceRecord.findMany({
    where: { organizationId: context.organizationId },
    include: { vehicle: true, branch: true },
    orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
    take: 100,
  });
}

export async function scheduleMaintenance(
  context: TenantContext,
  input: {
    vehicleId: string;
    startsAt: Date;
    endsAt: Date;
    description: string;
    costMinor?: number;
    odometer?: number;
    notes?: string;
  },
) {
  assertPermission(context.role, "maintenance:manage");
  const data = createMaintenanceSchema.parse(input);

  const record = await prisma.$transaction(async (tx) => {
    await lockVehicle(tx, context.organizationId, data.vehicleId);
    const vehicle = await tx.vehicle.findFirstOrThrow({
      where: {
        id: data.vehicleId,
        organizationId: context.organizationId,
        archivedAt: null,
      },
    });
    await assertNoBookingConflict(tx, {
      organizationId: context.organizationId,
      vehicleId: data.vehicleId,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
    });

    return tx.maintenanceRecord.create({
      data: {
        organizationId: context.organizationId,
        branchId: vehicle.branchId,
        vehicleId: vehicle.id,
        status: "SCHEDULED",
        startsAt: data.startsAt,
        endsAt: data.endsAt,
        description: data.description,
        costMinor: data.costMinor,
        currency: vehicle.currency,
        odometer: data.odometer,
        notes: data.notes,
      },
    });
  });

  await writeAuditLog({
    organizationId: context.organizationId,
    actorUserId: context.userId,
    action: "CREATE",
    entityType: "MaintenanceRecord",
    entityId: record.id,
    message: `Maintenance scheduled: ${record.description}.`,
  });
  return record;
}

export async function startMaintenance(
  context: TenantContext,
  input: { maintenanceId: string; odometer?: number },
) {
  assertPermission(context.role, "maintenance:manage");
  const data = maintenanceDecisionSchema.parse(input);
  const record = await prisma.$transaction(async (tx) => {
    const snapshot = await tx.maintenanceRecord.findFirstOrThrow({
      where: { id: data.maintenanceId, organizationId: context.organizationId },
    });
    await lockVehicle(tx, context.organizationId, snapshot.vehicleId);
    const existing = await tx.maintenanceRecord.findFirstOrThrow({
      where: { id: snapshot.id, organizationId: context.organizationId },
    });
    if (existing.status !== "SCHEDULED") {
      throw new Error("Only scheduled maintenance can be started.");
    }
    const activeBooking = await tx.booking.findFirst({
      where: {
        organizationId: context.organizationId,
        vehicleId: existing.vehicleId,
        status: "ACTIVE",
      },
      select: { reference: true },
    });
    if (activeBooking) {
      throw new Error(
        `Vehicle is currently rented on booking ${activeBooking.reference}.`,
      );
    }

    await tx.vehicle.update({
      where: { id: existing.vehicleId },
      data: {
        status: "MAINTENANCE",
        ...(data.odometer !== undefined ? { odometer: data.odometer } : {}),
      },
    });
    return tx.maintenanceRecord.update({
      where: { id: existing.id },
      data: {
        status: "IN_PROGRESS",
        startsAt: existing.startsAt ?? new Date(),
        odometer: data.odometer ?? existing.odometer,
      },
    });
  });

  await writeAuditLog({
    organizationId: context.organizationId,
    actorUserId: context.userId,
    action: "STATUS_CHANGE",
    entityType: "MaintenanceRecord",
    entityId: record.id,
    message: `Maintenance started: ${record.description}.`,
  });
  return record;
}

export async function completeMaintenance(
  context: TenantContext,
  input: { maintenanceId: string; costMinor?: number; odometer?: number },
) {
  assertPermission(context.role, "maintenance:manage");
  const data = maintenanceDecisionSchema.parse(input);
  const record = await prisma.$transaction(async (tx) => {
    const snapshot = await tx.maintenanceRecord.findFirstOrThrow({
      where: { id: data.maintenanceId, organizationId: context.organizationId },
    });
    await lockVehicle(tx, context.organizationId, snapshot.vehicleId);
    const existing = await tx.maintenanceRecord.findFirstOrThrow({
      where: { id: snapshot.id, organizationId: context.organizationId },
    });
    if (existing.status !== "IN_PROGRESS") {
      throw new Error("Only in-progress maintenance can be completed.");
    }

    await tx.vehicle.update({
      where: { id: existing.vehicleId },
      data: {
        status: "AVAILABLE",
        ...(data.odometer !== undefined ? { odometer: data.odometer } : {}),
      },
    });
    return tx.maintenanceRecord.update({
      where: { id: existing.id },
      data: {
        status: "COMPLETED",
        endsAt: new Date(),
        costMinor: data.costMinor ?? existing.costMinor,
        odometer: data.odometer ?? existing.odometer,
      },
    });
  });

  await writeAuditLog({
    organizationId: context.organizationId,
    actorUserId: context.userId,
    action: "STATUS_CHANGE",
    entityType: "MaintenanceRecord",
    entityId: record.id,
    message: `Maintenance completed: ${record.description}.`,
  });
  return record;
}

export async function cancelMaintenance(
  context: TenantContext,
  maintenanceId: string,
) {
  assertPermission(context.role, "maintenance:manage");
  const data = maintenanceDecisionSchema.parse({ maintenanceId });
  const record = await prisma.$transaction(async (tx) => {
    const snapshot = await tx.maintenanceRecord.findFirstOrThrow({
      where: { id: data.maintenanceId, organizationId: context.organizationId },
    });
    await lockVehicle(tx, context.organizationId, snapshot.vehicleId);
    if (!(["SCHEDULED", "IN_PROGRESS"] as string[]).includes(snapshot.status)) {
      throw new Error("Only open maintenance can be cancelled.");
    }
    if (snapshot.status === "IN_PROGRESS") {
      await tx.vehicle.update({
        where: { id: snapshot.vehicleId },
        data: { status: "AVAILABLE" },
      });
    }
    return tx.maintenanceRecord.update({
      where: { id: snapshot.id },
      data: { status: "CANCELLED" },
    });
  });

  await writeAuditLog({
    organizationId: context.organizationId,
    actorUserId: context.userId,
    action: "STATUS_CHANGE",
    entityType: "MaintenanceRecord",
    entityId: record.id,
    message: `Maintenance cancelled: ${record.description}.`,
  });
  return record;
}
