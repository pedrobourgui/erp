"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MoneyInput } from "@/components/forms/money-input";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { FileUpload, type UploadedFile } from "@/components/forms/file-upload";
import { useCreateProduct, useCategories, useBrands, type ProductFormData } from "@/hooks/use-products";
import { useToast } from "@/components/ui/toast";
import {
  ArrowLeft,
  Save,
  FileText,
  Wand2,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";

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
    z.number({ required_error: "Preço de venda é obrigatório", invalid_type_error: "Preço de venda deve ser um número" }).min(0.01, "Preço de venda é obrigatório"),
  ),
  promoPrice: optionalNumber,

  // Fiscal
  ncm: z.string().max(10, "NCM deve ter no máximo 10 caracteres").optional(),
  cest: z.string().max(9, "CEST deve ter no máximo 9 caracteres").optional(),
  ean: z.string().max(14, "EAN deve ter no máximo 14 caracteres").optional(),

  // Dimensões
  weight: optionalNumber,
  height: optionalNumber,
  width: optionalNumber,
  length: optionalNumber,
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
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      sku: "",
      description: "",
      category: "",
      brand: "",
      costPrice: 0,
      markup: 0,
      salePrice: 0,
      promoPrice: 0,
      ncm: "",
      cest: "",
      ean: "",
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
        weight: data.weight,
        height: data.height,
        width: data.width,
        length: data.length,
        status: status as ProductFormData["status"],
      });
      addToast("Produto criado com sucesso!", "success");
      router.push("/estoque/produtos");
    } catch {
      addToast("Erro ao criar produto. Tente novamente.", "error");
    }
  };

  // Field error helper
  const fieldError = (field: keyof ProductFormValues) =>
    errors[field]?.message as string | undefined;

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

      <form onSubmit={handleSubmit((data) => onSubmit(data, "ACTIVE"))}>
        {/* Tabs */}
        <div className="mb-6 flex gap-1 overflow-x-auto border-b">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
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
                  label="Preço de Custo"
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
                      variant="outline"
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

              {/* Margin preview */}
              {costPrice > 0 && watch("salePrice") > 0 && (
                <div className="rounded-lg border bg-muted/50 p-4">
                  <p className="text-sm text-muted-foreground">
                    Margem de lucro:{" "}
                    <span className="font-semibold text-foreground">
                      {(
                        ((watch("salePrice") - costPrice) / watch("salePrice")) *
                        100
                      ).toFixed(1)}
                      %
                    </span>
                    {" "}|{" "}
                    Lucro por unidade:{" "}
                    <span className="font-semibold text-foreground">
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(watch("salePrice") - costPrice)}
                    </span>
                  </p>
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
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">NCM</label>
                  <Input
                    {...register("ncm")}
                    placeholder="Ex: 8471.30.19"
                    maxLength={10}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">CEST</label>
                  <Input
                    {...register("cest")}
                    placeholder="Ex: 21.063.00"
                    maxLength={9}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">EAN / GTIN</label>
                  <Input
                    {...register("ean")}
                    placeholder="Código de barras"
                    maxLength={14}
                  />
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
            variant="outline"
            onClick={() => router.back()}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={isSubmitting || createProduct.isPending}
            onClick={handleSubmit((data) => onSubmit(data, "DRAFT"))}
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
