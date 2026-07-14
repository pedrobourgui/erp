import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { ProductDetail } from "./types";

type ProductGeneralCardProps = {
  product: ProductDetail;
};

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  SIMPLE: "Simples",
  VARIABLE: "Com variações",
  KIT: "Kit",
  SERVICE: "Serviço",
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value ?? "—"}</p>
    </div>
  );
}

export function ProductGeneralCard({ product }: ProductGeneralCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Informações gerais</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Nome" value={product.name} />
        <Field label="SKU" value={<span className="font-mono">{product.sku}</span>} />
        <Field label="Tipo" value={PRODUCT_TYPE_LABELS[product.type ?? "SIMPLE"] ?? product.type} />
        <Field label="Categoria" value={product.category?.name} />
        <Field label="Marca" value={product.brand?.name} />
        <Field label="Fornecedor" value={product.supplier?.name} />
        <Field label="Preço de custo" value={formatCurrency(product.costPrice)} />
        <Field label="Preço de venda" value={formatCurrency(product.salePrice)} />
        <Field
          label="Preço promocional"
          value={product.promoPrice ? formatCurrency(product.promoPrice) : "—"}
        />
        <div className="sm:col-span-2 lg:col-span-3">
          <Field
            label="Descrição"
            value={
              product.description ? (
                <span className="whitespace-pre-wrap font-normal">{product.description}</span>
              ) : (
                "—"
              )
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}

export function ProductFiscalCard({ product }: ProductGeneralCardProps) {
  const hasDimensions =
    product.weight || product.height || product.width || product.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dados fiscais e dimensões</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="EAN / GTIN" value={product.ean} />
        <Field label="NCM" value={product.ncm} />
        <Field label="CEST" value={product.cest} />
        <Field
          label="Estoque mínimo padrão"
          value={product.defaultMinStock ?? 0}
        />
        {hasDimensions ? (
          <>
            <Field label="Peso (kg)" value={product.weight ?? "—"} />
            <Field label="Altura (cm)" value={product.height ?? "—"} />
            <Field label="Largura (cm)" value={product.width ?? "—"} />
            <Field label="Comprimento (cm)" value={product.length ?? "—"} />
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
