import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TruncatedText } from "@/components/ui/truncated-text";
import { cn, formatCurrency } from "@/lib/utils";

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

/**
 * AE-31: the value used to be a plain `<p>` in a grid column. A 255-character
 * name — the schema's own limit — ran past the column and painted over the SKU
 * and Tipo fields next to it, so a long name did not just look bad, it hid two
 * other fields. `min-w-0` gives the column something to clip against.
 */
function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | number | null | undefined;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <TruncatedText
        as="p"
        text={value}
        className={cn("text-sm font-medium", mono && "font-mono")}
      />
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
        <Field label="SKU" value={product.sku} mono />
        <Field label="Tipo" value={PRODUCT_TYPE_LABELS[product.type ?? "SIMPLE"] ?? product.type} />
        <Field label="Categoria" value={product.category?.name} />
        <Field label="Marca" value={product.brand?.name} />
        <Field label="Fornecedor" value={product.supplier?.name} />
        <Field label="Preço de custo" value={formatCurrency(product.costPrice)} />
        <Field label="Preço de venda" value={formatCurrency(product.salePrice)} />
        <Field
          label="Preço promocional"
          value={product.promoPrice ? formatCurrency(product.promoPrice) : null}
        />
        <div className="min-w-0 space-y-1 sm:col-span-2 lg:col-span-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Descrição</p>
          {/* The description is allowed to grow — it has the full width of the
              card and its own line breaks. `break-words` is what keeps a single
              unbroken 2000-character string inside the card anyway. */}
          <p className="whitespace-pre-wrap break-words text-sm font-medium">
            {product.description || "—"}
          </p>
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
            <Field label="Peso (kg)" value={product.weight} />
            <Field label="Altura (cm)" value={product.height} />
            <Field label="Largura (cm)" value={product.width} />
            <Field label="Comprimento (cm)" value={product.length} />
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
