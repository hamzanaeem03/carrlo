import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { getTenantContext } from "@/server/context";
import {
  cancelMaintenance,
  completeMaintenance,
  listMaintenance,
  scheduleMaintenance,
  startMaintenance,
} from "@/server/services/maintenance";

function actionMessage(error: unknown) {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? "Check the maintenance details.";
  }
  return error instanceof Error
    ? error.message
    : "The maintenance operation failed.";
}

async function completeAction(
  operation: () => Promise<unknown>,
  successMessage: string,
) {
  let tone = "success";
  let message = successMessage;
  try {
    await operation();
  } catch (error) {
    tone = "error";
    message = actionMessage(error);
  }
  revalidatePath("/dashboard/fleet");
  revalidatePath("/dashboard/vehicles");
  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard");
  redirect(`/dashboard/fleet?tone=${tone}&message=${encodeURIComponent(message)}`);
}

async function scheduleAction(formData: FormData) {
  "use server";
  await completeAction(async () => {
    const context = await getTenantContext();
    return scheduleMaintenance(context, {
      vehicleId: String(formData.get("vehicleId") || ""),
      startsAt: new Date(String(formData.get("startsAt") || "")),
      endsAt: new Date(String(formData.get("endsAt") || "")),
      description: String(formData.get("description") || ""),
      costMinor: Math.round(Number(formData.get("cost") || 0) * 100),
      odometer: formData.get("odometer")
        ? Number(formData.get("odometer"))
        : undefined,
      notes: String(formData.get("notes") || ""),
    });
  }, "Maintenance block scheduled.");
}

async function startAction(formData: FormData) {
  "use server";
  await completeAction(async () => {
    const context = await getTenantContext();
    return startMaintenance(context, {
      maintenanceId: String(formData.get("maintenanceId") || ""),
      odometer: formData.get("odometer")
        ? Number(formData.get("odometer"))
        : undefined,
    });
  }, "Maintenance marked in progress.");
}

async function finishAction(formData: FormData) {
  "use server";
  await completeAction(async () => {
    const context = await getTenantContext();
    return completeMaintenance(context, {
      maintenanceId: String(formData.get("maintenanceId") || ""),
      costMinor: formData.get("cost")
        ? Math.round(Number(formData.get("cost")) * 100)
        : undefined,
      odometer: formData.get("odometer")
        ? Number(formData.get("odometer"))
        : undefined,
    });
  }, "Maintenance completed and vehicle released.");
}

async function cancelAction(formData: FormData) {
  "use server";
  await completeAction(async () => {
    const context = await getTenantContext();
    return cancelMaintenance(
      context,
      String(formData.get("maintenanceId") || ""),
    );
  }, "Maintenance block cancelled.");
}

function statusClass(status: string) {
  if (status === "IN_PROGRESS") return "bg-[#eaf2ff] text-[#295f99]";
  if (status === "COMPLETED") return "bg-[#e9f7ef] text-[#247047]";
  if (status === "CANCELLED") return "bg-[#eeeeee] text-[#666]";
  return "bg-[#fff3d9] text-[#916200]";
}

type PageProps = {
  searchParams?: { tone?: string; message?: string };
};

