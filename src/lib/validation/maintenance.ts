import { z } from "zod";

export const createMaintenanceSchema = z
  .object({
    vehicleId: z.string().min(1, "Vehicle is required."),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    description: z.string().trim().min(3).max(500),
    costMinor: z.coerce.number().int().nonnegative().default(0),
    odometer: z.coerce.number().int().nonnegative().optional(),
    notes: z.string().trim().max(1000).optional(),
  })
  .refine((value) => value.endsAt > value.startsAt, {
    message: "Maintenance end must be after its start.",
    path: ["endsAt"],
  });

export const maintenanceDecisionSchema = z.object({
  maintenanceId: z.string().min(1),
  costMinor: z.coerce.number().int().nonnegative().optional(),
  odometer: z.coerce.number().int().nonnegative().optional(),
});

