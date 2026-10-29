import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function writeAuditLog(input: {
  organizationId?: string;
  actorUserId?: string;
  action:
    | "CREATE"
    | "UPDATE"
    | "DELETE"
    | "LOGIN"
    | "LOGOUT"
    | "STATUS_CHANGE"
    | "PAYMENT_RECORDED"
    | "PICKUP_RECORDED"
    | "RETURN_RECORDED";
  entityType: string;
  entityId?: string;
  message: string;
  metadata?: Prisma.InputJsonObject;
}) {
  await prisma.auditLog.create({
    data: {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      message: input.message,
      metadata: input.metadata,
    },
  });
}
