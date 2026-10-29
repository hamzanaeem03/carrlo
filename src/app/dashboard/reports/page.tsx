import { getTenantContext } from "@/server/context";
import { getDashboardMetrics } from "@/server/services/dashboard";
import { formatMoney } from "@/lib/money";

export default async function ReportsPage() {
  const context = await getTenantContext();
  const metrics = await getDashboardMetrics(context.organizationId);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-[#252525]">Reports</h1>
      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-lg border border-[#eee2d2] bg-white p-4 shadow-sm">
          <p className="text-sm text-[#666]">Fleet utilization signal</p>
          <p className="text-2xl font-semibold">{metrics.rentedVehicles}/{metrics.totalVehicles}</p>
        </article>
        <article className="rounded-lg border border-[#eee2d2] bg-white p-4 shadow-sm">
          <p className="text-sm text-[#666]">Payments collected</p>
          <p className="text-2xl font-semibold">{formatMoney(metrics.collectedPaymentsMinor, "USD")}</p>
        </article>
        <article className="rounded-lg border border-[#eee2d2] bg-white p-4 shadow-sm">
          <p className="text-sm text-[#666]">Outstanding balance</p>
          <p className="text-2xl font-semibold">{formatMoney(metrics.outstandingChargesMinor, "USD")}</p>
        </article>
      </section>
    </div>
  );
}
