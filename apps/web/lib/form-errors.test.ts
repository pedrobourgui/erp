import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  firstErrorElement,
  scrollToFirstError,
  scheduleScrollToFirstError,
} from "./form-errors";

function mount(html: string): HTMLElement {
  const host = document.createElement("form");
  host.innerHTML = html;
  document.body.appendChild(host);
  return host;
}

describe("firstErrorElement", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("should return null when the container has no error", () => {
    const form = mount(`<input name="a" /><p class="text-xs">ok</p>`);
    expect(firstErrorElement(form)).toBeNull();
  });

  it("should return null when there is no container", () => {
    expect(firstErrorElement(null)).toBeNull();
    expect(firstErrorElement(undefined)).toBeNull();
  });

  it("should find the error message rendered by a field", () => {
    const form = mount(
      `<input name="a" /><p class="text-xs text-destructive">Selecione um cliente</p>`
    );
    expect(firstErrorElement(form)?.textContent).toBe("Selecione um cliente");
  });

  it("should find a control flagged with aria-invalid", () => {
    const form = mount(`<input name="a" aria-invalid="true" />`);
    expect(firstErrorElement(form)?.tagName).toBe("INPUT");
  });

  it("should return the first error in document order, not the last", () => {
    const form = mount(
      `<p class="text-destructive">primeiro</p><p class="text-destructive">segundo</p>`
    );
    expect(firstErrorElement(form)?.textContent).toBe("primeiro");
  });
});

describe("scrollToFirstError", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("should return false and scroll nothing when there is no error", () => {
    const form = mount(`<input name="a" />`);
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;

    expect(scrollToFirstError(form)).toBe(false);
    expect(scroll).not.toHaveBeenCalled();
  });

  it("should scroll the first error into view", () => {
    const form = mount(
      `<div><input name="a" /><p class="text-destructive">Selecione um cliente</p></div>`
    );
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;

    expect(scrollToFirstError(form)).toBe(true);
    expect(scroll).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "center",
    });
  });

  it("should focus the control next to the error message", () => {
    const form = mount(
      `<div><input name="a" /><p class="text-destructive">obrigatório</p></div>`
    );
    Element.prototype.scrollIntoView = vi.fn();

    scrollToFirstError(form);

    expect(document.activeElement).toBe(form.querySelector("input"));
  });

  it("should focus the control itself when it carries aria-invalid", () => {
    const form = mount(`<input name="a" aria-invalid="true" />`);
    Element.prototype.scrollIntoView = vi.fn();

    scrollToFirstError(form);

    expect(document.activeElement).toBe(form.querySelector("input"));
  });
});

describe("scheduleScrollToFirstError", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("should look for the error only after the render, not in the same tick", async () => {
    const form = mount(`<div><input name="a" /></div>`);
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;

    scheduleScrollToFirstError(() => form);

    // O erro só chega ao DOM depois — é exatamente o que acontece quando o
    // react-hook-form chama onInvalid antes do commit do React.
    expect(scroll).not.toHaveBeenCalled();
    const late = document.createElement("p");
    late.className = "text-destructive";
    late.textContent = "Selecione um cliente";
    form.firstElementChild?.appendChild(late);

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(scroll).toHaveBeenCalledTimes(1);
  });

  it("should resolve the container lazily, so a ref filled later still works", async () => {
    Element.prototype.scrollIntoView = vi.fn();
    let form: HTMLElement | null = null;

    scheduleScrollToFirstError(() => form);
    form = mount(`<p class="text-destructive">obrigatório</p>`);

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1);
  });
});
