-- Carrlo initial PostgreSQL schema.
-- Booking concurrency rule for v1: service transactions must lock the assigned
-- vehicle row with SELECT ... FOR UPDATE before checking overlapping bookings.
-- Prisma cannot model that transaction policy directly, so it is implemented in
-- server/services/bookings.ts and covered by integration-test placeholders.

CREATE TYPE "Role" AS ENUM ('OWNER', 'MANAGER', 'STAFF', 'FINANCE');
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'INVITED', 'DISABLED');
CREATE TYPE "VehicleStatus" AS ENUM ('AVAILABLE', 'RENTED', 'MAINTENANCE', 'UNAVAILABLE', 'ARCHIVED');
CREATE TYPE "Transmission" AS ENUM ('AUTOMATIC', 'MANUAL');
CREATE TYPE "FuelType" AS ENUM ('PETROL', 'DIESEL', 'HYBRID', 'ELECTRIC', 'OTHER');
CREATE TYPE "BookingStatus" AS ENUM ('REQUESTED', 'PENDING', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'REJECTED');
CREATE TYPE "PaymentKind" AS ENUM ('CHARGE', 'PAYMENT', 'REFUND', 'DEPOSIT_HELD', 'DEPOSIT_RELEASED', 'ADJUSTMENT');
CREATE TYPE "MaintenanceStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "InspectionType" AS ENUM ('PICKUP', 'RETURN', 'AD_HOC');
CREATE TYPE "DamageStatus" AS ENUM ('OPEN', 'REPAIRING', 'RESOLVED', 'WRITTEN_OFF');
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'STATUS_CHANGE', 'PAYMENT_RECORDED', 'PICKUP_RECORDED', 'RETURN_RECORDED');

CREATE TABLE "User" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "passwordHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "Organization" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "timezone" TEXT NOT NULL DEFAULT 'UTC',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "Membership" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "role" "Role" NOT NULL,
  "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  UNIQUE ("userId", "organizationId")
);

CREATE TABLE "Branch" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "address" TEXT,
  "timezone" TEXT NOT NULL DEFAULT 'UTC',
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "Vehicle" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "branchId" TEXT NOT NULL REFERENCES "Branch"("id"),
  "registration" TEXT NOT NULL,
  "make" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "category" TEXT NOT NULL,
  "transmission" "Transmission",
  "fuelType" "FuelType",
  "odometer" INTEGER NOT NULL DEFAULT 0,
  "seats" INTEGER NOT NULL DEFAULT 4,
  "dailyRateMinor" INTEGER NOT NULL,
  "depositMinor" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "status" "VehicleStatus" NOT NULL DEFAULT 'AVAILABLE',
  "description" TEXT,
  "notes" TEXT,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  UNIQUE ("organizationId", "registration")
);

CREATE TABLE "Customer" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "branchId" TEXT REFERENCES "Branch"("id"),
  "name" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT NOT NULL,
  "address" TEXT,
  "licenseNumber" TEXT,
  "licenseExpiry" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "Booking" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "branchId" TEXT NOT NULL REFERENCES "Branch"("id"),
  "customerId" TEXT NOT NULL REFERENCES "Customer"("id"),
  "vehicleId" TEXT NOT NULL REFERENCES "Vehicle"("id"),
  "reference" TEXT NOT NULL,
  "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "actualPickupAt" TIMESTAMP(3),
  "actualReturnAt" TIMESTAMP(3),
  "pickupOdometer" INTEGER,
  "returnOdometer" INTEGER,
  "pickupFuelLevel" TEXT,
  "returnFuelLevel" TEXT,
  "dailyRateMinor" INTEGER NOT NULL,
  "depositMinor" INTEGER NOT NULL DEFAULT 0,
  "chargesMinor" INTEGER NOT NULL,
  "discountMinor" INTEGER NOT NULL DEFAULT 0,
  "taxMinor" INTEGER NOT NULL DEFAULT 0,
  "totalMinor" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "notes" TEXT,
  "cancellationReason" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  UNIQUE ("organizationId", "reference")
);

CREATE TABLE "BookingStatusHistory" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "bookingId" TEXT NOT NULL REFERENCES "Booking"("id") ON DELETE CASCADE,
  "fromStatus" "BookingStatus",
  "toStatus" "BookingStatus" NOT NULL,
  "reason" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "PaymentTransaction" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "bookingId" TEXT REFERENCES "Booking"("id"),
  "kind" "PaymentKind" NOT NULL,
  "amountMinor" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "method" TEXT,
  "reference" TEXT,
  "idempotencyKey" TEXT,
  "notes" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("organizationId", "idempotencyKey")
);

