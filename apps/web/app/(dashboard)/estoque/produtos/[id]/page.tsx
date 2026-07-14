"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useProduct, useDeleteProduct } from "@/hooks/use-products";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils";
import {
  ArrowLeft,
  Edit,
  Trash2,
  Loader2,
  Package,
  DollarSign,
  Barcode,
} from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import {
  ProductGeneralCard,
  ProductFiscalCard,
} from "./_components/product-general-card";
import { ProductVariantsCard } from "./_components/product-variants-card";
import { ProductImagesCard } from "./_components/product-images-card";
import { ProductStockCard } from "./_components/product-stock-card";
import type { ProductDetail } from "./_components/types";

// ─── Page ───────────────────────────────────────────────────────────────

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id as string;

  const { data: productResp, isLoading } = useProduct(productId);
  const deleteProduct = useDeleteProduct();
  const { addToast } = useToast();
  const [showDelete, setShowDelete] = useState(false);

  const product = productResp?.data as ProductDetail | undefined;

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Produto não encontrado</p>
        <Button variant="outline" onClick={() => router.back()}>Voltar</Button>
      </div>
    );
  }

  const handleDelete = async () => {
    try {
      await deleteProduct.mutateAsync(productId);
      addToast("Produto excluído com sucesso!", "success");
      router.push("/estoque/produtos");
    } catch {
      addToast("Erro ao excluir produto. Tente novamente.", "error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Tooltip content="Voltar">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Tooltip>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{product.name}</h1>
              <StatusBadge status={product.status} size="md" />
            </div>
            <p className="font-mono text-sm text-muted-foreground">SKU: {product.sku}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/estoque/produtos/${productId}/edit`}>
            <Button variant="outline">
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </Button>
          </Link>
          <Button variant="destructive" onClick={() => setShowDelete(true)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Excluir
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Preço de Custo</p>
              <p className="text-lg font-bold">{formatCurrency(product.costPrice)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Preço de Venda</p>
              <p className="text-lg font-bold">{formatCurrency(product.salePrice)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
              <Barcode className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">SKU</p>
              <p className="text-lg font-bold font-mono">{product.sku}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Margem</p>
              <p className="text-lg font-bold">
                {product.costPrice > 0
                  ? `${(((product.salePrice - product.costPrice) / product.salePrice) * 100).toFixed(1)}%`
                  : "-"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <ProductGeneralCard product={product} />
      <ProductFiscalCard product={product} />

      <div className="grid gap-6 lg:grid-cols-2">
        <ProductVariantsCard variants={product.variants ?? []} />
        <ProductStockCard
          items={product.inventoryItems ?? []}
          summary={
            product.inventorySummary ?? {
              totalQuantity: 0,
              totalReserved: 0,
              totalAvailable: 0,
            }
          }
        />
      </div>

      <ProductImagesCard images={product.images ?? []} />

      <ConfirmDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        title="Excluir Produto"
        message={`Deseja excluir "${product.name}"? Esta ação não pode ser desfeita.`}
        destructive
        confirmLabel="Excluir"
        loading={deleteProduct.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
