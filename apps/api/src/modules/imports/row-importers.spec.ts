import { BadRequestException } from '@nestjs/common';
import { ROW_IMPORTERS } from './row-importers';
import { PrismaService } from '../../database/prisma/prisma.service';

const TENANT = 'tenant-a';

function createPrisma() {
  return {
    product: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
    customer: { create: jest.fn().mockResolvedValue({}) },
    accountsPayable: { create: jest.fn().mockResolvedValue({}) },
  } as unknown as PrismaService & {
    product: { findFirst: jest.Mock; create: jest.Mock };
    customer: { create: jest.Mock };
    accountsPayable: { create: jest.Mock };
  };
}

describe('ROW_IMPORTERS', () => {
  let prisma: ReturnType<typeof createPrisma>;

  beforeEach(() => {
    prisma = createPrisma();
  });

  describe('PRODUCTS', () => {
    it('should create a product from a valid row', async () => {
      await ROW_IMPORTERS.PRODUCTS(prisma, TENANT, {
        sku: 'P1',
        name: 'Camiseta',
        salePrice: '49,90',
        costPrice: '20',
      });
      const data = prisma.product.create.mock.calls[0][0].data;
      expect(data).toMatchObject({ tenantId: TENANT, sku: 'P1', salePrice: 49.9, costPrice: 20 });
    });

    it('should reject a missing required field', async () => {
      await expect(
        ROW_IMPORTERS.PRODUCTS(prisma, TENANT, { sku: '', name: 'X', salePrice: '10' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.product.create).not.toHaveBeenCalled();
    });

    it('should reject an invalid number', async () => {
      await expect(
        ROW_IMPORTERS.PRODUCTS(prisma, TENANT, { sku: 'P1', name: 'X', salePrice: 'abc' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject a duplicate SKU', async () => {
      prisma.product.findFirst.mockResolvedValue({ id: 'existing' });
      await expect(
        ROW_IMPORTERS.PRODUCTS(prisma, TENANT, { sku: 'P1', name: 'X', salePrice: '10' }),
      ).rejects.toThrow(/SKU/);
    });
  });

  describe('CUSTOMERS', () => {
    it('should create a customer and infer CNPJ documentType', async () => {
      await ROW_IMPORTERS.CUSTOMERS(prisma, TENANT, {
        name: 'Empresa X',
        document: '12.345.678/0001-99',
      });
      const data = prisma.customer.create.mock.calls[0][0].data;
      expect(data).toMatchObject({ name: 'Empresa X', documentType: 'CNPJ' });
    });

    it('should require a name', async () => {
      await expect(
        ROW_IMPORTERS.CUSTOMERS(prisma, TENANT, { name: '' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('EXPENSES', () => {
    it('should create a payable from a valid row (pt-BR date)', async () => {
      await ROW_IMPORTERS.EXPENSES(prisma, TENANT, {
        description: 'Aluguel',
        amount: '1500,00',
        dueDate: '10/08/2026',
      });
      const data = prisma.accountsPayable.create.mock.calls[0][0].data;
      expect(data).toMatchObject({ description: 'Aluguel', amount: 1500, status: 'PENDING' });
      expect(data.dueDate).toBeInstanceOf(Date);
    });

    it('should reject a non-positive amount', async () => {
      await expect(
        ROW_IMPORTERS.EXPENSES(prisma, TENANT, {
          description: 'X',
          amount: '0',
          dueDate: '2026-08-10',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject an invalid date', async () => {
      await expect(
        ROW_IMPORTERS.EXPENSES(prisma, TENANT, {
          description: 'X',
          amount: '10',
          dueDate: 'not-a-date',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
