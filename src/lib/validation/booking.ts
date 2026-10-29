import { z } from "zod";

export const createBookingSchema = z
  .object({
    organizationId: z.string().min(1),
    branchId: z.string().min(1),
    customerId: z.string().min(1),
    vehicleId: z.string().min(1),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    notes: z.string().max(1000).optional(),
  })
  .refine((value) => value.endsAt > value.startsAt, {
    message: "End date must be after start date.",
    path: ["endsAt"],
  });

export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const bookingIdSchema = z.string().min(1, "Booking is required.");

export const extendBookingSchema = z.object({
  bookingId: bookingIdSchema,
  endsAt: z.coerce.date(),
});

export const reassignBookingSchema = z.object({
  bookingId: bookingIdSchema,
  vehicleId: z.string().min(1, "Vehicle is required."),
});

export const bookingDecisionSchema = z.object({
  bookingId: bookingIdSchema,
  reason: z.string().trim().max(500).optional(),
});

export const bookingInspectionSchema = z.object({
  odometer: z.coerce.number().int().nonnegative(),
  fuelLevel: z.string().trim().max(50).optional(),
  conditionNotes: z.string().trim().max(1000).optional(),
});
