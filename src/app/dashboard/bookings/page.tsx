import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { prisma } from "@/lib/db";
import { formatMoney, summarizeLedger } from "@/lib/money";
import { hasPermission } from "@/lib/permissions";
import { getTenantContext } from "@/server/context";
import {
  cancelBooking,
  confirmBooking,
  createBookingRequest,
  extendBooking,
  listBookings,
  reassignBooking,
  recordPickup,
  recordReturn,
  rejectBooking,
} from "@/server/services/bookings";
import { recordManualPayment } from "@/server/services/payments";

function actionErrorMessage(error: unknown) {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? "Check the form values and try again.";
  }
  if (error instanceof Error) {
    if (error.message.includes("No record was found")) {
      return "The record was not found or you no longer have access to it.";
    }
    return error.message;
  }
  return "The operation could not be completed.";
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
    message = actionErrorMessage(error);
  }

  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/payments");
  redirect(
    `/dashboard/bookings?tone=${tone}&message=${encodeURIComponent(message)}`,
  );
}

async function createRequestAction(formData: FormData) {
  "use server";
  await completeAction(async () => {
    const context = await getTenantContext();
    return createBookingRequest(context, {
      organizationId: context.organizationId,
      branchId: String(formData.get("branchId") || ""),
      customerId: String(formData.get("customerId") || ""),
      vehicleId: String(formData.get("vehicleId") || ""),
      startsAt: new Date(String(formData.get("startsAt") || "")),
      endsAt: new Date(String(formData.get("endsAt") || "")),
      notes: String(formData.get("notes") || ""),
    });
  }, "Booking request created.");
}

async function confirmAction(formData: FormData) {
  "use server";
  await completeAction(async () => {
    const context = await getTenantContext();
    return confirmBooking(context, String(formData.get("bookingId") || ""));
  }, "Booking confirmed and charges created.");
}

async function rejectAction(formData: FormData) {
  "use server";
  await completeAction(async () => {
    const context = await getTenantContext();
    return rejectBooking(context, {
      bookingId: String(formData.get("bookingId") || ""),
      reason: String(formData.get("reason") || ""),
    });
  }, "Booking request rejected.");
}

async function cancelAction(formData: FormData) {
  "use server";
  await completeAction(async () => {
    const context = await getTenantContext();
    return cancelBooking(context, {
      bookingId: String(formData.get("bookingId") || ""),
      reason: String(formData.get("reason") || ""),
    });
  }, "Booking cancelled.");
}

async function extendAction(formData: FormData) {
  "use server";
  await completeAction(async () => {
    const context = await getTenantContext();
    return extendBooking(context, {
      bookingId: String(formData.get("bookingId") || ""),
      endsAt: new Date(String(formData.get("endsAt") || "")),
    });
  }, "Booking extension recorded.");
}

async function reassignAction(formData: FormData) {
  "use server";
  await completeAction(async () => {
    const context = await getTenantContext();
    return reassignBooking(context, {
      bookingId: String(formData.get("bookingId") || ""),
      vehicleId: String(formData.get("vehicleId") || ""),
    });
  }, "Booking vehicle reassigned.");
}

async function pickupAction(formData: FormData) {
  "use server";
  await completeAction(async () => {
    const context = await getTenantContext();
    return recordPickup(context, String(formData.get("bookingId") || ""), {
      odometer: Number(formData.get("odometer")),
      fuelLevel: String(formData.get("fuelLevel") || ""),
      conditionNotes: String(formData.get("conditionNotes") || ""),
    });
  }, "Pickup recorded. Vehicle is now rented.");
}

async function returnAction(formData: FormData) {
  "use server";
  await completeAction(async () => {
    const context = await getTenantContext();
    return recordReturn(context, String(formData.get("bookingId") || ""), {
      odometer: Number(formData.get("odometer")),
      fuelLevel: String(formData.get("fuelLevel") || ""),
      conditionNotes: String(formData.get("conditionNotes") || ""),
    });
  }, "Return recorded. Vehicle availability updated.");
}

