"use client";

import { Loader2, ArrowRightLeft } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { useExchangeOrderItem, type OrderItem } from "@/hooks/use-orders";
import { useProducts, useProduct } from "@/hooks/use-products";
import { getApiErrorMessage } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

type ExchangeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  item: OrderItem | null;
};

type VariantOption = { id: string; name: string; sku: string };

export function ExchangeDialog({ open, onOpenChange, orderId, item }: ExchangeDialogProps) {
  const { addToast } = useToast();
  const exchange = useExchangeOrderItem();
  const { data: productsResp } = useProducts({ limit: 100 });

  const [productId, setProductId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [quantity, setQuantity] = useState<number>(1);

  const { data: productDetailResp } = useProduct(productId, { enabled: !!productId });
  const variants =
    (productDetailResp?.data as { variants?: VariantOption[] } | undefined)?.variants ?? [];

  useEffect(() => {
    if (open && item) {
      setProductId("");
      setVariantId("");
      setQuantity(item.quantity ?? 1);
    }
  }, [open, item]);

  // Reset the variant whenever the product changes.
  useEffect(() => {
    setVariantId("");
  }, [productId]);

  const products = productsResp?.data ?? [];

  const handleSubmit = async () => {
    if (!item || !productId) {
      addToast("Selecione o produto de destino.", "error");
      return;
    }
    try {
      const result = await exchange.mutateAsync({
        id: orderId,
        orderItemId: item.id,
        newProductId: productId,
        newVariantId: variantId || undefined,
        quantity,
      });
      const diff = result.data.difference;
      // VD-19: `toFixed(2)` produz "R$ 11730.00" — ponto decimal e sem
      // separador de milhar. Todo valor exibido passa por formatCurrency.
      const diffMsg =
        diff > 0
          ? ` Diferença a cobrar: ${formatCurrency(diff)}.`
          : diff < 0
            ? ` Diferença a devolver: ${formatCurrency(Math.abs(diff))}.`
            : "";
      addToast(`Troca realizada com sucesso!${diffMsg}`, "success");
      onOpenChange(false);
    } catch (error) {
      addToast(
        getApiErrorMessage(error) ?? "Erro ao realizar a troca. Tente novamente.",
        "error"
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Trocar produto
          </DialogTitle>
          <DialogDescription>
            {item
              ? `Substituir "${item.productName ?? item.product?.name}" por outro produto. O estoque e a diferença financeira são ajustados automaticamente.`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Novo produto *</label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o produto" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {variants.length > 0 && (
            <div className="space-y-1">
              <label className="text-sm font-medium">Variante</label>
              <Select value={variantId} onValueChange={setVariantId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a variante" />
                </SelectTrigger>
                <SelectContent>
                  {variants.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name} ({v.sku})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-sm font-medium">Quantidade</label>
            <Input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="cancel" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={exchange.isPending || !productId}>
            {exchange.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Confirmar troca
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
