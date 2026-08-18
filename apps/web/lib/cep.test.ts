import { describe, it, expect, vi, afterEach } from "vitest";

import { isValidCepFormat, lookupCep } from "./cep";

function mockFetchOnce(payload: unknown, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok, json: async () => payload })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isValidCepFormat", () => {
  it("accepts 8 digits with or without the mask", () => {
    expect(isValidCepFormat("01310100")).toBe(true);
    expect(isValidCepFormat("01310-100")).toBe(true);
  });

  it("rejects anything that is not 8 digits", () => {
    expect(isValidCepFormat("0131010")).toBe(false);
    expect(isValidCepFormat("013101000")).toBe(false);
    expect(isValidCepFormat("")).toBe(false);
  });
});

describe("lookupCep", () => {
  it("maps a ViaCEP answer to the address fields", async () => {
    mockFetchOnce({
      logradouro: "Avenida Paulista",
      bairro: "Bela Vista",
      localidade: "São Paulo",
      uf: "SP",
    });

    const result = await lookupCep("01310-100");

    expect(result).toEqual({
      status: "ok",
      address: {
        street: "Avenida Paulista",
        neighborhood: "Bela Vista",
        city: "São Paulo",
        state: "SP",
      },
    });
  });

  it("treats `{ erro: true }` as not-found, not as success", async () => {
    // AE-16: ViaCEP answers 200 for a well-formed CEP that does not exist.
    // Checking only the status code would clear the form with empty strings.
    mockFetchOnce({ erro: true });

    expect(await lookupCep("99999-999")).toEqual({ status: "not-found" });
  });

  it("reports unavailable when the provider fails", async () => {
    mockFetchOnce({}, false);

    expect(await lookupCep("01310-100")).toEqual({ status: "unavailable" });
  });

  it("reports unavailable when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    expect(await lookupCep("01310-100")).toEqual({ status: "unavailable" });
  });

  it("does not call the provider for a malformed CEP", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(await lookupCep("123")).toEqual({ status: "not-found" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
