import { z } from "zod";

export const vehicleSchema = z.object({
  branchId: z.string().min(1),
  registration: z.string().min(2).max(40),
  make: z.string().min(1).max(80),
  model: z.string().min(1).max(80),
  year: z.number().int().min(1950).max(2100),
  category: z.string().min(1).max(80),
  seats: z.number().int().min(1).max(80),
  dailyRateMinor: z.number().int().min(0),
  depositMinor: z.number().int().min(0).default(0),
});

export type VehicleInput = z.infer<typeof vehicleSchema>;
