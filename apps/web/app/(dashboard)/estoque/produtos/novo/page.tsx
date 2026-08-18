"use client";

import {
  isValidNCM,
  isValidCEST,
  isValidGTIN,
  isValidCFOP,
  FISCAL_MESSAGES,
  COMMON_SALE_CFOPS,
} from "@erp/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  Save,
  FileText,
  Wand2,
  Loader2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { type FieldErrors, useForm } from "react-hook-form";
import { z } from "zod";

import { FileUpload, type UploadedFile } from "@/components/forms/file-upload";
import { MoneyInput } from "@/components/forms/money-input";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import { useCreateProduct, useCategories, useBrands, type ProductFormData } from "@/hooks/use-products";
import {
  countErrorsByTab,
  firstTabWithError,
  totalErrorCount,
  invalidSubmitMessage,
} from "@/lib/form-tabs";
import { getMutationErrorMessage } from "@/lib/mutation-error";
import { cn } from "@/lib/utils";


// ─── Validation schema ──────────────────────────────────────────────────

// Convert NaN to undefined for optional numbers
const optionalNumber = z.preprocess(
  (val) => (val === "" || val === null || val === undefined || Number.isNaN(val) ? undefined : Number(val)),
  z.number({ invalid_type_error: "Deve ser um número" }).min(0).optional()
);

const productSchema = z.object({
  // Dados gerais
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres").max(255, "Nome muito longo"),
  sku: z.string().min(1, "SKU é obrigatório").max(50, "SKU muito longo"),
  description: z.string().max(2000, "Descrição muito longa").optional(),
  category: z.string().optional(),
  brand: z.string().optional(),

  // Preços
  costPrice: z.preprocess(
    (val) => (val === "" || Number.isNaN(val) ? undefined : Number(val)),
    z.number({ required_error: "Preço de custo é obrigatório", invalid_type_error: "Preço de custo deve ser um número" }).min(0, "Preço de custo não pode ser negativo"),
  ),
  markup: optionalNumber,
  salePrice: z.preprocess(
    (val) => (val === "" || Number.isNaN(val) ? undefined : Number(val)),
    z
      .number({
        required_error: "Preço de venda é obrigatório",
        invalid_type_error: "Preço de venda deve ser um número",
      })
      // AE-24: com o campo preenchido com 0, "é obrigatório" manda o usuário
      // preencher o que já preencheu.
      .min(0.01, "Preço de venda deve ser maior que zero"),
  ),
  promoPrice: optionalNumber,

  // Estoque
  defaultMinStock: z.preprocess(
    (val) => (val === "" || val === undefined || Number.isNaN(val) ? 0 : Number(val)),
    z
      .number()
      .int("Estoque mínimo deve ser um número inteiro")
      .min(0, "Estoque mínimo não pode ser negativo"),
  ),

  // AE-05: consentimento explícito para margem negativa.
  confirmNegativeMargin: z.boolean().optional(),

  // Fiscal
  // AE-08: contar caracteres aceitava `ncm: 'ABCDEFG'` e `ean: '123'` — em
  // produção isso é NF-e rejeitada pela SEFAZ, descoberta ao faturar. Os
  // validadores vêm de @erp/validators, os mesmos que a API usa.
  ncm: z
    .string()
    .max(10, "NCM deve ter no máximo 10 caracteres")
    .optional()
    .refine((v) => !v || isValidNCM(v), FISCAL_MESSAGES.ncm),
  cest: z
    .string()
    .max(9, "CEST deve ter no máximo 9 caracteres")
    .optional()
    .refine((v) => !v || isValidCEST(v), FISCAL_MESSAGES.cest),
  ean: z
    .string()
    .max(18, "EAN deve ter no máximo 18 caracteres")
    .optional()
    .refine((v) => !v || isValidGTIN(v), FISCAL_MESSAGES.ean),
  cfop: z
    .string()
    .max(4, "CFOP tem 4 dígitos")
    .optional()
    .refine((v) => !v || isValidCFOP(v), FISCAL_MESSAGES.cfop),

  // Dimensões
  weight: optionalNumber,
  height: optionalNumber,
  width: optionalNumber,
  length: optionalNumber,
});

/**
 * AE-05: custo R$ 500.000 e venda R$ 100.000 foram aceitos sem um aviso. Não
 * bloqueamos de vez — liquidação com margem negativa existe —, mas o silêncio
 * é pior: agora exige uma confirmação explícita.
 */
