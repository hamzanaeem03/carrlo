import type { BookingStatus } from "@prisma/client";

const transitions: Record<BookingStatus, readonly BookingStatus[]> = {
  REQUESTED: ["CONFIRMED", "REJECTED", "CANCELLED"],
  PENDING: ["CONFIRMED", "REJECTED", "CANCELLED"],
  CONFIRMED: ["ACTIVE", "CANCELLED"],
  ACTIVE: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
  REJECTED: [],
};

export function canTransitionBooking(
  from: BookingStatus,
  to: BookingStatus,
) {
  return transitions[from].includes(to);
}

export function assertBookingTransition(
  from: BookingStatus,
  to: BookingStatus,
) {
  if (!canTransitionBooking(from, to)) {
    throw new Error(`Booking cannot move from ${from} to ${to}.`);
  }
}

