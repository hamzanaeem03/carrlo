import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/server/context";
import { createCustomer, listCustomers } from "@/server/services/customers";
import { prisma } from "@/lib/db";

async function createCustomerAction(formData: FormData) {
  "use server";
  const context = await getTenantContext();
  await createCustomer(context, {
    branchId: String(formData.get("branchId") || ""),
    name: String(formData.get("name")),
    email: String(formData.get("email") || ""),
    phone: String(formData.get("phone")),
    licenseNumber: String(formData.get("licenseNumber") || ""),
  });
  revalidatePath("/dashboard/customers");
}

export default async function CustomersPage() {
  const context = await getTenantContext();
  const [customers, branches] = await Promise.all([
    listCustomers(context),
    prisma.branch.findMany({ where: { organizationId: context.organizationId, isActive: true } }),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-[#252525]">Customers</h1>
        <p className="text-sm text-[#666]">Register renters and retain rental history.</p>
      </header>

      <form action={createCustomerAction} className="grid gap-3 rounded-lg border border-[#eee2d2] bg-white p-4 shadow-sm md:grid-cols-5">
        <select name="branchId" className="rounded-md border px-3 py-2 text-sm">
          <option value="">No branch</option>
          {branches.map((branch) => (
            <option value={branch.id} key={branch.id}>{branch.name}</option>
          ))}
        </select>
        <input name="name" placeholder="Name" required className="rounded-md border px-3 py-2 text-sm" />
        <input name="email" type="email" placeholder="Email" className="rounded-md border px-3 py-2 text-sm" />
        <input name="phone" placeholder="Phone" required className="rounded-md border px-3 py-2 text-sm" />
        <input name="licenseNumber" placeholder="License number" className="rounded-md border px-3 py-2 text-sm" />
        <button className="rounded-md bg-[#252525] px-4 py-2 text-sm font-semibold text-white">Add customer</button>
      </form>

      <section className="overflow-hidden rounded-lg border border-[#eee2d2] bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#FDFBF9] text-[#666]">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">License</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-[#666]">No customers yet.</td></tr>
            ) : (
              customers.map((customer) => (
                <tr key={customer.id} className="border-t border-[#f1e7d9]">
                  <td className="px-4 py-3 font-medium">{customer.name}</td>
                  <td className="px-4 py-3">{customer.phone}</td>
                  <td className="px-4 py-3">{customer.email || "-"}</td>
                  <td className="px-4 py-3">{customer.licenseNumber || "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
