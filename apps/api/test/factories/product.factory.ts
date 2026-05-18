/**
 * Factory for building Product test data with Brazilian defaults.
 */
export interface FactoryProduct {
  id: string;
  tenantId: string;
  name: string;
  sku: string;
  barcode: string | null;
  description: string | null;
  category: string;
  brand: string | null;
  costPrice: number;
  salePrice: number;
  status: string;
  weight: number | null;
  unit: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

let productSeq = 0;

export function buildProduct(overrides: Partial<FactoryProduct> = {}): FactoryProduct {
  productSeq++;
  const seq = String(productSeq).padStart(3, '0');

  return {
    id: `prod-uuid-${seq}`,
    tenantId: 'tenant-uuid-001',
    name: `Produto Teste ${seq}`,
    sku: `SKU-${seq}`,
    barcode: `789${seq.repeat(3).slice(0, 10)}`,
    description: `Descricao do produto teste ${seq}`,
    category: 'Geral',
    brand: 'Marca Teste',
    costPrice: 50.0,
    salePrice: 99.9,
    status: 'ACTIVE',
    weight: 0.5,
    unit: 'UN',
    deletedAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

export function resetProductSeq(): void {
  productSeq = 0;
}
