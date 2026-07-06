"use client";

import React, { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MoneyInput } from "@/components/forms/money-input";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { PaymentSelector } from "@/components/forms/payment-selector";
import { useCreateOrder } from "@/hooks/use-orders";
import { useCashRegisterSessions } from "@/hooks/use-cash-registers";
import { useToast } from "@/components/ui/toast";
import { formatCurrency, cn } from "@/lib/utils";
import api from "@/lib/api";
import {
  ArrowLeft,
  Save,
  Loader2,
  Trash2,
  Search,
  Package,
  AlertTriangle,
  CheckCircle2,
  ShoppingCart,
  Minus,
  Plus,
} from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import type { PaginatedResponse } from "@erp/shared-types";

// ─── Types ─────────────────────────────────────────────────────────────

interface CustomerOption {
  id: string;
  name: string;
  document: string;
  email: string;
}

interface ProductResult {
  id: string;
  name: string;
  sku: string;
  salePrice: number;
  inventory?: {
    totalQuantity: number;
    totalReserved: number;
    totalAvailable: number;
  };
}

// ─── Validation schema ─────────────────────────────────────────────────

const coerceNumber = (val: unknown) => {
  if (val === "" || val === null || val === undefined) return 0;
  const n = Number(val);
  return Number.isNaN(n) ? 0 : n;
};

const counterSaleItemSchema = z.object({
  productId: z.string().min(1, "Selecione um produto"),
  productName: z.string(),
  sku: z.string(),
  availableStock: z.number(),
  quantity: z.preprocess(
    coerceNumber,
    z.number().min(1, "Quantidade minima e 1")
  ),
  unitPrice: z.preprocess(
    coerceNumber,
    z.number().min(0.01, "Preco unitario e obrigatorio")
  ),
  discount: z.preprocess(coerceNumber, z.number().min(0).default(0)),
});

const orderPaymentSchema = z.object({
  paymentMethodId: z.string().min(1, "Selecione a forma de pagamento"),
  paymentConditionId: z.string().optional(),
  financialAccountId: z.string().optional(),
  amount: z.preprocess(coerceNumber, z.number().min(0.01, "Valor obrigatorio")),
  installments: z.number().optional(),
  authorizationCode: z.string().optional(),
});

const counterSaleSchema = z
  .object({
    customerId: z.string().min(1, "Selecione um cliente"),
    items: z.array(counterSaleItemSchema).min(1, "Adicione pelo menos um item"),
    payments: z
      .array(orderPaymentSchema)
      .min(1, "Adicione pelo menos uma forma de pagamento"),
    discount: z.preprocess(coerceNumber, z.number().min(0).default(0)),
    notes: z.string().max(1000).optional(),
  })
  .refine(
    (data) => {
      const paymentTotal = data.payments.reduce(
        (sum, p) => sum + (Number(p.amount) || 0),
        0
      );
      const orderTotal =
        data.items.reduce((sum, item) => {
          const qty = Number(item.quantity) || 0;
          const price = Number(item.unitPrice) || 0;
          const disc = Number(item.discount) || 0;
          return sum + (qty * price - disc);
        }, 0) - (Number(data.discount) || 0);
      return Math.abs(paymentTotal - orderTotal) < 0.01;
    },
    {
      message: "A soma dos pagamentos deve ser igual ao total do pedido",
      path: ["payments"],
    }
  );

type CounterSaleFormValues = z.infer<typeof counterSaleSchema>;

// ─── Stock badge ───────────────────────────────────────────────────────

function StockIndicator({ available }: { available: number }) {
  if (available <= 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
        <AlertTriangle className="h-3 w-3" />
        Sem estoque
      </span>
    );
  }
  if (available <= 5) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
        <AlertTriangle className="h-3 w-3" />
        {available} un.
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
      <CheckCircle2 className="h-3 w-3" />
      {available} un.
    </span>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────

