import { BadRequestException } from '@nestjs/common';
import { ImportType } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CsvRow } from './csv-parser';

export type RowImporter = (
  prisma: PrismaService,
  tenantId: string,
  row: CsvRow,
) => Promise<void>;

// ─── Field helpers ───────────────────────────────────────────────────────

function required(row: CsvRow, field: string): string {
  const value = row[field]?.trim();
  if (!value) {
    throw new BadRequestException(`Campo obrigatório ausente: ${field}`);
  }
  return value;
}

function parseNumber(row: CsvRow, field: string, opts: { required?: boolean } = {}): number | null {
  const raw = row[field]?.trim();
  if (!raw) {
    if (opts.required) {
      throw new BadRequestException(`Campo numérico obrigatório ausente: ${field}`);
    }
    return null;
  }
  // Accept "1.234,56" (pt-BR) and "1234.56" (dot decimal).
  const normalized = raw.includes(',')
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw;
  const num = Number(normalized);
  if (Number.isNaN(num)) {
    throw new BadRequestException(`Valor numérico inválido em "${field}": ${raw}`);
  }
  return num;
}

function parseDate(row: CsvRow, field: string): Date {
  const raw = required(row, field);
  // Accept ISO (YYYY-MM-DD) and pt-BR (DD/MM/YYYY).
  const brMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const iso = brMatch ? `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}` : raw;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`Data inválida em "${field}": ${raw}`);
  }
  return date;
}

// ─── Domain importers ──────────────────────────────────────────────────────

const importProduct: RowImporter = async (prisma, tenantId, row) => {
  const sku = required(row, 'sku');
  const name = required(row, 'name');
  const salePrice = parseNumber(row, 'salePrice', { required: true })!;
  const costPrice = parseNumber(row, 'costPrice') ?? 0;

  const duplicate = await prisma.product.findFirst({
    where: { tenantId, sku, deletedAt: null },
    select: { id: true },
  });
  if (duplicate) {
    throw new BadRequestException(`Já existe um produto com o SKU ${sku}`);
  }

  await prisma.product.create({
    data: {
      tenantId,
      sku,
      name,
      salePrice,
      costPrice,
      description: row.description || null,
      ncm: row.ncm || null,
      ean: row.ean || null,
      status: 'ACTIVE',
    },
  });
};

const importCustomer: RowImporter = async (prisma, tenantId, row) => {
  const name = required(row, 'name');
  const document = row.document || null;

  await prisma.customer.create({
    data: {
      tenantId,
      name,
      email: row.email || null,
      phone: row.phone || null,
      document,
      documentType: document
        ? document.replace(/\D/g, '').length > 11
          ? 'CNPJ'
          : 'CPF'
        : null,
    },
  });
};

const importExpense: RowImporter = async (prisma, tenantId, row) => {
  const description = required(row, 'description');
  const amount = parseNumber(row, 'amount', { required: true })!;
  if (amount <= 0) {
    throw new BadRequestException('O valor da despesa deve ser maior que zero');
  }
  const dueDate = parseDate(row, 'dueDate');

  await prisma.accountsPayable.create({
    data: {
      tenantId,
      description,
      amount,
      status: 'PENDING',
      dueDate,
      metadata: { source: 'csv-import' },
    },
  });
};

export const ROW_IMPORTERS: Record<ImportType, RowImporter> = {
  PRODUCTS: importProduct,
  CUSTOMERS: importCustomer,
  EXPENSES: importExpense,
};
