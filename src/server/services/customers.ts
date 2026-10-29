import { prisma } from "@/lib/db";
import { assertPermission } from "@/lib/permissions";
import { customerSchema, CustomerInput } from "@/lib/validation/customers";
import { TenantContext } from "@/server/context";
import { writeAuditLog } from "@/server/services/audit";

export async function listCustomers(context: TenantContext) {
  assertPermission(context.role, "customers:manage");
  return prisma.customer.findMany({
    where: { organizationId: context.organizationId },
    orderBy: { createdAt: "desc" },
  });
}

export async function createCustomer(context: TenantContext, input: CustomerInput) {
  assertPermission(context.role, "customers:manage");
  const data = customerSchema.parse(input);

  const customer = await prisma.customer.create({
    data: {
      ...data,
      email: data.email || null,
      organizationId: context.organizationId,
    },
  });

  await writeAuditLog({
    organizationId: context.organizationId,
    actorUserId: context.userId,
    action: "CREATE",
    entityType: "Customer",
    entityId: customer.id,
    message: `Customer ${customer.name} created.`,
  });

  return customer;
}