async function paymentAction(formData: FormData) {
  "use server";
  await completeAction(async () => {
    const context = await getTenantContext();
    return recordManualPayment(context, {
      bookingId: String(formData.get("bookingId") || ""),
      amountMinor: Math.round(Number(formData.get("amount")) * 100),
      method: String(formData.get("method") || "Manual"),
      reference: String(formData.get("reference") || ""),
      notes: String(formData.get("notes") || ""),
    });
  }, "Payment recorded.");
}

function toDateTimeInput(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

function statusClass(status: string) {
  if (status === "ACTIVE") return "bg-[#e8f3ff] text-[#1261a0]";
  if (status === "CONFIRMED") return "bg-[#e8f7ee] text-[#27764a]";
  if (status === "COMPLETED") return "bg-[#ececec] text-[#545454]";
  if (status === "CANCELLED" || status === "REJECTED") {
    return "bg-[#ffeceb] text-[#a33b35]";
  }
  return "bg-[#fff2d8] text-[#956300]";
}

type PageProps = {
  searchParams?: { tone?: string; message?: string };
};

export default async function BookingsPage({ searchParams }: PageProps) {
  const context = await getTenantContext();
  const [bookings, vehicles, customers, branches] = await Promise.all([
    listBookings(context),
    prisma.vehicle.findMany({
      where: {
        organizationId: context.organizationId,
        archivedAt: null,
        status: { not: "ARCHIVED" },
      },
      orderBy: { registration: "asc" },
    }),
    prisma.customer.findMany({
      where: { organizationId: context.organizationId },
      orderBy: { name: "asc" },
    }),
    prisma.branch.findMany({
      where: { organizationId: context.organizationId, isActive: true },
      orderBy: { isDefault: "desc" },
    }),
  ]);

  const canManagePayments = hasPermission(context.role, "payments:manage");
  const pendingCount = bookings.filter((booking) =>
    ["REQUESTED", "PENDING"].includes(booking.status),
  ).length;
  const activeCount = bookings.filter(
    (booking) => booking.status === "ACTIVE",
  ).length;
  const upcomingCount = bookings.filter(
    (booking) =>
      booking.status === "CONFIRMED" && booking.startsAt > new Date(),
  ).length;
  const dateFormatter = new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: context.timezone,
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#d98a00]">Rental operations</p>
          <h1 className="mt-1 text-3xl font-semibold text-[#171513]">Bookings</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#68635e]">
            Requests do not reserve inventory until confirmed. Confirmation,
            reassignment, and extensions all recheck availability inside a
            vehicle-locked transaction.
          </p>
        </div>
        <div className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-[#6a6560]">
          Times shown in {context.timezone}
        </div>
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
          ["Awaiting decision", pendingCount],
          ["Upcoming pickups", upcomingCount],
          ["Active rentals", activeCount],
        ].map(([label, value]) => (
          <article key={label} className="soft-panel p-5">
            <p className="text-sm text-[#6d6862]">{label}</p>
            <p className="mt-2 text-3xl font-semibold text-[#171513]">{value}</p>
          </article>
        ))}
      </section>

      <details className="soft-panel overflow-hidden" open={bookings.length === 0}>
        <summary className="cursor-pointer list-none px-5 py-4 font-semibold text-[#1d1b19]">
          Create booking request
          <span className="ml-2 text-xs font-normal text-[#77716b]">
            Pricing is snapshotted now; charges are created on confirmation.
          </span>
        </summary>
        <form
          action={createRequestAction}
          className="grid gap-3 border-t border-[#eee9e3] p-5 md:grid-cols-2 xl:grid-cols-3"
        >
          <label className="text-xs font-semibold text-[#625d57]">
            Branch
            <select name="branchId" required className="soft-field mt-1 w-full">
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
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
            Customer
            <select name="customerId" required className="soft-field mt-1 w-full">
              <option value="">Choose customer</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} · {customer.phone}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-[#625d57]">
            Pickup date and time
            <input name="startsAt" type="datetime-local" required className="soft-field mt-1 w-full" />
          </label>
          <label className="text-xs font-semibold text-[#625d57]">
            Return date and time
            <input name="endsAt" type="datetime-local" required className="soft-field mt-1 w-full" />
          </label>
          <label className="text-xs font-semibold text-[#625d57]">
            Notes
            <input name="notes" placeholder="Optional request notes" className="soft-field mt-1 w-full" />
          </label>
          <button className="rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white md:w-fit">
            Save request
          </button>
        </form>
      </details>

      <section className="space-y-4">
        {bookings.length === 0 ? (
          <div className="soft-panel p-10 text-center text-sm text-[#68635e]">
            No bookings yet. Add a vehicle and customer, then create the first request.
          </div>
        ) : (
          bookings.map((booking) => {
            const ledger = summarizeLedger(booking.payments);
            const canDecide = ["REQUESTED", "PENDING"].includes(booking.status);
            const canCancel = ["REQUESTED", "PENDING", "CONFIRMED"].includes(
              booking.status,
            );
            const canReassign = canCancel;
            const canExtend = ["CONFIRMED", "ACTIVE"].includes(booking.status);
            const suggestedExtension = new Date(
              booking.endsAt.getTime() + 24 * 60 * 60 * 1000,
            );

            return (
              <article key={booking.id} className="soft-panel overflow-hidden">
                <div className="grid gap-5 p-5 lg:grid-cols-[1.4fr_0.8fr]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#817a73]">
                        {booking.reference}
                      </span>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(booking.status)}`}>
                        {booking.status}
                      </span>
                    </div>
                    <h2 className="mt-3 text-xl font-semibold text-[#171513]">
                      {booking.customer.name}
                    </h2>
                    <p className="mt-1 text-sm text-[#5f5a55]">
                      {booking.vehicle.registration} · {booking.vehicle.make} {booking.vehicle.model} · {booking.branch.name}
                    </p>
                    <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                      <div className="rounded-xl bg-[#f7f5f2] p-3">
                        <p className="text-xs text-[#7b756f]">Pickup</p>
                        <p className="mt-1 font-medium">{dateFormatter.format(booking.startsAt)}</p>
                      </div>
                      <div className="rounded-xl bg-[#f7f5f2] p-3">
                        <p className="text-xs text-[#7b756f]">Return</p>
                        <p className="mt-1 font-medium">{dateFormatter.format(booking.endsAt)}</p>
                      </div>
                    </div>
                    {booking.notes ? (
                      <p className="mt-3 text-sm text-[#6d6761]">{booking.notes}</p>
                    ) : null}
                    {booking.cancellationReason ? (
                      <p className="mt-3 rounded-xl bg-[#fff1ef] p-3 text-sm text-[#933a34]">
                        {booking.cancellationReason}
                      </p>
                    ) : null}
                  </div>

                  <dl className="grid grid-cols-2 gap-3 rounded-2xl bg-[#f4f1ed] p-4 text-sm">
                    <div>
                      <dt className="text-xs text-[#77716a]">Rental total</dt>
                      <dd className="mt-1 font-semibold">{formatMoney(booking.totalMinor, booking.currency)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-[#77716a]">Paid</dt>
                      <dd className="mt-1 font-semibold">{formatMoney(ledger.paidMinor, booking.currency)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-[#77716a]">Balance</dt>
                      <dd className={`mt-1 font-semibold ${ledger.balanceMinor > 0 ? "text-[#a24d00]" : "text-[#28734a]"}`}>
                        {formatMoney(ledger.balanceMinor, booking.currency)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-[#77716a]">Deposit held</dt>
                      <dd className="mt-1 font-semibold">{formatMoney(ledger.depositHeldMinor, booking.currency)}</dd>
                    </div>
                  </dl>
                </div>

                <div className="border-t border-[#ece7e1] bg-white/60 p-4">
                  <div className="grid gap-3 xl:grid-cols-2">
                    {canDecide ? (
                      <div className="flex flex-wrap gap-2">
                        <form action={confirmAction}>
                          <input type="hidden" name="bookingId" value={booking.id} />
                          <button className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white">
                            Confirm booking
                          </button>
                        </form>
                        <form action={rejectAction} className="flex gap-2">
                          <input type="hidden" name="bookingId" value={booking.id} />
                          <input name="reason" required placeholder="Rejection reason" className="soft-field min-w-0 flex-1" />
                          <button className="rounded-xl border border-[#d8aaa5] px-4 py-2 text-sm font-semibold text-[#933a34]">
                            Reject
                          </button>
                        </form>
                      </div>
                    ) : null}

                    {booking.status === "CONFIRMED" ? (
                      <form action={pickupAction} className="grid gap-2 sm:grid-cols-[1fr_1fr_1.4fr_auto]">
                        <input type="hidden" name="bookingId" value={booking.id} />
                        <input name="odometer" type="number" min={booking.vehicle.odometer} placeholder="Odometer" required className="soft-field min-w-0" />
                        <input name="fuelLevel" placeholder="Fuel level" className="soft-field min-w-0" />
                        <input name="conditionNotes" placeholder="Pickup condition" className="soft-field min-w-0" />
                        <button className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white">Record pickup</button>
                      </form>
                    ) : null}

                    {booking.status === "ACTIVE" ? (
                      <form action={returnAction} className="grid gap-2 sm:grid-cols-[1fr_1fr_1.4fr_auto]">
                        <input type="hidden" name="bookingId" value={booking.id} />
                        <input name="odometer" type="number" min={booking.pickupOdometer ?? 0} placeholder="Return odometer" required className="soft-field min-w-0" />
                        <input name="fuelLevel" placeholder="Fuel level" className="soft-field min-w-0" />
                        <input name="conditionNotes" placeholder="Return condition" className="soft-field min-w-0" />
                        <button className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white">Record return</button>
                      </form>
                    ) : null}

                    {canExtend ? (
                      <form action={extendAction} className="flex flex-wrap gap-2">
                        <input type="hidden" name="bookingId" value={booking.id} />
                        <input name="endsAt" type="datetime-local" min={toDateTimeInput(booking.endsAt)} defaultValue={toDateTimeInput(suggestedExtension)} required className="soft-field" />
                        <button className="rounded-xl border border-black px-4 py-2 text-sm font-semibold">Extend return</button>
                      </form>
                    ) : null}

                    {canReassign && vehicles.length > 1 ? (
                      <form action={reassignAction} className="flex flex-wrap gap-2">
                        <input type="hidden" name="bookingId" value={booking.id} />
                        <select name="vehicleId" required className="soft-field min-w-52">
                          <option value="">Reassign vehicle</option>
                          {vehicles
                            .filter((vehicle) => vehicle.id !== booking.vehicleId)
                            .map((vehicle) => (
                              <option key={vehicle.id} value={vehicle.id}>
                                {vehicle.registration} · {vehicle.make} {vehicle.model}
                              </option>
                            ))}
                        </select>
                        <button className="rounded-xl border border-black px-4 py-2 text-sm font-semibold">Reassign</button>
                      </form>
                    ) : null}

                    {canManagePayments && ["CONFIRMED", "ACTIVE", "COMPLETED"].includes(booking.status) ? (
                      <form action={paymentAction} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                        <input type="hidden" name="bookingId" value={booking.id} />
                        <input name="amount" type="number" min="0.01" step="0.01" placeholder="Payment amount" required className="soft-field min-w-0" />
                        <select name="method" className="soft-field min-w-0" defaultValue="Cash">
                          <option>Cash</option>
                          <option>Bank transfer</option>
                          <option>Card terminal</option>
                          <option>Other</option>
                        </select>
                        <input name="reference" placeholder="Receipt/reference" className="soft-field min-w-0" />
                        <button className="rounded-xl border border-black px-4 py-2 text-sm font-semibold">Record payment</button>
                      </form>
                    ) : null}

                    {canCancel ? (
                      <form action={cancelAction} className="flex flex-wrap gap-2">
                        <input type="hidden" name="bookingId" value={booking.id} />
                        <input name="reason" required placeholder="Cancellation reason" className="soft-field min-w-52 flex-1" />
                        <button className="rounded-xl border border-[#d8aaa5] px-4 py-2 text-sm font-semibold text-[#933a34]">Cancel booking</button>
                      </form>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
