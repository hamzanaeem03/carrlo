import { z } from "zod";

export const customerSchema = z.object({
  branchId: z.string().optional(),
  name: z.string().min(1).max(120),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().min(4).max(40),
  licenseNumber: z.string().max(80).optional(),
});

export type CustomerInput = z.infer<typeof customerSchema>;