const productSchemaWithMargin = productSchema.superRefine((data, ctx) => {
  const cost = Number(data.costPrice) || 0;
  const sale = Number(data.salePrice) || 0;
  if (cost > 0 && sale > 0 && sale < cost && !data.confirmNegativeMargin) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["confirmNegativeMargin"],
      message:
        "O preço de venda está abaixo do custo. Confirme a venda com margem negativa para continuar.",
    });
  }
});

type ProductFormValues = z.infer<typeof productSchema>;

// ─── Tabs ───────────────────────────────────────────────────────────────

const tabs = [
  { id: "geral", label: "Dados Gerais" },
  { id: "precos", label: "Preços" },
  { id: "fiscal", label: "Fiscal" },
  { id: "dimensoes", label: "Dimensões" },
  { id: "imagens", label: "Imagens" },
] as const;

type TabId = (typeof tabs)[number]["id"];

/**
 * AE-11: quais campos moram em qual aba. Sem este mapa, um erro na aba Preços
 * deixava "Publicar Produto" mudo — o zod recusava, o campo estava oculto e a
 * tela não dizia nada.
 */
const FIELDS_BY_TAB: Record<TabId, readonly string[]> = {
  geral: ["name", "sku", "description", "category", "brand", "status"],
  precos: [
    "costPrice",
    "salePrice",
    "promoPrice",
    "markup",
    "defaultMinStock",
    "confirmNegativeMargin",
  ],
  fiscal: ["ncm", "cest", "ean", "cfop"],
  dimensoes: ["weight", "height", "width", "length"],
  imagens: [],
};

const TAB_ORDER = tabs.map((tab) => tab.id);

// ─── Page ───────────────────────────────────────────────────────────────

