import { prisma } from "@/lib/db";
import { summarizeLedger } from "@/lib/money";

export async function getDashboardMetrics(organizationId: string) {
  const now = new Date();
  const nextSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [
    totalVehicles,
    operationalVehicles,
    rentedVehicles,
    maintenanceVehicles,
    pendingBookings,
    activeBookings,
    upcomingPickups,
    upcomingReturns,
    overdueReturns,
    financialTotals,
    recentActivity,
  ] = await Promise.all([
    prisma.vehicle.count({ where: { organizationId, archivedAt: null } }),
    prisma.vehicle.count({
      where: { organizationId, status: { in: ["AVAILABLE", "RENTED"] }, archivedAt: null },
    }),
    prisma.vehicle.count({ where: { organizationId, status: "RENTED" } }),
    prisma.vehicle.count({ where: { organizationId, status: "MAINTENANCE" } }),
    prisma.booking.count({ where: { organizationId, status: { in: ["REQUESTED", "PENDING"] } } }),
    prisma.booking.count({ where: { organizationId, status: "ACTIVE" } }),
    prisma.booking.count({
      where: { organizationId, status: "CONFIRMED", startsAt: { gte: now, lte: nextSevenDays } },
    }),
    prisma.booking.count({
      where: { organizationId, status: "ACTIVE", endsAt: { gte: now, lte: nextSevenDays } },
    }),
    prisma.booking.count({ where: { organizationId, status: "ACTIVE", endsAt: { lt: now } } }),
    prisma.paymentTransaction.groupBy({
      by: ["kind"],
      where: { organizationId },
      _sum: { amountMinor: true },
    }),
    prisma.auditLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  const ledger = summarizeLedger(
    financialTotals.map((total) => ({
      kind: total.kind,
      amountMinor: total._sum.amountMinor ?? 0,
    })),
  );

  return {
    totalVehicles,
    operationalVehicles,
    rentedVehicles,
    maintenanceVehicles,
    pendingBookings,
    activeBookings,
    upcomingPickups,
    upcomingReturns,
    overdueReturns,
    collectedPaymentsMinor: ledger.paidMinor - ledger.refundedMinor,
    outstandingChargesMinor: Math.max(0, ledger.balanceMinor),
    recentActivity,
  };
}
