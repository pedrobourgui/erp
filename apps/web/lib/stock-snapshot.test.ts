import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api", () => ({
  default: { get: vi.fn() },
}));

import api from "@/lib/api";

import { fetchAvailableStock, refreshCartStock } from "./stock-snapshot";

const mockedApi = vi.mocked(api);

const product = (totalAvailable: number) => ({
  data: { data: { inventorySummary: { totalAvailable } } },
});

describe("fetchAvailableStock", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should read the available quantity from inventorySummary", async () => {
    mockedApi.get.mockResolvedValueOnce(product(7));

    await expect(fetchAvailableStock("p1")).resolves.toBe(7);
    expect(mockedApi.get).toHaveBeenCalledWith("/products/p1");
  });

  it("should fall back to the list-shaped inventory field", async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: { data: { inventory: { totalAvailable: 3 } } },
    });

    await expect(fetchAvailableStock("p1")).resolves.toBe(3);
  });

  // A failed refresh must not block a sale the API would accept.
  it("should return null when the request fails", async () => {
    mockedApi.get.mockRejectedValueOnce(new Error("network"));

    await expect(fetchAvailableStock("p1")).resolves.toBeNull();
  });
});

describe("refreshCartStock", () => {
  beforeEach(() => vi.clearAllMocks());

  // VD-21: the cart held the stock as it was during the search.
  it("should report items that no longer fit the fresh stock", async () => {
    mockedApi.get
      .mockResolvedValueOnce(product(1))
      .mockResolvedValueOnce(product(10));

    const result = await refreshCartStock([
      { productId: "p1", quantity: 2, productName: "Widget A" },
      { productId: "p2", quantity: 2, productName: "Widget B" },
    ]);

    expect(result.available).toEqual([1, 10]);
    expect(result.insufficient).toEqual([
      { productName: "Widget A", quantity: 2, available: 1 },
    ]);
  });

  it("should report nothing when every item fits", async () => {
    mockedApi.get.mockResolvedValue(product(50));

    const result = await refreshCartStock([
      { productId: "p1", quantity: 2, productName: "Widget A" },
    ]);

    expect(result.insufficient).toEqual([]);
  });

  it("should ignore items whose stock could not be read", async () => {
    mockedApi.get.mockRejectedValue(new Error("network"));

    const result = await refreshCartStock([
      { productId: "p1", quantity: 99, productName: "Widget A" },
    ]);

    expect(result.available).toEqual([null]);
    expect(result.insufficient).toEqual([]);
  });
});
