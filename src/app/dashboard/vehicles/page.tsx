import Link from "next/link";
import { revalidatePath } from "next/cache";
import {
  AirlineSeatReclineNormalRounded as AirlineSeatReclineNormalRoundedIcon,
  DirectionsCarRounded as DirectionsCarRoundedIcon,
  EventAvailableRounded as EventAvailableRoundedIcon,
  MoreVertRounded as MoreVertRoundedIcon,
  PlaceRounded as PlaceRoundedIcon,
  SettingsRounded as SettingsRoundedIcon,
  SpeedRounded as SpeedRoundedIcon,
} from "@mui/icons-material";
import { getTenantContext } from "@/server/context";
import { createVehicle, listVehicles } from "@/server/services/vehicles";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";

type SearchParams = {
  q?: string;
  status?: string;
  category?: string;
};

const vehiclePaint = [
  "from-[#fb3838] via-[#ff5d45] to-[#c90f19]",
  "from-[#d8dad8] via-[#f6f6f4] to-[#7d8586]",
  "from-[#48613a] via-[#77895c] to-[#26351f]",
  "from-[#d86b21] via-[#f59c35] to-[#913714]",
  "from-[#13b7c8] via-[#42d6dc] to-[#087a8d]",
  "from-[#222] via-[#666] to-[#111]",
];

async function createVehicleAction(formData: FormData) {
  "use server";
  const context = await getTenantContext();
  await createVehicle(context, {
    branchId: String(formData.get("branchId")),
    registration: String(formData.get("registration")),
    make: String(formData.get("make")),
    model: String(formData.get("model")),
    year: Number(formData.get("year")),
    category: String(formData.get("category")),
    seats: Number(formData.get("seats")),
    dailyRateMinor: Math.round(Number(formData.get("dailyRate")) * 100),
    depositMinor: Math.round(Number(formData.get("deposit")) * 100),
  });
  revalidatePath("/dashboard/vehicles");
  revalidatePath("/dashboard");
}

function CarArtwork({
  name,
  index,
  large = false,
}: {
  name: string;
  index: number;
  large?: boolean;
}) {
  return (
    <div
      className={`relative mx-auto flex items-end justify-center overflow-hidden ${
        large ? "h-56" : "h-36"
      }`}
      aria-label={name}
    >
      <div
        className={`absolute bottom-8 h-12 rounded-[999px] bg-gradient-to-r ${
          vehiclePaint[index % vehiclePaint.length]
        } shadow-[0_20px_35px_rgba(0,0,0,0.18)] ${
          large ? "w-[82%]" : "w-[86%]"
        }`}
      />
      <div
        className={`absolute bottom-[78px] rounded-t-[60px] bg-gradient-to-r from-white/70 via-white/40 to-black/20 ${
          large ? "h-16 w-[42%]" : "h-12 w-[42%]"
        }`}
      />
      <div className="absolute bottom-7 left-[21%] h-12 w-12 rounded-full border-[9px] border-[#1f1f1f] bg-[#d9d9d9] shadow-md" />
      <div className="absolute bottom-7 right-[21%] h-12 w-12 rounded-full border-[9px] border-[#1f1f1f] bg-[#d9d9d9] shadow-md" />
      <div className="absolute bottom-20 left-[16%] h-3 w-[68%] rounded-full bg-white/30" />
    </div>
  );
}

