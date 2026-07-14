import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import type { ProductVariantDetail } from "./types";

type ProductVariantsCardProps = {
  variants: ProductVariantDetail[];
};

function variantStock(variant: ProductVariantDetail): number {
  return variant.inventoryItems.reduce((sum, item) => sum + item.available, 0);
}

function formatAttributes(attributes?: Record<string, string | number> | null): string {
  if (!attributes || Object.keys(attributes).length === 0) return "—";
  return Object.entries(attributes)
    .map(([key, value]) => `${key}: ${value}`)
    .join(" · ");
}

export function ProductVariantsCard({ variants }: ProductVariantsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Variações ({variants.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {variants.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Este produto não possui variações.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Nome</th>
                  <th className="pb-2 pr-4 font-medium">SKU</th>
                  <th className="pb-2 pr-4 font-medium">Atributos</th>
                  <th className="pb-2 pr-4 text-right font-medium">Preço venda</th>
                  <th className="pb-2 pr-4 text-right font-medium">Estoque</th>
                  <th className="pb-2 font-medium">Situação</th>
                </tr>
              </thead>
              <tbody>
                {variants.map((variant) => (
                  <tr key={variant.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{variant.name}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{variant.sku}</td>
                    <td className="py-2 pr-4 text-muted-foreground">
                      {formatAttributes(variant.attributes)}
                    </td>
                    <td className="py-2 pr-4 text-right">
                      {variant.salePrice != null ? formatCurrency(variant.salePrice) : "—"}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">{variantStock(variant)}</td>
                    <td className="py-2">
                      <Badge variant={variant.isActive ? "success" : "secondary"}>
                        {variant.isActive ? "Ativa" : "Inativa"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