export default async function FleetPage({ searchParams }: PageProps) {
  const context = await getTenantContext();
  const [records, vehicles, inspections] = await Promise.all([
    listMaintenance(context),
    prisma.vehicle.findMany({
      where: { organizationId: context.organizationId, archivedAt: null },
      orderBy: { registration: "asc" },
    }),
    prisma.inspection.findMany({
      where: { vehicle: { organizationId: context.organizationId } },
      include: { vehicle: true, booking: true },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
  ]);

  const activeMaintenance = records.filter(
    (record) => record.status === "IN_PROGRESS",
  ).length;
  const scheduledMaintenance = records.filter(
    (record) => record.status === "SCHEDULED",
  ).length;
  const maintenanceCostMinor = records
    .filter((record) => record.status === "COMPLETED")
    .reduce((total, record) => total + record.costMinor, 0);
  const dateFormatter = new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: context.timezone,
  });

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-[#d98a00]">Fleet operations</p>
        <h1 className="mt-1 text-3xl font-semibold text-[#171513]">Maintenance & inspections</h1>
        <p className="mt-2 max-w-3xl text-sm text-[#68635e]">
          Scheduled and in-progress maintenance blocks booking availability.
          Starting work marks the vehicle in maintenance; completing it returns
          the vehicle to inventory.
        </p>
      </header>

      {searchParams?.message ? (
        <div
          role="status"
          className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
            searchParams.tone === "error"
              ? "border-[#f3beb9] bg-[#fff0ee] text-[#9b312b]"
              : "border-[#b9dfc8] bg-[#eef9f2] text-[#246842]"
          }`}
        >
          {searchParams.message}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          ["Scheduled", scheduledMaintenance.toString()],
          ["In progress", activeMaintenance.toString()],
          ["Completed maintenance cost", formatMoney(maintenanceCostMinor, context.currency)],
        ].map(([label, value]) => (
          <article key={label} className="soft-panel p-5">
            <p className="text-sm text-[#6d6862]">{label}</p>
            <p className="mt-2 text-3xl font-semibold text-[#171513]">{value}</p>
          </article>
        ))}
      </section>

      <details className="soft-panel overflow-hidden" open={records.length === 0}>
        <summary className="cursor-pointer list-none px-5 py-4 font-semibold">
          Schedule maintenance
        </summary>
        <form action={scheduleAction} className="grid gap-3 border-t border-[#ece7e1] p-5 md:grid-cols-2 xl:grid-cols-3">
          <label className="text-xs font-semibold text-[#625d57]">
            Vehicle
            <select name="vehicleId" required className="soft-field mt-1 w-full">
              <option value="">Choose vehicle</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.registration} · {vehicle.make} {vehicle.model}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-[#625d57]">
            Start
            <input name="startsAt" type="datetime-local" required className="soft-field mt-1 w-full" />
          </label>
          <label className="text-xs font-semibold text-[#625d57]">
            Expected completion
            <input name="endsAt" type="datetime-local" required className="soft-field mt-1 w-full" />
          </label>
          <label className="text-xs font-semibold text-[#625d57]">
            Work description
            <input name="description" required minLength={3} placeholder="Oil service, repair, inspection…" className="soft-field mt-1 w-full" />
          </label>
          <label className="text-xs font-semibold text-[#625d57]">
            Estimated cost
            <input name="cost" type="number" min="0" step="0.01" defaultValue="0" className="soft-field mt-1 w-full" />
          </label>
          <label className="text-xs font-semibold text-[#625d57]">
            Odometer
            <input name="odometer" type="number" min="0" placeholder="Optional" className="soft-field mt-1 w-full" />
          </label>
          <label className="text-xs font-semibold text-[#625d57] md:col-span-2 xl:col-span-3">
            Notes
            <input name="notes" placeholder="Workshop, parts, or operational notes" className="soft-field mt-1 w-full" />
          </label>
          <button className="rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white md:w-fit">Create maintenance block</button>
        </form>
      </details>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Maintenance records</h2>
        {records.length === 0 ? (
          <div className="soft-panel p-8 text-center text-sm text-[#68635e]">No maintenance records yet.</div>
        ) : (
          records.map((record) => (
            <article key={record.id} className="soft-panel p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(record.status)}`}>{record.status.replaceAll("_", " ")}</span>
                    <span className="text-xs text-[#77716a]">{record.branch.name}</span>
                  </div>
                  <h3 className="mt-3 text-lg font-semibold">{record.description}</h3>
                  <p className="mt-1 text-sm text-[#625d57]">{record.vehicle.registration} · {record.vehicle.make} {record.vehicle.model}</p>
                  <p className="mt-2 text-sm text-[#77716a]">
                    {record.startsAt ? dateFormatter.format(record.startsAt) : "Start not set"} → {record.endsAt ? dateFormatter.format(record.endsAt) : "Open ended"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[#77716a]">Cost</p>
                  <p className="text-lg font-semibold">{formatMoney(record.costMinor, record.currency)}</p>
                  {record.odometer !== null ? <p className="text-xs text-[#77716a]">{record.odometer.toLocaleString()} km/mi</p> : null}
                </div>
              </div>

              {record.status === "SCHEDULED" ? (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-[#ece7e1] pt-4">
                  <form action={startAction} className="flex gap-2">
                    <input type="hidden" name="maintenanceId" value={record.id} />
                    <input name="odometer" type="number" min={record.vehicle.odometer} placeholder="Current odometer" className="soft-field" />
                    <button className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white">Start work</button>
                  </form>
                  <form action={cancelAction}>
                    <input type="hidden" name="maintenanceId" value={record.id} />
                    <button className="rounded-xl border border-[#d8aaa5] px-4 py-2 text-sm font-semibold text-[#933a34]">Cancel block</button>
                  </form>
                </div>
              ) : null}

              {record.status === "IN_PROGRESS" ? (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-[#ece7e1] pt-4">
                  <form action={finishAction} className="flex flex-wrap gap-2">
                    <input type="hidden" name="maintenanceId" value={record.id} />
                    <input name="cost" type="number" min="0" step="0.01" defaultValue={(record.costMinor / 100).toFixed(2)} placeholder="Final cost" className="soft-field" />
                    <input name="odometer" type="number" min={record.vehicle.odometer} placeholder="Final odometer" className="soft-field" />
                    <button className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white">Complete work</button>
                  </form>
                  <form action={cancelAction}>
                    <input type="hidden" name="maintenanceId" value={record.id} />
                    <button className="rounded-xl border border-[#d8aaa5] px-4 py-2 text-sm font-semibold text-[#933a34]">Cancel work</button>
                  </form>
                </div>
              ) : null}
            </article>
          ))
        )}
      </section>

      <section className="soft-panel overflow-hidden">
        <div className="border-b border-[#ece7e1] px-5 py-4">
          <h2 className="text-lg font-semibold">Recent pickup & return inspections</h2>
        </div>
        <div className="divide-y divide-[#ece7e1]">
          {inspections.map((inspection) => (
            <div key={inspection.id} className="grid gap-2 px-5 py-4 text-sm sm:grid-cols-[1fr_1fr_1fr]">
              <div><span className="font-semibold">{inspection.type}</span> · {inspection.vehicle.registration}</div>
              <div className="text-[#6d6862]">{inspection.odometer?.toLocaleString() ?? "—"} km/mi · Fuel {inspection.fuelLevel || "—"}</div>
              <div className="text-[#6d6862] sm:text-right">{dateFormatter.format(inspection.createdAt)}</div>
            </div>
          ))}
          {inspections.length === 0 ? <p className="px-5 py-8 text-center text-sm text-[#68635e]">Inspections appear after pickup and return.</p> : null}
        </div>
      </section>
    </div>
  );
}
