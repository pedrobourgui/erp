/**
 * Factory for building Customer test data with Brazilian defaults.
 */
export interface FactoryCustomer {
  id: string;
  tenantId: string;
  name: string;
  email: string | null;
  phone: string | null;
  document: string | null;
  documentType: string;
  type: string;
  status: string;
  notes: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

let customerSeq = 0;

export function buildCustomer(overrides: Partial<FactoryCustomer> = {}): FactoryCustomer {
  customerSeq++;
  const seq = String(customerSeq).padStart(3, '0');

  return {
    id: `cust-uuid-${seq}`,
    tenantId: 'tenant-uuid-001',
    name: `Cliente Teste ${seq}`,
    email: `cliente${seq}@email.com.br`,
    phone: `+55119${seq.repeat(3).slice(0, 8)}`,
    document: `${seq}.${seq}.${seq}-00`,
    documentType: 'CPF',
    type: 'INDIVIDUAL',
    status: 'ACTIVE',
    notes: null,
    deletedAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

export function buildCustomerCorporate(overrides: Partial<FactoryCustomer> = {}): FactoryCustomer {
  return buildCustomer({
    type: 'CORPORATE',
    documentType: 'CNPJ',
    document: '12.345.678/0001-99',
    name: 'Empresa Cliente LTDA',
    ...overrides,
  });
}

export function resetCustomerSeq(): void {
  customerSeq = 0;
}