export default function NewProductPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("geral");
  const [images, setImages] = useState<UploadedFile[]>([]);

  const createProduct = useCreateProduct();
  const { addToast } = useToast();

  const { data: categoriesResp } = useCategories();
  const { data: brandsResp } = useBrands();

  const categoryOptions = (categoriesResp?.data ?? []).map((c: { id: string; name: string }) => ({
    value: c.id,
    label: c.name,
  }));

  const brandOptions = (brandsResp?.data ?? []).map((b: { id: string; name: string }) => ({
    value: b.id,
    label: b.name,
  }));

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchemaWithMargin),
    defaultValues: {
      name: "",
      sku: "",
      description: "",
      category: "",
      brand: "",
      costPrice: 0,
      defaultMinStock: 0,
      markup: 0,
      salePrice: 0,
      promoPrice: 0,
      ncm: "",
      cest: "",
      ean: "",
      cfop: "",
      weight: 0,
      height: 0,
      width: 0,
      length: 0,
    },
  });

  // Auto-calculate sale price from cost + markup
  const costPrice = watch("costPrice");
  const markup = watch("markup");

  const handleMarkupCalc = () => {
    if (costPrice && markup) {
      const computed = costPrice * (1 + markup / 100);
      setValue("salePrice", Math.round(computed * 100) / 100);
    }
  };

  // Generate random SKU
  const generateSku = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let sku = "PRD-";
    for (let i = 0; i < 6; i++) {
      sku += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setValue("sku", sku);
  };

  // Submit
  const onSubmit = async (data: ProductFormValues, status: "DRAFT" | "ACTIVE") => {
    try {
      await createProduct.mutateAsync({
        name: data.name,
        sku: data.sku,
        description: data.description,
        categoryId: data.category || undefined,
        brandId: data.brand || undefined,
        costPrice: data.costPrice,
        salePrice: data.salePrice,
        promoPrice: data.promoPrice,
        markup: data.markup,
        ncm: data.ncm,
        cest: data.cest,
        ean: data.ean,
        cfop: data.cfop,
        defaultMinStock: data.defaultMinStock,
        weight: data.weight,
        height: data.height,
        width: data.width,
        length: data.length,
        status: status as ProductFormData["status"],
      });
      addToast("Produto criado com sucesso!", "success");
      router.push("/estoque/produtos");
    } catch (err) {
      addToast(
        getMutationErrorMessage(
          err,
          "Erro ao criar produto. Tente novamente."
        ),
        "error"
      );
    }
  };

  // Field error helper
  const fieldError = (field: keyof ProductFormValues) =>
    errors[field]?.message as string | undefined;

  /**
   * AE-11: o submit recusado tem que dizer onde está o problema. Antes disto o
   * botão "Publicar Produto" simplesmente não fazia nada quando o erro morava
   * numa aba fechada.
   */
  const errorsByTab = countErrorsByTab(
    errors as Record<string, unknown>,
    FIELDS_BY_TAB
  );

  const hasNegativeMargin =
    costPrice > 0 && watch("salePrice") > 0 && watch("salePrice") < costPrice;

  // O react-hook-form passa os erros como argumento. Ler `errors` do closure
  // pega o estado **anterior** ao submit — a aba não trocava na primeira
  // tentativa, que é justamente quando o usuário precisa.
  const onInvalid = (submitErrors: FieldErrors<ProductFormValues>) => {
    const target = firstTabWithError(
      submitErrors as Record<string, unknown>,
      FIELDS_BY_TAB,
      TAB_ORDER
    );
    if (target) {setActiveTab(target as TabId);}
    addToast(
      invalidSubmitMessage(
        totalErrorCount(submitErrors as Record<string, unknown>)
      ),
      "error"
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Tooltip content="Voltar">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Tooltip>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Novo Produto</h1>
          <p className="text-muted-foreground">
            Preencha os dados para cadastrar um novo produto
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit((data) => onSubmit(data, "ACTIVE"), onInvalid)}
        noValidate
      >
        {/* Tabs */}
        <div className="mb-6 flex gap-1 overflow-x-auto border-b">
          {tabs.map((tab) => {
            const tabErrors = errorsByTab[tab.id] ?? 0;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground",
                  tabErrors > 0 && activeTab !== tab.id && "text-destructive"
                )}
              >
                {tab.label}
                {/* AE-11: o contador é o que revela o erro na aba oculta */}
                {tabErrors > 0 && (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-semibold text-destructive-foreground">
                    {tabErrors}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Dados Gerais */}
        {activeTab === "geral" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dados Gerais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Nome *</label>
                  <Input
                    {...register("name")}
                    placeholder="Nome do produto"
                    maxLength={255}
                  />
                  {fieldError("name") && (
                    <p className="text-xs text-destructive">{fieldError("name")}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">SKU *</label>
                  <div className="flex gap-2">
                    <Input
                      {...register("sku")}
                      placeholder="SKU do produto"
                      className="flex-1"
                      maxLength={50}
                    />
                    <Tooltip content="Gerar SKU">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={generateSku}
                      >
                        <Wand2 className="h-4 w-4" />
                      </Button>
                    </Tooltip>
                  </div>
                  {fieldError("sku") && (
                    <p className="text-xs text-destructive">{fieldError("sku")}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Descrição</label>
                <textarea
                  {...register("description")}
                  rows={4}
                  maxLength={2000}
                  placeholder="Descrição detalhada do produto..."
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <SearchableSelect
                  name="category"
                  control={control}
                  options={categoryOptions}
                  label="Categoria"
                  placeholder="Selecionar categoria..."
                />
                <SearchableSelect
                  name="brand"
                  control={control}
                  options={brandOptions}
                  label="Marca"
                  placeholder="Selecionar marca..."
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Estoque mínimo</label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    {...register("defaultMinStock", { valueAsNumber: true })}
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground">
                    Gera alerta quando o estoque do produto ficar neste nível ou
                    abaixo. Vale para cada depósito onde o produto tiver estoque.
                  </p>
                  {fieldError("defaultMinStock") && (
                    <p className="text-xs text-destructive">
                      {fieldError("defaultMinStock")}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Preços */}
        {activeTab === "precos" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Preços</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <MoneyInput
                  name="costPrice"
                  control={control}
                  label="Preço de Custo *"
                  error={fieldError("costPrice")}
                />
                <div className="space-y-1">
                  <label className="text-sm font-medium">Markup %</label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      {...register("markup", { valueAsNumber: true })}
                      placeholder="0,00"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleMarkupCalc}
                      title="Calcular preço de venda"
                    >
                      Calcular
                    </Button>
                  </div>
                </div>
                <MoneyInput
                  name="salePrice"
                  control={control}
                  label="Preço de Venda *"
                  error={fieldError("salePrice")}
                />
              </div>
              <div className="max-w-xs">
                <MoneyInput
                  name="promoPrice"
                  control={control}
                  label="Preço Promocional"
                />
              </div>

              {/* Margin preview — AE-05: em vermelho quando negativa, e a venda
                  abaixo do custo exige confirmação explícita. Bloquear de vez
                  atrapalharia liquidação; o silêncio de antes era pior. */}
              {costPrice > 0 && watch("salePrice") > 0 && (
                <div
                  className={cn(
                    "rounded-lg border p-4",
                    hasNegativeMargin
                      ? "border-destructive/40 bg-destructive/5"
                      : "bg-muted/50"
                  )}
                >
                  <p className="text-sm text-muted-foreground">
                    Margem de lucro:{" "}
                    <span
                      className={cn(
                        "font-semibold",
                        hasNegativeMargin ? "text-destructive" : "text-foreground"
                      )}
                    >
                      {(
                        ((watch("salePrice") - costPrice) / watch("salePrice")) *
                        100
                      ).toFixed(1)}
                      %
                    </span>
                    {" "}|{" "}
                    Lucro por unidade:{" "}
                    <span
                      className={cn(
                        "font-semibold",
                        hasNegativeMargin ? "text-destructive" : "text-foreground"
                      )}
                    >
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(watch("salePrice") - costPrice)}
                    </span>
                  </p>

                  {hasNegativeMargin ? <label className="mt-3 flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        {...register("confirmNegativeMargin")}
                      />
                      <span>
                        Confirmo a venda com margem negativa — o preço de venda
                        está abaixo do custo.
                      </span>
                    </label> : null}
                  {errors.confirmNegativeMargin ? <p className="mt-1 text-xs text-destructive">
                      {errors.confirmNegativeMargin.message as string}
                    </p> : null}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Fiscal */}
        {activeTab === "fiscal" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dados Fiscais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* FN-13: todo campo renderiza o próprio erro. Sem isto o zod
                  recusa em silêncio e o botão "não faz nada". */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium">NCM</label>
                  <Input
                    {...register("ncm")}
                    placeholder="Ex: 8471.30.19"
                    maxLength={10}
                  />
                  {errors.ncm ? <p className="text-xs text-destructive">{errors.ncm.message}</p> : null}
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">CEST</label>
                  <Input
                    {...register("cest")}
                    placeholder="Ex: 21.063.00"
                    maxLength={9}
                  />
                  {errors.cest ? <p className="text-xs text-destructive">{errors.cest.message}</p> : null}
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">EAN / GTIN</label>
                  <Input
                    {...register("ean")}
                    placeholder="Código de barras"
                    maxLength={18}
                  />
                  {errors.ean ? <p className="text-xs text-destructive">{errors.ean.message}</p> : null}
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">CFOP</label>
                  <Input
                    {...register("cfop")}
                    placeholder="Ex: 5102"
                    maxLength={4}
                    list="cfop-sugestoes"
                  />
                  {/* Os códigos usuais de venda, sem travar quem precisa de outro */}
                  <datalist id="cfop-sugestoes">
                    {COMMON_SALE_CFOPS.map((cfop) => (
                      <option key={cfop.code} value={cfop.code}>
                        {cfop.description}
                      </option>
                    ))}
                  </datalist>
                  {errors.cfop ? <p className="text-xs text-destructive">{errors.cfop.message}</p> : null}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Dimensões */}
        {activeTab === "dimensoes" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dimensões e Peso</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Peso (kg)</label>
                  <Input
                    type="number"
                    step="0.001"
                    {...register("weight", { valueAsNumber: true })}
                    placeholder="0,000"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Altura (cm)</label>
                  <Input
                    type="number"
                    step="0.1"
                    {...register("height", { valueAsNumber: true })}
                    placeholder="0,0"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Largura (cm)</label>
                  <Input
                    type="number"
                    step="0.1"
                    {...register("width", { valueAsNumber: true })}
                    placeholder="0,0"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">
                    Comprimento (cm)
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    {...register("length", { valueAsNumber: true })}
                    placeholder="0,0"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Imagens */}
        {activeTab === "imagens" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Imagens do Produto</CardTitle>
            </CardHeader>
            <CardContent>
              <FileUpload
                value={images}
                onChange={setImages}
                accept="image/*"
                maxFiles={8}
                maxSize={5 * 1024 * 1024}
                description="Arraste imagens aqui. JPG, PNG ou WebP, até 5MB cada. Máximo 8 imagens."
              />
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="mt-6 flex items-center justify-end gap-3 border-t pt-6">
          <Button
            type="button"
            variant="cancel"
            onClick={() => router.back()}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={isSubmitting || createProduct.isPending}
            onClick={handleSubmit((data) => onSubmit(data, "DRAFT"), onInvalid)}
          >
            <FileText className="mr-2 h-4 w-4" />
            Salvar como Rascunho
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || createProduct.isPending}
          >
            {createProduct.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Publicar Produto
          </Button>
        </div>
      </form>
    </div>
  );
}