CREATE TABLE "MaintenanceRecord" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "branchId" TEXT NOT NULL REFERENCES "Branch"("id"),
  "vehicleId" TEXT NOT NULL REFERENCES "Vehicle"("id"),
  "status" "MaintenanceStatus" NOT NULL DEFAULT 'SCHEDULED',
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "odometer" INTEGER,
  "description" TEXT NOT NULL,
  "costMinor" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "Inspection" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "vehicleId" TEXT NOT NULL REFERENCES "Vehicle"("id"),
  "bookingId" TEXT REFERENCES "Booking"("id"),
  "type" "InspectionType" NOT NULL,
  "odometer" INTEGER,
  "fuelLevel" TEXT,
  "conditionNotes" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "DamageRecord" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "vehicleId" TEXT NOT NULL REFERENCES "Vehicle"("id"),
  "bookingId" TEXT REFERENCES "Booking"("id"),
  "inspectionId" TEXT REFERENCES "Inspection"("id"),
  "status" "DamageStatus" NOT NULL DEFAULT 'OPEN',
  "description" TEXT NOT NULL,
  "estimatedCostMinor" INTEGER NOT NULL DEFAULT 0,
  "finalCostMinor" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "FileAsset" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "vehicleId" TEXT REFERENCES "Vehicle"("id"),
  "customerId" TEXT REFERENCES "Customer"("id"),
  "storageKey" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "documentType" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT REFERENCES "Organization"("id") ON DELETE SET NULL,
  "actorUserId" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "action" "AuditAction" NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "message" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "Membership_organizationId_role_idx" ON "Membership"("organizationId", "role");
CREATE INDEX "Branch_organizationId_isActive_idx" ON "Branch"("organizationId", "isActive");
CREATE INDEX "Vehicle_organizationId_status_idx" ON "Vehicle"("organizationId", "status");
CREATE INDEX "Vehicle_branchId_status_idx" ON "Vehicle"("branchId", "status");
CREATE INDEX "Customer_organizationId_name_idx" ON "Customer"("organizationId", "name");
CREATE INDEX "Customer_organizationId_phone_idx" ON "Customer"("organizationId", "phone");
CREATE INDEX "Booking_organizationId_status_startsAt_idx" ON "Booking"("organizationId", "status", "startsAt");
CREATE INDEX "Booking_vehicleId_startsAt_endsAt_idx" ON "Booking"("vehicleId", "startsAt", "endsAt");
CREATE INDEX "Booking_customerId_startsAt_idx" ON "Booking"("customerId", "startsAt");
CREATE INDEX "BookingStatusHistory_bookingId_createdAt_idx" ON "BookingStatusHistory"("bookingId", "createdAt");
CREATE INDEX "PaymentTransaction_organizationId_kind_occurredAt_idx" ON "PaymentTransaction"("organizationId", "kind", "occurredAt");
CREATE INDEX "PaymentTransaction_bookingId_occurredAt_idx" ON "PaymentTransaction"("bookingId", "occurredAt");
CREATE INDEX "MaintenanceRecord_organizationId_status_startsAt_idx" ON "MaintenanceRecord"("organizationId", "status", "startsAt");
CREATE INDEX "MaintenanceRecord_vehicleId_startsAt_endsAt_idx" ON "MaintenanceRecord"("vehicleId", "startsAt", "endsAt");
CREATE INDEX "Inspection_vehicleId_createdAt_idx" ON "Inspection"("vehicleId", "createdAt");
CREATE INDEX "Inspection_bookingId_type_idx" ON "Inspection"("bookingId", "type");
CREATE INDEX "DamageRecord_vehicleId_status_idx" ON "DamageRecord"("vehicleId", "status");
CREATE INDEX "DamageRecord_bookingId_idx" ON "DamageRecord"("bookingId");
CREATE INDEX "FileAsset_organizationId_documentType_idx" ON "FileAsset"("organizationId", "documentType");
CREATE INDEX "FileAsset_vehicleId_idx" ON "FileAsset"("vehicleId");
CREATE INDEX "FileAsset_customerId_idx" ON "FileAsset"("customerId");
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");
