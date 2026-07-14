import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import type { ProductInventoryDetail } from "./types";

type ProductStockCardProps = {
  items: ProductInventoryDetail[];
  summary: { totalQuantity: number; totalReserved: number; totalAvailable: number };
};

export function ProductStockCard({ items, summary }: ProductStockCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Estoque</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg border p-3 text-center">
            <p className="text-xs text-muted-foreground">Em estoque</p>
            <p className="text-xl font-bold tabular-nums">{summary.totalQuantity}</p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <p className="text-xs text-muted-foreground">Reservado</p>
            <p className="text-xl font-bold tabular-nums">{summary.totalReserved}</p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <p className="text-xs text-muted-foreground">Disponível</p>
            <p className="text-xl font-bold tabular-nums text-emerald-600">
              {summary.totalAvailable}
            </p>
          </div>
        </div>

        {items.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Sem saldo de estoque registrado.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Depósito</th>
                  <th className="pb-2 pr-4 text-right font-medium">Qtd.</th>
                  <th className="pb-2 pr-4 text-right font-medium">Reservado</th>
                  <th className="pb-2 pr-4 text-right font-medium">Disponível</th>
                  <th className="pb-2 pr-4 text-right font-medium">Mínimo</th>
                  <th className="pb-2 pr-4 text-right font-medium">Custo médio</th>
                  <th className="pb-2 font-medium">Alerta</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const low = item.quantity <= item.minStock;
                  return (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">
                        <span className="font-medium">{item.warehouse.name}</span>
                        <span className="ml-1 font-mono text-xs text-muted-foreground">
                          {item.warehouse.code}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">{item.quantity}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{item.reserved}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{item.available}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{item.minStock}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {formatCurrency(item.costAverage)}
                      </td>
                      <td className="py-2">
                        {low ? (
                          <Badge variant="warning">Estoque baixo</Badge>
                        ) : (
                          <Badge variant="success">OK</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
