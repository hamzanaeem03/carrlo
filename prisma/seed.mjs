import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("CarrloDemo123!", 12);

  const owner = await prisma.user.upsert({
    where: { email: "owner@carrlo.test" },
    update: {},
    create: {
      email: "owner@carrlo.test",
      name: "Demo Owner",
      passwordHash,
    },
  });

  const organization = await prisma.organization.upsert({
    where: { id: "demo-org" },
    update: {},
    create: {
      id: "demo-org",
      name: "Carrlo Demo Rentals",
      currency: "USD",
      timezone: "UTC",
    },
  });

  await prisma.membership.upsert({
    where: {
      userId_organizationId: {
        userId: owner.id,
        organizationId: organization.id,
      },
    },
    update: { role: "OWNER", status: "ACTIVE" },
    create: {
      userId: owner.id,
      organizationId: organization.id,
      role: "OWNER",
      status: "ACTIVE",
    },
  });

  const branch = await prisma.branch.upsert({
    where: { id: "demo-branch" },
    update: {},
    create: {
      id: "demo-branch",
      organizationId: organization.id,
      name: "Main Branch",
      address: "Demo Street, Pilot City",
      timezone: "UTC",
      isDefault: true,
    },
  });

  await prisma.vehicle.upsert({
    where: {
      organizationId_registration: {
        organizationId: organization.id,
        registration: "DEMO-101",
      },
    },
    update: {},
    create: {
      organizationId: organization.id,
      branchId: branch.id,
      registration: "DEMO-101",
      make: "Toyota",
      model: "Corolla",
      year: 2022,
      category: "Sedan",
      transmission: "AUTOMATIC",
      fuelType: "PETROL",
      odometer: 18400,
      seats: 5,
      dailyRateMinor: 6500,
      depositMinor: 20000,
      currency: "USD",
      status: "AVAILABLE",
    },
  });

  await prisma.customer.upsert({
    where: { id: "demo-customer" },
    update: {},
    create: {
      id: "demo-customer",
      organizationId: organization.id,
      branchId: branch.id,
      name: "Avery Pilot",
      email: "avery@example.test",
      phone: "+1 555 0101",
      licenseNumber: "DEMO-LIC-1001",
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
