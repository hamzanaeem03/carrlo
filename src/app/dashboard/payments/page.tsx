import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formatMoney, summarizeLedger } from "@/lib/money";
import { getTenantContext } from "@/server/context";
import {
  holdDeposit,
  listFinancialBookings,
  listTransactions,
  recordManualPayment,
  recordRefund,
  releaseDeposit,
} from "@/server/services/payments";

function messageFromError(error: unknown) {
  return error instanceof Error
    ? error.message
    : "The financial transaction could not be recorded.";
}

async function completeFinancialAction(
  operation: () => Promise<unknown>,
  successMessage: string,
) {
  let tone = "success";
  let message = successMessage;
  try {
    await operation();
  } catch (error) {
    tone = "error";
    message = messageFromError(error);
  }
  revalidatePath("/dashboard/payments");
  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard");
  redirect(
    `/dashboard/payments?tone=${tone}&message=${encodeURIComponent(message)}`,
  );
}

function moneyInput(formData: FormData) {
  return {
    bookingId: String(formData.get("bookingId") || ""),
    amountMinor: Math.round(Number(formData.get("amount")) * 100),
    method: String(formData.get("method") || "Manual"),
    reference: String(formData.get("reference") || ""),
    notes: String(formData.get("notes") || ""),
  };
}

async function paymentAction(formData: FormData) {
  "use server";
  await completeFinancialAction(async () => {
    const context = await getTenantContext();
    return recordManualPayment(context, moneyInput(formData));
  }, "Payment received and added to the ledger.");
}

async function refundAction(formData: FormData) {
  "use server";
  await completeFinancialAction(async () => {
    const context = await getTenantContext();
    return recordRefund(context, moneyInput(formData));
  }, "Refund added to the ledger.");
}

async function holdDepositAction(formData: FormData) {
  "use server";
  await completeFinancialAction(async () => {
    const context = await getTenantContext();
    return holdDeposit(context, moneyInput(formData));
  }, "Refundable deposit recorded as held.");
}

async function releaseDepositAction(formData: FormData) {
  "use server";
  await completeFinancialAction(async () => {
    const context = await getTenantContext();
    return releaseDeposit(context, moneyInput(formData));
  }, "Refundable deposit release recorded.");
}

function transactionStyle(kind: string) {
  if (kind === "PAYMENT") return "bg-[#e9f7ef] text-[#247047]";
  if (kind === "REFUND") return "bg-[#ffeceb] text-[#9f3b35]";
  if (kind.startsWith("DEPOSIT")) return "bg-[#eaf2ff] text-[#295f99]";
  return "bg-[#fff3d9] text-[#916200]";
}

type PageProps = {
  searchParams?: { tone?: string; message?: string };
};

