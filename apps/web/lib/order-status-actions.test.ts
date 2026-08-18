import type { OrderStatus } from "@erp/shared-types";
import { describe, it, expect } from "vitest";

import { getOrderStatusActions, splitOrderActions } from "./order-status-actions";

describe("getOrderStatusActions", () => {
  it("should return no actions for a terminal order", () => {
    expect(getOrderStatusActions([])).toEqual([]);
  });

  it("should return no actions when the API omits the field", () => {
    expect(getOrderStatusActions(undefined)).toEqual([]);
  });

  // VD-02: PICKING used to offer "Marcar como Enviado", which the API rejected
  // with 400 — the order could never leave "Separando".
  it("should offer PACKED (not SHIPPED) while picking", () => {
    const labels = getOrderStatusActions(["PACKED", "CANCELLED"]).map(
      (a) => a.targetStatus
    );

    expect(labels).toContain("PACKED");
    expect(labels).not.toContain("SHIPPED");
  });

  it.each<[OrderStatus, string]>([
    ["PACKED", "Marcar como Embalado"],
    ["COMPLETED", "Concluir Pedido"],
    ["RETURNED", "Registrar Devolução"],
  ])("should label the %s action as %s", (status, label) => {
    const [action] = getOrderStatusActions([status]);

    expect(action.label).toBe(label);
  });

  it("should keep the destructive action last", () => {
    const actions = getOrderStatusActions(["CANCELLED", "CONFIRMED"]);

    expect(actions.map((a) => a.targetStatus)).toEqual([
      "CONFIRMED",
      "CANCELLED",
    ]);
  });

  it("should flag cancellation as requiring a reason", () => {
    const [cancel] = getOrderStatusActions(["CANCELLED"]);

    expect(cancel.requiresReason).toBe(true);
  });

  it("should ignore DRAFT, which no order transitions back into", () => {
    expect(getOrderStatusActions(["DRAFT" as OrderStatus])).toEqual([]);
  });

  // VD-14: the PDV sale is "estornada", not "devolvida".
  it("should call the return of a completed counter sale a reversal", () => {
    const [action] = getOrderStatusActions(["RETURNED"], {
      origin: "BALCAO",
      status: "COMPLETED",
    });

    expect(action.label).toBe("Estornar Venda");
    expect(action.tone).toBe("danger");
    expect(action.requiresReason).toBe(true);
  });

  it("should keep the delivered-order wording", () => {
    const [action] = getOrderStatusActions(["RETURNED"], {
      origin: "MANUAL",
      status: "DELIVERED",
    });

    expect(action.label).toBe("Registrar Devolução");
  });
});

// T5: preenchimento vermelho destrói dado; contorno vermelho reverte dado.
// Cancelar e estornar **revertem** — o pedido continua no sistema, com outro
// status. Vinham em vermelho cheio, o mesmo peso de um "excluir".
describe("tom das ações", () => {
  it("should mark cancelling as danger without making it a filled button", () => {
    const [cancel] = getOrderStatusActions(["CANCELLED"]);

    expect(cancel.tone).toBe("danger");
    expect(cancel.variant).toBe("outline");
  });

  it("should mark a counter-sale reversal as danger, also as outline", () => {
    const [reversal] = getOrderStatusActions(["RETURNED"], {
      origin: "BALCAO",
      status: "COMPLETED",
    });

    expect(reversal.tone).toBe("danger");
    expect(reversal.variant).toBe("outline");
  });

  it("should keep an ordinary transition neutral and primary", () => {
    const [confirm] = getOrderStatusActions(["CONFIRMED"]);

    expect(confirm.tone).toBe("neutral");
    expect(confirm.variant).toBe("default");
  });

  it("should still sort the dangerous action last", () => {
    const actions = getOrderStatusActions(["CANCELLED", "CONFIRMED"]);

    expect(actions.map((a) => a.targetStatus)).toEqual([
      "CONFIRMED",
      "CANCELLED",
    ]);
  });
});

// T10: numa lista, o mesmo botão precisa ficar sempre na mesma coluna. Com
// 1, 2 ou 3 ícones por linha conforme o status, o "olho" media x=1298 numa
// linha, x=1340 na seguinte e x=1375 na outra — memória muscular impossível.
describe("splitOrderActions", () => {
  it("should promote the first action and leave the rest to the menu", () => {
    const actions = getOrderStatusActions(["CONFIRMED", "CANCELLED"]);
    const { primary, overflow } = splitOrderActions(actions);

    expect(primary?.targetStatus).toBe("CONFIRMED");
    expect(overflow.map((a) => a.targetStatus)).toEqual(["CANCELLED"]);
  });

  it("should never promote a dangerous action to the fixed slot", () => {
    const { primary, overflow } = splitOrderActions(
      getOrderStatusActions(["CANCELLED"])
    );

    expect(primary).toBeNull();
    expect(overflow.map((a) => a.targetStatus)).toEqual(["CANCELLED"]);
  });

  it("should handle an order with no transitions left", () => {
    expect(splitOrderActions([])).toEqual({ primary: null, overflow: [] });
  });

  it("should keep a single safe action in the fixed slot, with an empty menu", () => {
    const { primary, overflow } = splitOrderActions(
      getOrderStatusActions(["PACKED"])
    );

    expect(primary?.targetStatus).toBe("PACKED");
    expect(overflow).toEqual([]);
  });
});