function normalize(value?: string) {
  return value?.trim().toLowerCase() ?? "";
}

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const context = await getTenantContext();
  const [vehicles, branches] = await Promise.all([
    listVehicles(context),
    prisma.branch.findMany({
      where: { organizationId: context.organizationId, isActive: true },
      orderBy: { isDefault: "desc" },
    }),
  ]);

  const q = normalize(searchParams?.q);
  const status = searchParams?.status ?? "";
  const category = searchParams?.category ?? "";

  const filteredVehicles = vehicles.filter((vehicle) => {
    const searchable = [
      vehicle.registration,
      vehicle.make,
      vehicle.model,
      vehicle.category,
      vehicle.branch.name,
    ]
      .join(" ")
      .toLowerCase();

    return (
      (!q || searchable.includes(q)) &&
      (!status || vehicle.status === status) &&
      (!category || vehicle.category === category)
    );
  });

  const selectedVehicle = filteredVehicles[0] ?? vehicles[0];
  const categories = Array.from(new Set(vehicles.map((vehicle) => vehicle.category)));
  const availableCount = vehicles.filter((vehicle) => vehicle.status === "AVAILABLE").length;
  const rentedCount = vehicles.filter((vehicle) => vehicle.status === "RENTED").length;
  const maintenanceCount = vehicles.filter((vehicle) => vehicle.status === "MAINTENANCE").length;
  const metricCards: {
    label: string;
    value: number;
    Icon: typeof DirectionsCarRoundedIcon;
  }[] = [
    { label: "Available Cars", value: availableCount, Icon: DirectionsCarRoundedIcon },
    { label: "Currently Rented", value: rentedCount, Icon: EventAvailableRoundedIcon },
    { label: "In Service", value: maintenanceCount, Icon: SettingsRoundedIcon },
  ];

  return (
    <div className="space-y-8">
      <section className="grid gap-5 xl:grid-cols-[1fr_820px]">
        <div>
          <h1 className="text-4xl font-semibold tracking-[0] text-black">
            Available Cars
          </h1>
          <p className="mt-3 text-lg text-[#68615b]">
            {availableCount} vehicles available for rent
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {metricCards.map(({ label, value, Icon }) => (
            <article key={label} className="soft-panel flex items-center gap-4 p-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#f7f5f2]">
                <Icon fontSize="small" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-[#706b65]">{label}</p>
                <p className="text-2xl font-semibold text-black">{value}</p>
              </div>
              <MoreVertRoundedIcon className="text-[#706b65]" fontSize="small" />
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[380px_minmax(520px,1fr)_460px]">
        <aside className="soft-panel h-fit p-5">
          <form className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Filter by</h2>
              <Link href="/dashboard/vehicles" className="text-sm text-[#6a6560]">
                Reset all
              </Link>
            </div>

            <label className="block">
              <span className="text-sm font-semibold">Search</span>
              <input
                name="q"
                defaultValue={searchParams?.q ?? ""}
                placeholder="Plate, make, model"
                className="soft-field mt-2 w-full"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold">Operational status</span>
              <select name="status" defaultValue={status} className="soft-field mt-2 w-full">
                <option value="">Any status</option>
                <option value="AVAILABLE">Available</option>
                <option value="RENTED">Rented</option>
                <option value="MAINTENANCE">Maintenance</option>
                <option value="UNAVAILABLE">Unavailable</option>
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-semibold">Vehicle type</span>
              <select name="category" defaultValue={category} className="soft-field mt-2 w-full">
                <option value="">Any category</option>
                {categories.map((item) => (
                  <option value={item} key={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <button className="h-12 w-full rounded-2xl bg-black text-sm font-semibold text-white">
              Apply filters
            </button>
          </form>

          <div className="my-6 h-px bg-[#ece6df]" />

          <form action={createVehicleAction} className="space-y-3">
            <h3 className="text-lg font-semibold">Quick add vehicle</h3>
            <select name="branchId" required className="soft-field w-full">
              {branches.map((branch) => (
                <option value={branch.id} key={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
            <input name="registration" placeholder="Plate / registration" required className="soft-field w-full" />
            <div className="grid grid-cols-2 gap-3">
              <input name="make" placeholder="Make" required className="soft-field w-full" />
              <input name="model" placeholder="Model" required className="soft-field w-full" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input name="year" type="number" placeholder="Year" required className="soft-field w-full" />
              <input name="category" placeholder="Category" required className="soft-field w-full" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <input name="seats" type="number" min="1" defaultValue="5" required className="soft-field w-full" />
              <input name="dailyRate" type="number" min="0" step="0.01" placeholder="Rate" required className="soft-field w-full" />
              <input name="deposit" type="number" min="0" step="0.01" placeholder="Deposit" required className="soft-field w-full" />
            </div>
            <button className="h-12 w-full rounded-2xl bg-black text-sm font-semibold text-white">
              Add vehicle
            </button>
          </form>
        </aside>

        <section className="grid h-fit gap-4 lg:grid-cols-2">
          {filteredVehicles.length === 0 ? (
            <div className="soft-panel col-span-full p-8 text-center text-[#6a6560]">
              No vehicles match these filters.
            </div>
          ) : (
            filteredVehicles.map((vehicle, index) => (
              <article key={vehicle.id} className="soft-panel overflow-hidden p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold">
                      {vehicle.make} {vehicle.model}
                    </h2>
                    <p className="mt-1 text-sm text-[#68615b]">
                      {vehicle.registration} / {vehicle.category}
                    </p>
                  </div>
                  <span
                    className={`status-pill ${
                      vehicle.status === "AVAILABLE"
                        ? "bg-[#e8f7ed] text-[#207a3d]"
                        : vehicle.status === "RENTED"
                          ? "bg-[#fff3da] text-[#a46400]"
                          : "bg-[#f0eeee] text-[#5f5a55]"
                    }`}
                  >
                    {vehicle.status.toLowerCase()}
                  </span>
                </div>

                <CarArtwork
                  name={`${vehicle.make} ${vehicle.model}`}
                  index={index}
                />

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[#68615b]">
                  <span className="inline-flex items-center gap-1">
                    <AirlineSeatReclineNormalRoundedIcon fontSize="small" />
                    {vehicle.seats} seats
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <SpeedRoundedIcon fontSize="small" />
                    {vehicle.odometer.toLocaleString()} mi
                  </span>
                  <strong className="text-base text-black">
                    {formatMoney(vehicle.dailyRateMinor, vehicle.currency)}
                    <span className="text-sm font-normal text-[#68615b]"> /day</span>
                  </strong>
                </div>
              </article>
            ))
          )}
        </section>

        <aside className="soft-panel h-fit p-5">
          {selectedVehicle ? (
            <>
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f7f5f2]">
                  <DirectionsCarRoundedIcon fontSize="small" />
                </div>
                <MoreVertRoundedIcon />
              </div>

              <CarArtwork
                name={`${selectedVehicle.make} ${selectedVehicle.model}`}
                index={Math.max(0, vehicles.findIndex((vehicle) => vehicle.id === selectedVehicle.id))}
                large
              />

              <div className="mt-3 flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-semibold">
                    {selectedVehicle.make} {selectedVehicle.model}
                  </h2>
                  <p className="mt-2 text-[#68615b]">
                    {selectedVehicle.status.toLowerCase()} / {selectedVehicle.year}
                  </p>
                </div>
                <p className="text-4xl font-semibold">
                  {formatMoney(selectedVehicle.dailyRateMinor, selectedVehicle.currency).replace(".00", "")}
                  <span className="text-base font-normal text-[#68615b]"> /day</span>
                </p>
              </div>

              <div className="my-6 h-px bg-[#ece6df]" />

              <h3 className="mb-3 text-lg font-semibold">Location</h3>
              <div className="relative h-48 overflow-hidden rounded-[22px] bg-[#e8e8e3]">
                <div className="absolute inset-0 opacity-70 [background-image:linear-gradient(#d7d7d2_1px,transparent_1px),linear-gradient(90deg,#d7d7d2_1px,transparent_1px)] [background-size:42px_42px]" />
                <div className="absolute left-12 top-24 h-1 w-44 rotate-[-10deg] rounded-full bg-black" />
                <div className="absolute right-12 top-20 h-6 w-10 rounded-full bg-[#ef2e2e] shadow-md" />
                <PlaceRoundedIcon className="absolute left-10 top-[84px]" />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                {[
                  ["Plate", selectedVehicle.registration],
                  ["Transmission", selectedVehicle.transmission ?? "Not set"],
                  ["Fuel Type", selectedVehicle.fuelType ?? "Not set"],
                  ["Mileage", `${selectedVehicle.odometer.toLocaleString()} mi`],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl bg-[#f7f5f2] p-3">
                    <p className="text-sm text-[#706b65]">{label}</p>
                    <p className="mt-1 font-semibold">{value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <Link
                  href="/dashboard/bookings"
                  className="flex h-14 items-center justify-center rounded-2xl bg-black text-sm font-semibold text-white"
                >
                  Book Vehicle
                </Link>
                <div className="flex h-14 items-center justify-center rounded-2xl bg-[#f7f5f2] text-sm font-semibold">
                  {formatMoney(selectedVehicle.depositMinor, selectedVehicle.currency)} deposit
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-[#68615b]">
              Add a vehicle to see its operational details.
            </p>
          )}
        </aside>
      </section>
    </div>
  );
}
