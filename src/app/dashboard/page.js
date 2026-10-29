import { getTenantContext } from "@/server/context";
import { getDashboardMetrics } from "@/server/services/dashboard";
import { formatMoney } from "@/lib/money";

const statLabels = [
  ["Total vehicles", "totalVehicles"],
  ["Operational", "operationalVehicles"],
  ["Currently rented", "rentedVehicles"],
  ["Maintenance", "maintenanceVehicles"],
  ["Pending bookings", "pendingBookings"],
  ["Active rentals", "activeBookings"],
  ["Upcoming pickups", "upcomingPickups"],
  ["Upcoming returns", "upcomingReturns"],
  ["Overdue returns", "overdueReturns"],
];

const page = async () => {
  const context = await getTenantContext();
  const metrics = await getDashboardMetrics(context.organizationId);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
        <p className="text-sm font-semibold text-[#F6A60C]">
          {context.organizationName}
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-[0] text-black">
          Operations dashboard
        </h1>
        </div>
        <div className="rounded-full bg-white/80 px-5 py-3 text-sm text-[#6a6560]">
          Live operational snapshot
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
        {statLabels.map(([label, key]) => (
          <article
            key={key}
            className="soft-panel p-5"
          >
            <p className="text-sm text-[#666]">{label}</p>
            <p className="mt-2 text-3xl font-semibold text-[#252525]">
              {metrics[key]}
            </p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="soft-panel p-6">
          <h2 className="text-lg font-semibold text-[#252525]">
            Financial snapshot
          </h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-[#666]">Payments collected</dt>
              <dd className="text-2xl font-semibold">
                {formatMoney(metrics.collectedPaymentsMinor, context.currency)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-[#666]">Outstanding balance</dt>
              <dd className="text-2xl font-semibold">
                {formatMoney(metrics.outstandingChargesMinor, context.currency)}
              </dd>
            </div>
          </dl>
        </article>

        <article className="soft-panel p-6">
          <h2 className="text-lg font-semibold text-[#252525]">
            Recent activity
          </h2>
          <div className="mt-4 space-y-3">
            {metrics.recentActivity.length === 0 ? (
              <p className="text-sm text-[#666]">
                No activity yet. Create vehicles, customers, and bookings to
                populate this feed.
              </p>
            ) : (
              metrics.recentActivity.map((item) => (
                <div key={item.id} className="border-b border-[#f1e7d9] pb-2">
                  <p className="text-sm font-medium text-[#252525]">
                    {item.message}
                  </p>
                  <p className="text-xs text-[#777]">
                    {item.createdAt.toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </article>
      </section>
    </div>
  );
};

export default page;
