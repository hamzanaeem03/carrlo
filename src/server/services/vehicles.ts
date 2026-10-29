import { prisma } from "@/lib/db";
import { assertPermission } from "@/lib/permissions";
import { vehicleSchema, VehicleInput } from "@/lib/validation/vehicles";
import { TenantContext } from "@/server/context";
import { writeAuditLog } from "@/server/services/audit";

export async function listVehicles(context: TenantContext) {
  assertPermission(context.role, "vehicles:manage");
  return prisma.vehicle.findMany({
    where: { organizationId: context.organizationId, archivedAt: null },
    include: { branch: true },
    orderBy: [{ status: "asc" }, { registration: "asc" }],
  });
}

export async function createVehicle(context: TenantContext, input: VehicleInput) {
  assertPermission(context.role, "vehicles:manage");
  const data = vehicleSchema.parse(input);

  const vehicle = await prisma.vehicle.create({
    data: {
      ...data,
      organizationId: context.organizationId,
      currency: "USD",
    },
  });

  await writeAuditLog({
    organizationId: context.organizationId,
    actorUserId: context.userId,
    action: "CREATE",
    entityType: "Vehicle",
    entityId: vehicle.id,
    message: `Vehicle ${vehicle.registration} created.`,
  });

  return vehicle;
}
