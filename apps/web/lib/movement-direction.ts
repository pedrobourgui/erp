/**
 * Which way a stock movement went, read from the warehouse fields.
 *
 * `type === "EXIT" ? "-" : "+"` was wrong for two of the six movement types: a
 * negative ADJUSTMENT (39 in the system, 36 counted) rendered "+3" in green —
 * the exact opposite of what happened — and a TRANSFER, which is neither a gain
 * nor a loss for the company, rendered as a gain. The direction lives in which
 * warehouse field is filled, which is also how the backend records it.
 *
 * Lives in `lib/` rather than beside the page because a Next.js page module may
 * only export the framework's reserved names plus the default.
 */
export function movementDirection(movement: {
  fromWarehouseId: string | null;
  toWarehouseId: string | null;
}): "in" | "out" | "neutral" {
  const { fromWarehouseId, toWarehouseId } = movement;
  if (fromWarehouseId && toWarehouseId) {return "neutral";}
  if (toWarehouseId) {return "in";}
  if (fromWarehouseId) {return "out";}
  return "neutral";
}
