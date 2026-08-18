import { describe, it, expect } from "vitest";

import { toCategoryOptions, toEntityOptions } from "./category-options";

describe("toCategoryOptions", () => {
  it("returns nothing for an empty or missing tree", () => {
    expect(toCategoryOptions(undefined)).toEqual([]);
    expect(toCategoryOptions([])).toEqual([]);
  });

  it("maps a flat tree to id/name options", () => {
    const options = toCategoryOptions([
      { id: "cat-1", name: "Eletrônicos", _count: { products: 4 } },
    ]);

    // The value is the id — the name is what the broken text filter sent, and
    // it never matched anything (FT-01).
    expect(options).toEqual([
      { value: "cat-1", label: "Eletrônicos", hint: "(4)" },
    ]);
  });

  it("indents the children so the hierarchy is readable in a flat list", () => {
    const options = toCategoryOptions([
      {
        id: "eletronicos",
        name: "Eletrônicos",
        children: [{ id: "audio", name: "Áudio" }],
      },
    ]);

    expect(options.map((o) => o.value)).toEqual(["eletronicos", "audio"]);
    expect(options[1].label).toMatch(/^\s+Áudio$/);
    expect(options[0].label).toBe("Eletrônicos");
  });

  it("walks depth first, so a child follows its own parent", () => {
    const options = toCategoryOptions([
      { id: "a", name: "A", children: [{ id: "a1", name: "A1" }] },
      { id: "b", name: "B" },
    ]);

    expect(options.map((o) => o.value)).toEqual(["a", "a1", "b"]);
  });

  it("omits the hint when the count is absent", () => {
    const options = toCategoryOptions([{ id: "c", name: "Sem contagem" }]);

    expect(options[0].hint).toBeUndefined();
  });

  it("keeps a zero count instead of hiding it", () => {
    // "(0)" is useful: it tells the operator this filter returns nothing.
    const options = toCategoryOptions([
      { id: "c", name: "Vazia", _count: { products: 0 } },
    ]);

    expect(options[0].hint).toBe("(0)");
  });

  it("survives a cycle in the tree instead of overflowing the stack", () => {
    const parent: Parameters<typeof toCategoryOptions>[0] = [
      { id: "a", name: "A", children: [] },
    ];
    parent[0].children = [{ id: "b", name: "B", children: parent }];

    const options = toCategoryOptions(parent);

    expect(options.map((o) => o.value)).toEqual(["a", "b"]);
  });
});

describe("toEntityOptions", () => {
  it("maps a plain list", () => {
    expect(toEntityOptions([{ id: "w1", name: "Depósito Central" }])).toEqual([
      { value: "w1", label: "Depósito Central" },
    ]);
  });

  it("tolerates undefined while the query is still loading", () => {
    expect(toEntityOptions(undefined)).toEqual([]);
  });
});
