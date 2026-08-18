import { describe, it, expect } from "vitest";

import { movementDirection } from "./movement-direction";

describe("movementDirection", () => {
  it("reads an entry as incoming", () => {
    expect(
      movementDirection({ fromWarehouseId: null, toWarehouseId: "wh-1" })
    ).toBe("in");
  });

  it("reads an exit as outgoing", () => {
    expect(
      movementDirection({ fromWarehouseId: "wh-1", toWarehouseId: null })
    ).toBe("out");
  });

  it("reads a transfer as neutral", () => {
    // A transfer is neither a gain nor a loss: the old rule painted it green
    // with a "+", as if the company had received stock from nowhere.
    expect(
      movementDirection({ fromWarehouseId: "wh-1", toWarehouseId: "wh-2" })
    ).toBe("neutral");
  });

  it("reads a negative adjustment as outgoing", () => {
    // AE-25: counting 36 where the system said 39 writes an ADJUSTMENT with
    // quantity 3 and `fromWarehouseId` set. Keying off `type === "EXIT"`
    // rendered it as "+3" in green — the opposite of what happened.
    expect(
      movementDirection({ fromWarehouseId: "wh-1", toWarehouseId: null })
    ).toBe("out");
  });

  it("falls back to neutral when neither warehouse is set", () => {
    expect(
      movementDirection({ fromWarehouseId: null, toWarehouseId: null })
    ).toBe("neutral");
  });
});
