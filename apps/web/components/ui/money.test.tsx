import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { Money } from "./money";

describe("Money", () => {
  it("should format the value in BRL", () => {
    render(<Money value={1234.5} />);
    expect(screen.getByText("R$ 1.234,50")).toBeInTheDocument();
  });

  it("should line up digits with tabular-nums", () => {
    const { container } = render(<Money value={10} />);
    expect(container.firstElementChild).toHaveClass("tabular-nums");
  });

  it("should never break a value across lines (VD-13)", () => {
    const { container } = render(<Money value={89.9} />);
    expect(container.firstElementChild).toHaveClass("whitespace-nowrap");
  });

  it("should paint a negative value as danger, so a debt reads as one", () => {
    const { container } = render(<Money value={-290} />);
    expect(container.firstElementChild).toHaveClass("text-destructive");
  });

  it("should not paint a positive value as danger", () => {
    const { container } = render(<Money value={290} />);
    expect(container.firstElementChild).not.toHaveClass("text-destructive");
  });

  it("should keep zero neutral — zero is not a debt", () => {
    const { container } = render(<Money value={0} />);
    expect(container.firstElementChild).not.toHaveClass("text-destructive");
    expect(screen.getByText("R$ 0,00")).toBeInTheDocument();
  });

  it("should let a caller opt out of the danger colour", () => {
    const { container } = render(<Money value={-290} signalNegative={false} />);
    expect(container.firstElementChild).not.toHaveClass("text-destructive");
  });

  it("should render null and undefined as R$ 0,00 instead of blowing up", () => {
    render(<Money value={null} />);
    expect(screen.getByText("R$ 0,00")).toBeInTheDocument();
  });

  it("should accept a decimal string from the API without mangling it", () => {
    render(<Money value="1234.5" />);
    expect(screen.getByText("R$ 1.234,50")).toBeInTheDocument();
  });

  it("should merge caller classes", () => {
    const { container } = render(<Money value={10} className="font-bold" />);
    expect(container.firstElementChild).toHaveClass("font-bold");
  });
});
