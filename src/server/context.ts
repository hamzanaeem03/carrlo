import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { Role } from "@/lib/permissions";

export type TenantContext = {
  userId: string;
  organizationId: string;
  organizationName: string;
  currency: string;
  timezone: string;
  role: Role;
};

export async function getTenantContext(): Promise<TenantContext> {
  const session = await auth();

  if (!session?.user?.id || !session.user.organizationId || !session.user.role) {
    throw new Error("Unauthenticated or missing organization membership.");
  }

  const membership = await prisma.membership.findFirst({
    where: {
      userId: session.user.id,
      organizationId: session.user.organizationId,
      status: "ACTIVE",
    },
    include: { organization: true },
  });

  if (!membership) {
    throw new Error("Active organization membership not found.");
  }

  return {
    userId: session.user.id,
    organizationId: membership.organizationId,
    organizationName: membership.organization.name,
    currency: membership.organization.currency,
    timezone: membership.organization.timezone,
    role: membership.role as Role,
  };
}
