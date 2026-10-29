export function intervalsOverlap(
  leftStart: Date,
  leftEnd: Date,
  rightStart: Date,
  rightEnd: Date,
) {
  if (leftEnd <= leftStart || rightEnd <= rightStart) {
    throw new Error("Invalid interval.");
  }

  // Half-open interval: [start, end). Exact handoff times do not conflict.
  return leftStart < rightEnd && rightStart < leftEnd;
}