export default function CounterSalePage() {
  const router = useRouter();
  const createOrder = useCreateOrder();
  const { addToast } = useToast();

  // A counter sale can only be finalized while a cash register is open
  const { data: openSessions } = useCashRegisterSessions({ status: "OPEN", limit: 1 });
  const hasOpenCashRegister = (openSessions?.data?.length ?? 0) > 0;

  // Product search state
  const [productSearch, setProductSearch] = useState("");
  const [productResults, setProductResults] = useState<ProductResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CounterSaleFormValues>({
    resolver: zodResolver(counterSaleSchema),
    defaultValues: {
      customerId: "",
      items: [],
      payments: [],
      discount: 0,
      notes: "",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  const items = watch("items");
  const orderDiscount = watch("discount");

  // ─── Computed totals ───────────────────────────────────────────────

  const calcItemTotal = (item: CounterSaleFormValues["items"][number]) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unitPrice) || 0;
    const disc = Number(item.discount) || 0;
    return qty * price - disc;
  };

  const subtotal = items.reduce((sum, item) => sum + calcItemTotal(item), 0);
  const total = subtotal - (Number(orderDiscount) || 0);

  // ─── Customer loader ──────────────────────────────────────────────

  const loadCustomers = useCallback(async (search: string) => {
    const { data } = await api.get<PaginatedResponse<CustomerOption>>(
      "/customers",
      { params: { search, limit: 20 } }
    );
    return (data.data ?? []).map((c) => ({
      value: c.id,
      label: c.name,
      description: c.document,
    }));
  }, []);

  // ─── Product search ───────────────────────────────────────────────

  const searchProducts = useCallback(async (query: string) => {
    setIsSearching(true);
    setHasSearched(true);
    try {
      const { data } = await api.get<PaginatedResponse<ProductResult>>(
        "/products",
        { params: { search: query, limit: 10, status: "ACTIVE" } }
      );
      setProductResults(data.data ?? []);
    } catch {
      setProductResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleProductSearch = useCallback(
    (value: string) => {
      setProductSearch(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!value.trim()) {
        setProductResults([]);
        setHasSearched(false);
        return;
      }
      debounceRef.current = setTimeout(() => searchProducts(value), 300);
    },
    [searchProducts]
  );

  // ─── Add product ─────────────────────────────────────────────────

  const addProductToOrder = useCallback(
    (product: ProductResult) => {
      const available = product.inventory?.totalAvailable ?? 0;
      const existingIndex = items.findIndex(
        (item) => item.productId === product.id
      );
      if (existingIndex >= 0) {
        const current = items[existingIndex];
        setValue(`items.${existingIndex}.quantity`, current.quantity + 1);
        return;
      }
      append({
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        availableStock: available,
        quantity: 1,
        unitPrice: Number(product.salePrice),
        discount: 0,
      });
      setProductSearch("");
      setProductResults([]);
      setHasSearched(false);
    },
    [items, append, setValue]
  );

  // ─── Submit ───────────────────────────────────────────────────────

  const onSubmit = async (data: CounterSaleFormValues) => {
    if (!hasOpenCashRegister) {
      addToast("Abra o caixa para registrar vendas no balcão.", "error");
      return;
    }
    try {
      const result = await createOrder.mutateAsync({
        customerId: data.customerId || undefined,
        origin: "BALCAO",
        items: data.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
        })),
        payments: data.payments.map((p) => ({
          paymentMethodId: p.paymentMethodId,
          paymentConditionId: p.paymentConditionId || undefined,
          financialAccountId: p.financialAccountId || undefined,
          amount: p.amount,
          installments: p.installments || undefined,
          authorizationCode: p.authorizationCode || undefined,
        })),
        shippingCost: 0,
        notes: data.notes || undefined,
      });
      addToast("Venda no balcao finalizada com sucesso!", "success");
      router.push(`/vendas/pedidos/${result.data.id}`);
    } catch {
      addToast("Erro ao finalizar venda. Verifique o estoque e tente novamente.", "error");
    }
  };

  // ─── Stock validation ─────────────────────────────────────────────

  const hasStockIssues = items.some(
    (i) => i.quantity > i.availableStock
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Tooltip content="Voltar">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Tooltip>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Venda no Balcao
          </h1>
          <p className="text-muted-foreground">
            Venda direta - o pedido sera finalizado automaticamente
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit((data) => onSubmit(data))}>
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main content */}
          <div className="space-y-6 lg:col-span-2">
            {/* Customer */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Cliente</CardTitle>
              </CardHeader>
              <CardContent>
                <SearchableSelect
                  name="customerId"
                  control={control}
                  loadOptions={loadCustomers}
                  placeholder="Buscar cliente por nome ou documento..."
                  error={errors.customerId?.message}
                />
              </CardContent>
            </Card>

            {/* Product search */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Adicionar Produtos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    value={productSearch}
                    onChange={(e) => handleProductSearch(e.target.value)}
                    placeholder="Buscar produto por nome, SKU ou codigo de barras..."
                    className="pl-10"
                    autoFocus
                  />
                  {isSearching && (
                    <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                  )}
                </div>

                {/* Search results */}
                {(productResults.length > 0 || (hasSearched && !isSearching)) && (
                  <div className="rounded-lg border">
                    {productResults.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                        Nenhum produto encontrado para &quot;{productSearch}&quot;
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="border-b bg-muted/50">
                            <tr>
                              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                                Produto
                              </th>
                              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                                SKU
                              </th>
                              <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                                Preco
                              </th>
                              <th className="px-4 py-2.5 text-center font-medium text-muted-foreground">
                                Estoque
                              </th>
                              <th className="px-4 py-2.5 text-right font-medium text-muted-foreground" />
                            </tr>
                          </thead>
                          <tbody>
                            {productResults.map((product) => {
                              const available =
                                product.inventory?.totalAvailable ?? 0;
                              const alreadyAdded = items.some(
                                (i) => i.productId === product.id
                              );
                              return (
                                <tr
                                  key={product.id}
                                  className={cn(
                                    "border-b last:border-0 transition-colors",
                                    alreadyAdded
                                      ? "bg-primary/5"
                                      : "hover:bg-muted/30"
                                  )}
                                >
                                  <td className="px-4 py-2.5">
                                    <div className="flex items-center gap-2.5">
                                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                                        <Package className="h-4 w-4 text-muted-foreground" />
                                      </div>
                                      <span className="font-medium">
                                        {product.name}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                                    {product.sku}
                                  </td>
                                  <td className="px-4 py-2.5 text-right font-medium">
                                    {formatCurrency(Number(product.salePrice))}
                                  </td>
                                  <td className="px-4 py-2.5 text-center">
                                    <StockIndicator available={available} />
                                  </td>
                                  <td className="px-4 py-2.5 text-right">
                                    {alreadyAdded ? (
                                      <span className="text-xs font-medium text-primary">
                                        Adicionado
                                      </span>
                                    ) : (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-7 gap-1.5 text-xs"
                                        disabled={available <= 0}
                                        onClick={() =>
                                          addProductToOrder(product)
                                        }
                                      >
                                        <Plus className="h-3 w-3" />
                                        Adicionar
                                      </Button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Order items */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Itens da Venda
                  {fields.length > 0 && (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      ({fields.length} {fields.length === 1 ? "item" : "itens"})
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {fields.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
                    <ShoppingCart className="mb-3 h-10 w-10 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">
                      Nenhum item adicionado
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Use a busca acima para encontrar e adicionar produtos
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b bg-muted/50">
                        <tr>
                          <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                            Produto
                          </th>
                          <th className="px-4 py-2.5 text-center font-medium text-muted-foreground">
                            Estoque
                          </th>
                          <th className="w-32 px-4 py-2.5 text-center font-medium text-muted-foreground">
                            Qtd
                          </th>
                          <th className="w-36 px-4 py-2.5 text-right font-medium text-muted-foreground">
                            Preco Unit.
                          </th>
                          <th className="w-36 px-4 py-2.5 text-right font-medium text-muted-foreground">
                            Desconto
                          </th>
                          <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                            Total
                          </th>
                          <th className="w-10 px-2 py-2.5" />
                        </tr>
                      </thead>
                      <tbody>
                        {fields.map((field, index) => {
                          const item = items[index];
                          const qty = Number(item?.quantity) || 0;
                          const stock = Number(item?.availableStock) || 0;
                          const itemTotal = item ? calcItemTotal(item) : 0;
                          const overStock = qty > stock;

                          return (
                            <tr
                              key={field.id}
                              className={cn(
                                "border-b last:border-0",
                                overStock && "bg-red-50 dark:bg-red-950/20"
                              )}
                            >
                              <td className="px-4 py-3">
                                <p className="font-medium">
                                  {item?.productName}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {item?.sku}
                                </p>
                              </td>

                              <td className="px-4 py-3 text-center">
                                <StockIndicator available={stock} />
                              </td>

                              <td className="px-4 py-3">
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-7 w-7"
                                    disabled={qty <= 1}
                                    onClick={() =>
                                      setValue(
                                        `items.${index}.quantity`,
                                        qty - 1
                                      )
                                    }
                                  >
                                    <Minus className="h-3 w-3" />
                                  </Button>
                                  <Input
                                    type="number"
                                    min={1}
                                    {...register(`items.${index}.quantity`, {
                                      valueAsNumber: true,
                                    })}
                                    className={cn(
                                      "h-7 w-14 text-center text-sm",
                                      overStock &&
                                        "border-red-500 text-red-700"
                                    )}
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() =>
                                      setValue(
                                        `items.${index}.quantity`,
                                        qty + 1
                                      )
                                    }
                                  >
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                </div>
                                {overStock && (
                                  <p className="mt-1 text-center text-[10px] text-red-600">
                                    Excede estoque!
                                  </p>
                                )}
                              </td>

                              <td className="px-4 py-3">
                                <MoneyInput
                                  name={`items.${index}.unitPrice`}
                                  control={control}
                                />
                              </td>

                              <td className="px-4 py-3">
                                <MoneyInput
                                  name={`items.${index}.discount`}
                                  control={control}
                                />
                              </td>

                              <td className="px-4 py-3 text-right font-semibold">
                                {formatCurrency(itemTotal)}
                              </td>

                              <td className="px-2 py-3">
                                <Tooltip content="Remover item">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                    onClick={() => remove(index)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </Tooltip>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-muted/30">
                          <td
                            colSpan={5}
                            className="px-4 py-3 text-right font-semibold"
                          >
                            Subtotal
                          </td>
                          <td className="px-4 py-3 text-right font-semibold">
                            {formatCurrency(subtotal)}
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}

                {errors.items?.message && (
                  <p className="mt-2 text-xs text-destructive">
                    {errors.items.message}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Payment */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Pagamento</CardTitle>
              </CardHeader>
              <CardContent>
                <PaymentSelector
                  control={control as never}
                  setValue={setValue as never}
                  totalAmount={total}
                  errors={errors.payments as never}
                />
              </CardContent>
            </Card>

            {/* Discount & Notes */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Desconto e Observacoes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <MoneyInput
                    name="discount"
                    control={control}
                    label="Desconto Geral"
                  />
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Observacoes</label>
                    <textarea
                      {...register("notes")}
                      rows={3}
                      maxLength={1000}
                      placeholder="Observacoes internas sobre a venda..."
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Summary */}
          <div className="space-y-6">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle className="text-lg">Resumo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Subtotal ({items.length}{" "}
                      {items.length === 1 ? "item" : "itens"})
                    </span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  {(Number(orderDiscount) || 0) > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Desconto</span>
                      <span className="text-red-600">
                        -{formatCurrency(Number(orderDiscount) || 0)}
                      </span>
                    </div>
                  )}
                  <div className="border-t pt-2">
                    <div className="flex items-center justify-between font-semibold">
                      <span>Total</span>
                      <span className="text-lg">
                        {formatCurrency(Math.max(total, 0))}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Cash register closed warning */}
                {!hasOpenCashRegister && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        Nenhum caixa aberto. Abra o caixa em Financeiro &gt; Caixa
                        para registrar vendas no balcão.
                      </p>
                    </div>
                  </div>
                )}

                {/* Stock warnings */}
                {hasStockIssues && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950/30">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                      <p className="text-xs text-red-700 dark:text-red-400">
                        Alguns itens excedem o estoque disponivel. Ajuste as
                        quantidades para finalizar a venda.
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-2 border-t pt-4">
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={createOrder.isPending || hasStockIssues || items.length === 0 || !hasOpenCashRegister}
                  >
                    {createOrder.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Finalizar Venda
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => router.back()}
                  >
                    Cancelar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