export default async function PaymentsPage({ searchParams }: PageProps) {
  const context = await getTenantContext();
  const [bookings, transactions] = await Promise.all([
    listFinancialBookings(context),
    listTransactions(context),
  ]);

  const summaries = bookings.map((booking) => ({
    booking,
    ledger: summarizeLedger(booking.payments),
  }));
  const collectedMinor = summaries.reduce(
    (total, item) =>
      total + item.ledger.paidMinor - item.ledger.refundedMinor,
    0,
  );
  const outstandingMinor = summaries.reduce(
    (total, item) => total + Math.max(0, item.ledger.balanceMinor),
    0,
  );
  const depositsHeldMinor = summaries.reduce(
    (total, item) => total + item.ledger.depositHeldMinor,
    0,
  );
  const dateFormatter = new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: context.timezone,
  });

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-[#d98a00]">Financial operations</p>
        <h1 className="mt-1 text-3xl font-semibold text-[#171513]">Payments & deposits</h1>
        <p className="mt-2 max-w-3xl text-sm text-[#68635e]">
          Charges show what is owed, payments show money received, refunds show
          money returned, and refundable deposits remain separate from revenue.
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
          ["Net payments collected", collectedMinor],
          ["Outstanding balances", outstandingMinor],
          ["Refundable deposits held", depositsHeldMinor],
        ].map(([label, amount]) => (
          <article key={label} className="soft-panel p-5">
            <p className="text-sm text-[#6d6862]">{label}</p>
            <p className="mt-2 text-3xl font-semibold text-[#171513]">
              {formatMoney(Number(amount), context.currency)}
            </p>
          </article>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[#1b1917]">Booking balances</h2>
        {summaries.length === 0 ? (
          <div className="soft-panel p-8 text-center text-sm text-[#68635e]">
            Financial records will appear after a booking request is confirmed.
          </div>
        ) : (
          summaries.map(({ booking, ledger }) => {
            const depositRemainingMinor = Math.max(
              0,
              booking.depositMinor - ledger.depositHeldMinor,
            );
            const refundableMinor = Math.max(
              0,
              ledger.paidMinor - ledger.refundedMinor,
            );
            return (
              <details key={booking.id} className="soft-panel overflow-hidden">
                <summary className="cursor-pointer list-none p-5">
                  <div className="grid items-center gap-4 md:grid-cols-[1.4fr_repeat(3,0.7fr)]">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#817a73]">
                        {booking.reference} · {booking.status}
                      </p>
                      <p className="mt-1 font-semibold text-[#171513]">
                        {booking.customer.name} · {booking.vehicle.registration}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-[#77716a]">Owed</p>
                      <p className="font-semibold">{formatMoney(ledger.owedMinor, booking.currency)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#77716a]">Net received</p>
                      <p className="font-semibold">{formatMoney(refundableMinor, booking.currency)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#77716a]">Balance</p>
                      <p className={`font-semibold ${ledger.balanceMinor > 0 ? "text-[#a24d00]" : "text-[#28734a]"}`}>
                        {formatMoney(ledger.balanceMinor, booking.currency)}
                      </p>
                    </div>
                  </div>
                </summary>

                <div className="grid gap-4 border-t border-[#ece7e1] p-5 xl:grid-cols-2">
                  {["CONFIRMED", "ACTIVE", "COMPLETED"].includes(booking.status) ? (
                    <form action={paymentAction} className="grid gap-2 rounded-2xl bg-[#f7f5f2] p-4 sm:grid-cols-2">
                      <input type="hidden" name="bookingId" value={booking.id} />
                      <p className="sm:col-span-2 text-sm font-semibold">Record payment</p>
                      <input name="amount" type="number" min="0.01" step="0.01" required placeholder="Amount" className="soft-field" />
                      <select name="method" defaultValue="Cash" className="soft-field">
                        <option>Cash</option>
                        <option>Bank transfer</option>
                        <option>Card terminal</option>
                        <option>Other</option>
                      </select>
                      <input name="reference" placeholder="Receipt/reference" className="soft-field" />
                      <button className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white">Record payment</button>
                    </form>
                  ) : null}

                  {booking.depositMinor > 0 && depositRemainingMinor > 0 && ["CONFIRMED", "ACTIVE"].includes(booking.status) ? (
                    <form action={holdDepositAction} className="grid gap-2 rounded-2xl bg-[#f7f5f2] p-4 sm:grid-cols-2">
                      <input type="hidden" name="bookingId" value={booking.id} />
                      <p className="sm:col-span-2 text-sm font-semibold">
                        Receive deposit · {formatMoney(depositRemainingMinor, booking.currency)} remaining
                      </p>
                      <input name="amount" type="number" min="0.01" max={(depositRemainingMinor / 100).toFixed(2)} step="0.01" required placeholder="Amount" className="soft-field" />
                      <select name="method" defaultValue="Cash" className="soft-field">
                        <option>Cash</option>
                        <option>Bank transfer</option>
                        <option>Card terminal</option>
                      </select>
                      <input name="reference" placeholder="Deposit receipt" className="soft-field" />
                      <button className="rounded-xl border border-black px-4 py-2 text-sm font-semibold">Hold deposit</button>
                    </form>
                  ) : null}

                  {refundableMinor > 0 ? (
                    <form action={refundAction} className="grid gap-2 rounded-2xl bg-[#fff5f3] p-4 sm:grid-cols-2">
                      <input type="hidden" name="bookingId" value={booking.id} />
                      <p className="sm:col-span-2 text-sm font-semibold text-[#8f3933]">
                        Record customer refund · maximum {formatMoney(refundableMinor, booking.currency)}
                      </p>
                      <input name="amount" type="number" min="0.01" max={(refundableMinor / 100).toFixed(2)} step="0.01" required placeholder="Refund amount" className="soft-field" />
                      <input name="reference" required placeholder="Refund reference" className="soft-field" />
                      <input name="notes" required placeholder="Refund reason" className="soft-field" />
                      <button className="rounded-xl border border-[#b65d55] px-4 py-2 text-sm font-semibold text-[#8f3933]">Record refund</button>
                    </form>
                  ) : null}

                  {ledger.depositHeldMinor > 0 ? (
                    <form action={releaseDepositAction} className="grid gap-2 rounded-2xl bg-[#f1f6ff] p-4 sm:grid-cols-2">
                      <input type="hidden" name="bookingId" value={booking.id} />
                      <p className="sm:col-span-2 text-sm font-semibold text-[#295f99]">
                        Release deposit · {formatMoney(ledger.depositHeldMinor, booking.currency)} held
                      </p>
                      <input name="amount" type="number" min="0.01" max={(ledger.depositHeldMinor / 100).toFixed(2)} step="0.01" required placeholder="Release amount" className="soft-field" />
                      <input name="reference" required placeholder="Release reference" className="soft-field" />
                      <input name="notes" placeholder="Release notes" className="soft-field" />
                      <button className="rounded-xl border border-[#5f83ad] px-4 py-2 text-sm font-semibold text-[#295f99]">Release deposit</button>
                    </form>
                  ) : null}
                </div>
              </details>
            );
          })
        )}
      </section>

      <section className="soft-panel overflow-hidden">
        <div className="border-b border-[#ece7e1] px-5 py-4">
          <h2 className="text-lg font-semibold text-[#1b1917]">Transaction ledger</h2>
          <p className="text-sm text-[#6d6862]">Append-only financial history for the organization.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead className="bg-[#f7f5f2] text-xs uppercase tracking-[0.08em] text-[#716b65]">
              <tr>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Booking</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Method/reference</th>
                <th className="px-5 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => (
                <tr key={transaction.id} className="border-t border-[#eee9e3]">
                  <td className="px-5 py-4 text-[#6c6660]">{dateFormatter.format(transaction.occurredAt)}</td>
                  <td className="px-5 py-4">
                    <p className="font-medium">{transaction.booking?.reference ?? "Organization"}</p>
                    <p className="text-xs text-[#77716a]">{transaction.booking?.customer.name ?? transaction.notes}</p>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${transactionStyle(transaction.kind)}`}>
                      {transaction.kind.replaceAll("_", " ")}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-[#6c6660]">
                    {transaction.method || "—"}{transaction.reference ? ` · ${transaction.reference}` : ""}
                  </td>
                  <td className="px-5 py-4 text-right font-semibold">
                    {formatMoney(transaction.amountMinor, transaction.currency)}
                  </td>
                </tr>
              ))}
              {transactions.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-[#6d6862]">No financial transactions yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
