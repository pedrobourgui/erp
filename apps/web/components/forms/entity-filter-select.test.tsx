import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError } from "axios";
import React from "react";
import { describe, it, expect, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

import { EntityFilterSelect, ALL_VALUE } from "./entity-filter-select";

/** `isPermissionError` narrows on a real AxiosError — a plain object is not one. */
function axiosErrorWithStatus(status: number): AxiosError {
  const error = new AxiosError("falhou");
  error.response = { status } as AxiosError["response"];
  return error;
}

const OPTIONS = [
  { value: "cat-1", label: "Eletrônicos", hint: "(4)" },
  { value: "cat-2", label: "Acessórios", hint: "(2)" },
];

function renderSelect(props: Partial<React.ComponentProps<typeof EntityFilterSelect>> = {}) {
  const onChange = vi.fn();
  render(
    <TooltipProvider>
      <EntityFilterSelect
        label="Categoria"
        value=""
        onChange={onChange}
        options={OPTIONS}
        allLabel="Todas as categorias"
        {...props}
      />
    </TooltipProvider>
  );
  return { onChange };
}

describe("EntityFilterSelect", () => {
  it("renders the label and the no-filter option as the current value", () => {
    renderSelect();

    expect(screen.getByText("Categoria")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveTextContent("Todas as categorias");
  });

  it("uses the __all sentinel instead of an empty string", async () => {
    // Radix reads "" as "no value", which wipes the placeholder and leaves the
    // trigger blank. The two native <select> filters that used "" were FT-09.
    const { onChange } = renderSelect({ value: "cat-1" });

    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(screen.getByRole("option", { name: /Todas as categorias/ }));

    expect(onChange).toHaveBeenCalledWith("");
    expect(ALL_VALUE).toBe("__all");
  });

  it("reports the chosen option by its id", async () => {
    const { onChange } = renderSelect();

    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(screen.getByRole("option", { name: /Eletrônicos/ }));

    // FT-01: the id is what the API filters by — the name never worked.
    expect(onChange).toHaveBeenCalledWith("cat-1");
  });

  it("disables itself and says so while the options load", () => {
    renderSelect({ isLoading: true, options: [] });

    const trigger = screen.getByRole("combobox");
    expect(trigger).toBeDisabled();
    // An empty select reads as "nothing is registered" — say "Carregando..."
    expect(trigger).toHaveTextContent("Carregando...");
  });

  it("hides entirely when the user cannot read the entity", () => {
    // AE-28: offering a filter that can never be populated is noise.
    const error = axiosErrorWithStatus(403);
    const { container } = render(
      <EntityFilterSelect
        label="Categoria"
        value=""
        onChange={vi.fn()}
        options={[]}
        allLabel="Todas as categorias"
        error={error}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("shows the reason on a generic failure instead of an empty list", () => {
    const error = axiosErrorWithStatus(500);
    renderSelect({ error, options: [] });

    expect(screen.getByRole("combobox")).toBeDisabled();
    expect(screen.getByText(/não foi possível carregar/i)).toBeInTheDocument();
  });

  it("keeps a selected value that no longer exists in the list", async () => {
    // A category deleted while its filter is active: dropping the option would
    // leave the trigger blank with the table still filtered.
    renderSelect({ value: "cat-removida" });

    await userEvent.click(screen.getByRole("combobox"));
    expect(
      screen.getByRole("option", { name: /Selecionado \(removido\)/ })
    ).toBeInTheDocument();
  });

  it("does not add the orphan option when the value is in the list", async () => {
    renderSelect({ value: "cat-1" });

    await userEvent.click(screen.getByRole("combobox"));
    expect(screen.queryByRole("option", { name: /removido/ })).not.toBeInTheDocument();
  });
});
