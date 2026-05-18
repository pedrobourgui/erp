/**
 * Factory for building Tenant test data with Brazilian defaults.
 */
export interface FactoryTenant {
  id: string;
  name: string;
  slug: string;
  cnpj: string;
  plan: string;
  status: string;
  email: string;
  phone: string;
  address: string | null;
  createdAt: Date;
  updatedAt: Date;
}

let tenantSeq = 0;

export function buildTenant(overrides: Partial<FactoryTenant> = {}): FactoryTenant {
  tenantSeq++;
  const seq = String(tenantSeq).padStart(3, '0');

  return {
    id: `tenant-uuid-${seq}`,
    name: `Empresa Teste ${seq} LTDA`,
    slug: `empresa-teste-${seq}`,
    cnpj: `12.345.${seq}/0001-99`,
    plan: 'PRO',
    status: 'ACTIVE',
    email: `contato@empresa${seq}.com.br`,
    phone: `+5511900000${seq}`,
    address: `Rua Exemplo, ${seq} - Sao Paulo, SP`,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

export function resetTenantSeq(): void {
  tenantSeq = 0;
}
