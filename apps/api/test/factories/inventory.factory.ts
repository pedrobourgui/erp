/**
 * Factories for building Inventory test data.
 */
export interface FactoryInventoryItem {
  id: string;
  tenantId: string;
  productId: string;
  variantId: string | null;
  warehouseId: string;
  quantity: number;
  reserved: number;
  available: number;
  minStock: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface FactoryMovement {
  id: string;
  tenantId: string;
  productId: string;
  variantId: string | null;
  type: string;
  reason: string;
  quantity: number;
  unitCost: number | null;
  totalCost: number | null;
  fromWarehouseId: string | null;
  toWarehouseId: string | null;
  referenceType: string | null;
  referenceId: string | null;
  notes: string | null;
  userId: string;
  createdAt: Date;
}

export interface FactoryWarehouse {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  address: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

let inventoryItemSeq = 0;
let movementSeq = 0;
let warehouseSeq = 0;

export function buildInventoryItem(
  overrides: Partial<FactoryInventoryItem> = {},
): FactoryInventoryItem {
  inventoryItemSeq++;
  const seq = String(inventoryItemSeq).padStart(3, '0');

  return {
    id: `ii-uuid-${seq}`,
    tenantId: 'tenant-uuid-001',
    productId: `prod-uuid-${seq}`,
    variantId: null,
    warehouseId: 'wh-uuid-001',
    quantity: 100,
    reserved: 10,
    available: 90,
    minStock: 20,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

export function buildMovement(overrides: Partial<FactoryMovement> = {}): FactoryMovement {
  movementSeq++;
  const seq = String(movementSeq).padStart(3, '0');

  return {
    id: `mov-uuid-${seq}`,
    tenantId: 'tenant-uuid-001',
    productId: `prod-uuid-001`,
    variantId: null,
    type: 'ENTRY',
    reason: 'PURCHASE',
    quantity: 10,
    unitCost: 25.0,
    totalCost: 250.0,
    fromWarehouseId: null,
    toWarehouseId: 'wh-uuid-001',
    referenceType: null,
    referenceId: null,
    notes: null,
    userId: 'user-uuid-001',
    createdAt: new Date('2026-01-01'),
    ...overrides,
  };
}

export function buildWarehouse(overrides: Partial<FactoryWarehouse> = {}): FactoryWarehouse {
  warehouseSeq++;
  const seq = String(warehouseSeq).padStart(3, '0');

  return {
    id: `wh-uuid-${seq}`,
    tenantId: 'tenant-uuid-001',
    name: `Deposito ${seq}`,
    code: `DEP-${seq}`,
    address: `Rua do Deposito, ${seq} - Sao Paulo, SP`,
    isDefault: warehouseSeq === 1,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

export function resetInventorySeq(): void {
  inventoryItemSeq = 0;
  movementSeq = 0;
  warehouseSeq = 0;
}
