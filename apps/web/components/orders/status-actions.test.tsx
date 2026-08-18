import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render as rtlRender, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi } from "vitest";

import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";

import { StatusActions } from "./status-actions";

vi.mock("@/hooks/use-orders", () => ({
  useUpdateOrderStatus: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCancelOrder: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useReverseSale: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

function render(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return rtlRender(
    <QueryClientProvider client={client}>
      <Toaster>
        <TooltipProvider>{ui}</TooltipProvider>
      </Toaster>
    </QueryClientProvider>
  );
}

const base = { orderId: "o1", orderNumber: "PED-000001" };

describe("StatusActions · slot fixo (T10)", () => {
  it("should keep the slots occupied when the order has no transitions left", () => {
    // Um pedido cancelado não oferece ação nenhuma. Se o componente sumir da
    // árvore, o "ver detalhes" que vem antes dele desliza para a direita e
    // aparece na coluna onde, em toda outra linha, está o menu.
    const { container } = render(
      <StatusActions {...base} allowedTransitions={[]} size="icon" />
    );

    expect(container.firstElementChild).not.toBeNull();
    expect(container.querySelectorAll("div.w-10")).toHaveLength(2);
  });

  it("should render nothing at all outside a table row", () => {
    const { container } = render(
      <StatusActions {...base} allowedTransitions={[]} />
    );

    expect(container.firstElementChild).toBeNull();
  });

  it("should put the flow-advancing action in the fixed slot", () => {
    render(
      <StatusActions
        {...base}
        allowedTransitions={["CONFIRMED", "CANCELLED"]}
        size="icon"
      />
    );

    expect(
      screen.getByRole("button", { name: "Confirmar Pedido" })
    ).toBeInTheDocument();
    // O que reverte fica no menu, não no slot.
    expect(
      screen.queryByRole("button", { name: "Cancelar Pedido" })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /mais ações/i })
    ).toBeInTheDocument();
  });

  it("should leave the primary slot empty when the only action reverts", () => {
    const { container } = render(
      <StatusActions {...base} allowedTransitions={["CANCELLED"]} size="icon" />
    );

    expect(container.querySelectorAll("div.w-10")).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: /mais ações/i })
    ).toBeInTheDocument();
  });
});
