"use client";

import { createProductSchema, type CreateProductInput } from  "../../../../../../../packages/validators/src/stock/product"
import React, { HTMLInputTypeAttribute, useState } from "react";
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
  } = useForm<CreateProductInput>({
    resolver: zodResolver(createProductSchema),
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
      weight: undefined,
      height: undefined,
      width: undefined,
      length: undefined,
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
  const onSubmit = async (data: CreateProductInput, status: "DRAFT" | "ACTIVE") => {
    try {
      if (images.length === 0) {
        addToast("Adicione pelo menos uma imagem", "error");
        return;
      }
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
     console.log("VALOR FINAL:", data.weight)
     
  };

  // Field error helper
  const fieldError = (field: keyof CreateProductInput) =>
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
                  placeholder="Descrição detalhada do produto..."
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
                {fieldError("description") && (
                  <p className="text-xs text-destructive">{fieldError("description")}</p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <SearchableSelect
                  name="category"
                  control={control}
                  options={categoryOptions}
                  label="Categoria *"
                  placeholder="Selecionar categoria..."
                />
                <SearchableSelect
                  name="brand"
                  control={control}
                  options={brandOptions}
                  label="Marca *"
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
                  />
                  {fieldError("ncm") && (
                    <p className="text-xs text-destructive">{fieldError("ncm")}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">CEST</label>
                  <Input
                    {...register("cest")}
                    placeholder="Ex: 21.063.00"
                  />
                  {fieldError("cest") && (
                    <p className="text-xs text-destructive">{fieldError("cest")}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">EAN / GTIN</label>
                  <Input
                    {...register("ean")}
                    placeholder="Código de barras"
                  />
                  {fieldError("ean") && (
                    <p className="text-xs text-destructive">{fieldError("ean")}</p>
                  )}
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
                    type="text"
                    inputMode="decimal"
                    {...register("weight")}
                    placeholder="0,000"
                    onKeyDown={(e) => {
                      const allowedKeys = [
                        "Backspace",
                        "Delete",
                        "Tab",
                        "ArrowLeft",
                        "ArrowRight"
                      ]
                      // Permite teclas de controle
                      if(allowedKeys.includes(e.key)) return

                      // Bloqueia tudo que não for número ou virgula
                      if(!/^[0-9,]$/.test(e.key)) {
                        e.preventDefault()
                      }

                      // Bloqueia segunda virgula
                      if (e.key === ","){
                        const value = (e.target as HTMLInputElement).value
                        if(value.includes(",")) {
                          e.preventDefault()
                        }
                      }
                    }}
                    onPaste={(e) => {
                      const paste = e.clipboardData.getData("text")

                      // Só permite números e vírgula
                      if(!/^[0-9,]$/.test(paste)) {
                        e.preventDefault()
                        return
                      }

                      // Bloqueia se já tiver uma vírgula e o texto colado tiver outra
                      const currentValue = (e.target as HTMLInputElement).value

                        if (currentValue.includes(",") && paste.includes(",")) {
                          e.preventDefault()
                        }
                    }}
                  />
                  {fieldError("weight") && (
                    <p className="text-xs text-destructive">{fieldError("weight")}</p>
                  )}
                  
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Altura (cm)</label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    {...register("height")}
                    placeholder="0,0"
                    onKeyDown={(e) => {
                      const allowedKeys = [
                        "Backspace",
                        "Delete",
                        "Tab",
                        "ArrowLeft",
                        "ArrowRight"
                      ]

                      // Permite teclas de controle
                      if(allowedKeys.includes(e.key)) return

                      // Bloqueia tudo que não for número ou virgula
                      if(!/^[0-9,]$/.test(e.key)){
                        e.preventDefault()
                      }

                      // Bloqueia segunda virgula
                      if(e.key === ","){
                        const value = (e.target as HTMLInputElement).value

                        if(value.includes(",")){
                          e.preventDefault()
                        }
                      }
                    }}
                    onPaste={(e) => {
                      const paste = e.clipboardData.getData("text")

                      // Só permite números e vírgula
                      if(!/^[0-9,]$/.test(paste)) {
                        e.preventDefault()
                        return
                      }

                      // Bloqueia se já tiver uma vírgula e o texto colado tiver outra
                      const currentValue = (e.target as HTMLInputElement).value

                        if (currentValue.includes(",") && paste.includes(",")) {
                          e.preventDefault()
                        }
                    }}
                  />
                  {fieldError("height") && (
                    <p className="text-xs text-destructive">{fieldError("height")}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Largura (cm)</label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    {...register("width")}
                    placeholder="0,0"
                    onKeyDown={(e) => {
                      const allowedKeys = [
                        "Backspace",
                        "Delete",
                        "Tab",,
                        "ArrowLeft",
                        "ArrowRight"
                      ]

                      // Permite teclas de controle
                      if(allowedKeys.includes(e.key)) return

                      // Bloqueia tudo que não for número ou virgula
                      if(!/^[0-9,]$/.test(e.key)){
                        e.preventDefault()
                      }

                      // Bloqueia segunda virgula
                      const value = (e.target as HTMLInputElement).value

                      if(e.key === ","){
                        if(value.includes(",")){
                          e.preventDefault()
                        }
                      }
                    }}
                    onPaste={(e) => {
                      const paste = e.clipboardData.getData("text")

                      // Só permite números e vírgula
                      if(!/^[0-9,]$/.test(paste)) {
                        e.preventDefault()
                        return
                      }

                      // Bloqueia se já tiver uma vírgula e o texto colado tiver outra
                      const currentValue = (e.target as HTMLInputElement).value

                        if (currentValue.includes(",") && paste.includes(",")) {
                          e.preventDefault()
                        }
                    }}
                  />
                  {fieldError("width") && (
                    <p className="text-xs text-destructive">{fieldError("width")}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">
                    Comprimento (cm)
                  </label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    {...register("length")}
                    placeholder="0,0"
                    onKeyDown={(e) => {
                      const allowedKeys = [
                        "Backspace",
                        "Delete",
                        "Tab",
                        "ArrowLeft",
                        "ArrowRight",
                      ]

                      // Permite teclas de controle
                      if(allowedKeys.includes(e.key)) return

                      // Bloqueia tudo que não for número ou virgula
                      if(!/^[0-9,]$/.test(e.key)){
                        e.preventDefault()
                      }

                      // Bloqueia segunda virgula
                      const value = (e.target as HTMLInputElement).value

                      if(e.key === ","){
                        if(value.includes(",")){
                        e.preventDefault()
                        }
                      }
                    }}
                    onPaste={(e) => {
                      const paste = e.clipboardData.getData("text")

                      // Só permite números e vírgula
                      if(!/^[0-9,]$/.test(paste)) {
                        e.preventDefault()
                        return
                      }

                      // Bloqueia se já tiver uma vírgula e o texto colado tiver outra
                      const currentValue = (e.target as HTMLInputElement).value

                        if (currentValue.includes(",") && paste.includes(",")) {
                          e.preventDefault()
                        }
                    }}
                  />
                  {fieldError("length") && (
                    <p className="text-xs text-destructive">{fieldError("length")}</p>
                  )}
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
            onClick={handleSubmit((data) => onSubmit(data, "DRAFT"))}
            
          >
            <FileText className="mr-2 h-4 w-4" />
            Salvar como Rascunho
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || createProduct.isPending}
            formNoValidate
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
