import { PrismaClient, AccountType, TaxRegime, ProductStatus, ProductType } from '@prisma/client';
import { PERMISSION_DEFINITIONS, ROLE_DEFINITIONS } from '@erp/constants';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Permissions and roles come from @erp/constants — the single source of truth
// shared with the API guards and the frontend gating (lote 4). Editing the
// matrix here would recreate the divergence that made the constants package
// describe permissions the database never had.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

async function seedPermissions() {
  console.log('Seeding permissions...');
  const permissions = [];
  for (const perm of PERMISSION_DEFINITIONS) {
    const created = await prisma.permission.upsert({
      where: { resource_action: { resource: perm.resource, action: perm.action } },
      update: { description: perm.description },
      create: perm,
    });
    permissions.push(created);
  }
  return permissions;
}

async function seedTenant() {
  console.log('Seeding tenant...');
  return prisma.tenant.upsert({
    where: { id: 'seed-tenant-001' },
    update: {},
    create: {
      id: 'seed-tenant-001',
      name: 'Loja Exemplo Ltda',
      // AE-04/AE-15: digits only, and a CNPJ that passes its own check digit.
      // `12345678000190` is a placeholder the system's validator rejects, so a
      // freshly seeded base could not save the company form at all — every
      // submit died on "CNPJ inválido" for data the seed itself wrote.
      document: '11222333000181',
      email: 'contato@lojaexemplo.com.br',
      phone: '(11) 3456-7890',
      plan: 'STARTER',
      status: 'ACTIVE',
      taxRegime: TaxRegime.SIMPLES_NACIONAL,
      maxUsers: 10,
      maxProducts: 5000,
      maxOrders: 10000,
      maxWarehouses: 3,
      addressStreet: 'Rua Augusta',
      addressNumber: '1500',
      addressComplement: 'Sala 42',
      addressNeighborhood: 'Consolação',
      addressCity: 'São Paulo',
      addressState: 'SP',
      addressZipCode: '01304-001',
      settings: {
        currency: 'BRL',
        timezone: 'America/Sao_Paulo',
        language: 'pt-BR',
      },
    },
  });
}

async function seedRolesAndAssign(
  tenantId: string,
  permissions: { id: string; resource: string; action: string }[],
) {
  console.log('Seeding roles...');
  const roleMap: Record<string, string> = {};

  for (const def of ROLE_DEFINITIONS) {
    const role = await prisma.role.upsert({
      where: { tenantId_name: { tenantId, name: def.name } },
      update: { description: def.description },
      create: {
        tenantId,
        name: def.name,
        description: def.description,
        isSystem: true,
      },
    });

    roleMap[def.name] = role.id;

    // Assign permissions
    const matched = permissions.filter((p) =>
      def.grants({ resource: p.resource, action: p.action }),
    );
    for (const perm of matched) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        update: {},
        create: { roleId: role.id, permissionId: perm.id },
      });
    }
  }

  return roleMap;
}

async function seedUsers(tenantId: string, roleMap: Record<string, string>) {
  console.log('Seeding users...');
  const salt = await bcrypt.genSalt(10);

  const admin = await prisma.user.upsert({
    where: { tenantId_email: { tenantId, email: 'admin@admin.com' } },
    update: {},
    create: {
      tenantId,
      email: 'admin@admin.com',
      password: await bcrypt.hash('123456', salt),
      name: 'Administrador',
      phone: '(11) 99999-0001',
      status: 'ACTIVE',
      roleId: roleMap['owner'],
    },
  });

  const seller = await prisma.user.upsert({
    where: { tenantId_email: { tenantId, email: 'vendedor@exemplo.com' } },
    update: {},
    create: {
      tenantId,
      email: 'vendedor@exemplo.com',
      password: await bcrypt.hash('Vendedor@123', salt),
      name: 'Ana Vendedora',
      phone: '(11) 99999-0002',
      status: 'ACTIVE',
      roleId: roleMap['seller'],
    },
  });

  return { admin, seller };
}

async function seedCategories(tenantId: string) {
  console.log('Seeding categories...');
  const names = [
    { name: 'Eletrônicos', slug: 'eletronicos' },
    { name: 'Roupas', slug: 'roupas' },
    { name: 'Acessórios', slug: 'acessorios' },
    { name: 'Casa & Decoração', slug: 'casa-decoracao' },
    { name: 'Esportes', slug: 'esportes' },
  ];

  const categories: Record<string, string> = {};
  for (const cat of names) {
    const created = await prisma.category.upsert({
      where: { tenantId_slug: { tenantId, slug: cat.slug } },
      update: {},
      create: { tenantId, name: cat.name, slug: cat.slug },
    });
    categories[cat.slug] = created.id;
  }
  return categories;
}

async function seedBrands(tenantId: string) {
  console.log('Seeding brands...');
  const brandNames = ['Samsung', 'Nike', 'Apple'];
  const brands: Record<string, string> = {};

  for (const name of brandNames) {
    const created = await prisma.brand.upsert({
      where: { tenantId_name: { tenantId, name } },
      update: {},
      create: { tenantId, name },
    });
    brands[name] = created.id;
  }
  return brands;
}

async function seedWarehouse(tenantId: string) {
  console.log('Seeding warehouse...');
  return prisma.warehouse.upsert({
    where: { tenantId_code: { tenantId, code: 'DEP-001' } },
    update: {},
    create: {
      tenantId,
      name: 'Depósito Principal',
      code: 'DEP-001',
      address: 'Rua Augusta, 1500 - Fundos - São Paulo/SP',
      isDefault: true,
      isActive: true,
    },
  });
}

async function seedProducts(
  tenantId: string,
  categories: Record<string, string>,
  brands: Record<string, string>,
  warehouseId: string,
) {
  console.log('Seeding products...');

  const products = [
    {
      sku: 'ELET-001',
      name: 'Smartphone Galaxy S24 128GB',
      description: 'Smartphone Samsung Galaxy S24 128GB, 5G, Tela 6.2"',
      type: ProductType.SIMPLE,
      status: ProductStatus.ACTIVE,
      ean: '7891234567890',
      ncm: '8517.13.00',
      costPrice: 2800.0,
      salePrice: 3999.9,
      weight: 0.168,
      categoryId: categories['eletronicos'],
      brandId: brands['Samsung'],
      stock: 25,
    },
    {
      sku: 'ELET-002',
      name: 'Fone Bluetooth Galaxy Buds FE',
      description: 'Fone de ouvido Bluetooth Samsung Galaxy Buds FE com ANC',
      type: ProductType.SIMPLE,
      status: ProductStatus.ACTIVE,
      ean: '7891234567891',
      ncm: '8518.30.00',
      costPrice: 250.0,
      salePrice: 449.9,
      weight: 0.058,
      categoryId: categories['eletronicos'],
      brandId: brands['Samsung'],
      stock: 50,
    },
    {
      sku: 'ELET-003',
      name: 'iPhone 15 Pro 256GB',
      description: 'Apple iPhone 15 Pro 256GB, Titanium, Tela 6.1"',
      type: ProductType.SIMPLE,
      status: ProductStatus.ACTIVE,
      ean: '7891234567892',
      ncm: '8517.13.00',
      costPrice: 5500.0,
      salePrice: 7999.0,
      weight: 0.187,
      categoryId: categories['eletronicos'],
      brandId: brands['Apple'],
      stock: 15,
    },
    {
      sku: 'ROUP-001',
      name: 'Camiseta Nike Dri-FIT Masculina',
      description: 'Camiseta esportiva Nike Dri-FIT, tecnologia de secagem rápida',
      type: ProductType.VARIABLE,
      status: ProductStatus.ACTIVE,
      ean: '7891234567893',
      ncm: '6109.10.00',
      costPrice: 79.9,
      salePrice: 149.9,
      weight: 0.18,
      categoryId: categories['roupas'],
      brandId: brands['Nike'],
      stock: 100,
    },
    {
      sku: 'ROUP-002',
      name: 'Bermuda Nike Flex Stride',
      description: 'Bermuda de corrida Nike Flex Stride 7"',
      type: ProductType.SIMPLE,
      status: ProductStatus.ACTIVE,
      ean: '7891234567894',
      ncm: '6203.42.00',
      costPrice: 120.0,
      salePrice: 229.9,
      weight: 0.15,
      categoryId: categories['roupas'],
      brandId: brands['Nike'],
      stock: 60,
    },
    {
      sku: 'ACESS-001',
      name: 'Capinha iPhone 15 Pro Silicone',
      description: 'Capinha protetora de silicone para iPhone 15 Pro, MagSafe',
      type: ProductType.SIMPLE,
      status: ProductStatus.ACTIVE,
      ean: '7891234567895',
      ncm: '3926.90.90',
      costPrice: 35.0,
      salePrice: 89.9,
      weight: 0.03,
      categoryId: categories['acessorios'],
      brandId: brands['Apple'],
      stock: 200,
    },
    {
      sku: 'ACESS-002',
      name: 'Carregador USB-C 20W Apple',
      description: 'Carregador rápido Apple USB-C 20W',
      type: ProductType.SIMPLE,
      status: ProductStatus.ACTIVE,
      ean: '7891234567896',
      ncm: '8504.40.90',
      costPrice: 95.0,
      salePrice: 199.0,
      weight: 0.06,
      categoryId: categories['acessorios'],
      brandId: brands['Apple'],
      stock: 80,
    },
    {
      sku: 'CASA-001',
      name: 'Smart TV Samsung 55" 4K Crystal',
      description: 'Smart TV Samsung 55" 4K UHD Crystal, Tizen, HDR10+',
      type: ProductType.SIMPLE,
      status: ProductStatus.ACTIVE,
      ean: '7891234567897',
      ncm: '8528.72.00',
      costPrice: 2200.0,
      salePrice: 3299.0,
      weight: 12.5,
      categoryId: categories['casa-decoracao'],
      brandId: brands['Samsung'],
      stock: 10,
    },
    {
      sku: 'ESP-001',
      name: 'Tênis Nike Air Zoom Pegasus 40',
      description: 'Tênis de corrida Nike Air Zoom Pegasus 40, React foam',
      type: ProductType.VARIABLE,
      status: ProductStatus.ACTIVE,
      ean: '7891234567898',
      ncm: '6404.11.00',
      costPrice: 350.0,
      salePrice: 699.9,
      weight: 0.28,
      categoryId: categories['esportes'],
      brandId: brands['Nike'],
      stock: 40,
    },
    {
      sku: 'ESP-002',
      name: 'Bola de Futebol Nike Flight',
      description: 'Bola de futebol Nike Flight, padrão FIFA, Aerowsculpt',
      type: ProductType.SIMPLE,
      status: ProductStatus.ACTIVE,
      ean: '7891234567899',
      ncm: '9506.62.00',
      costPrice: 180.0,
      salePrice: 349.9,
      weight: 0.45,
      categoryId: categories['esportes'],
      brandId: brands['Nike'],
      stock: 30,
    },
  ];

  const createdProducts: { id: string; stock: number }[] = [];

  for (const p of products) {
    const { stock, ...productData } = p;
    const product = await prisma.product.upsert({
      where: { tenantId_sku: { tenantId, sku: p.sku } },
      update: {},
      create: { tenantId, ...productData },
    });
    createdProducts.push({ id: product.id, stock });
  }

  // Seed inventory for each product
  console.log('Seeding inventory...');
  for (const prod of createdProducts) {
    await prisma.inventoryItem.upsert({
      where: {
        productId_variantId_warehouseId: {
          productId: prod.id,
          variantId: '', // Prisma uses empty string for null in compound unique
          warehouseId: warehouseId,
        },
      },
      update: { quantity: prod.stock, available: prod.stock },
      create: {
        tenantId,
        productId: prod.id,
        warehouseId: warehouseId,
        quantity: prod.stock,
        reserved: 0,
        available: prod.stock,
        minStock: 5,
      },
    });
  }

  return createdProducts;
}

async function seedCustomers(tenantId: string) {
  console.log('Seeding customers...');

  const customers = [
    {
      name: 'Maria da Silva Santos',
      email: 'maria.silva@email.com.br',
      phone: '(11) 98765-4321',
      document: '123.456.789-09',
      documentType: 'CPF',
      address: {
        street: 'Rua das Flores',
        number: '123',
        neighborhood: 'Jardim Paulista',
        city: 'São Paulo',
        state: 'SP',
        zipCode: '01401-000',
      },
    },
    {
      name: 'João Pedro de Oliveira',
      email: 'joao.oliveira@email.com.br',
      phone: '(21) 97654-3210',
      document: '987.654.321-00',
      documentType: 'CPF',
      address: {
        street: 'Avenida Atlântica',
        number: '456',
        complement: 'Apto 1201',
        neighborhood: 'Copacabana',
        city: 'Rio de Janeiro',
        state: 'RJ',
        zipCode: '22010-000',
      },
    },
    {
      name: 'Ana Beatriz Costa Ferreira',
      email: 'ana.ferreira@email.com.br',
      phone: '(31) 96543-2109',
      document: '456.789.123-45',
      documentType: 'CPF',
      address: {
        street: 'Rua da Bahia',
        number: '789',
        neighborhood: 'Centro',
        city: 'Belo Horizonte',
        state: 'MG',
        zipCode: '30160-011',
      },
    },
    {
      name: 'Ricardo Almeida Souza',
      email: 'ricardo.souza@email.com.br',
      phone: '(41) 95432-1098',
      document: '321.654.987-12',
      documentType: 'CPF',
      address: {
        street: 'Rua XV de Novembro',
        number: '1050',
        complement: 'Sala 301',
        neighborhood: 'Centro',
        city: 'Curitiba',
        state: 'PR',
        zipCode: '80020-310',
      },
    },
    {
      name: 'Fernanda Lima Rodrigues',
      email: 'fernanda.rodrigues@email.com.br',
      phone: '(51) 94321-0987',
      document: '654.321.987-78',
      documentType: 'CPF',
      address: {
        street: 'Avenida Ipiranga',
        number: '6681',
        neighborhood: 'Partenon',
        city: 'Porto Alegre',
        state: 'RS',
        zipCode: '90619-900',
      },
    },
  ];

  for (const c of customers) {
    const { address, ...customerData } = c;
    const customer = await prisma.customer.upsert({
      where: { id: `seed-customer-${customerData.document}` },
      update: {},
      create: {
        id: `seed-customer-${customerData.document}`,
        tenantId,
        ...customerData,
        addresses: {
          create: {
            label: 'Principal',
            street: address.street,
            number: address.number,
            complement: (address as any).complement || null,
            neighborhood: address.neighborhood,
            city: address.city,
            state: address.state,
            zipCode: address.zipCode,
            isDefault: true,
          },
        },
      },
    });
  }
}

async function seedFinancialAccounts(tenantId: string) {
  console.log('Seeding financial accounts...');
  const accounts: { name: string; type: string; code?: string; bankName?: string; acceptsDirectSales?: boolean }[] = [
    { name: 'Caixa Principal', type: 'CASH', code: 'CX01', acceptsDirectSales: true },
    { name: 'Santander', type: 'CHECKING', code: 'STD', bankName: 'Santander' },
    { name: 'Banco do Brasil', type: 'CHECKING', code: 'BB', bankName: 'Banco do Brasil' },
    { name: 'Conta Digital', type: 'DIGITAL', code: 'DIG', bankName: 'Nubank' },
  ];
  // Idempotente por (tenantId, name): `create().catch()` silencioso duplicava a
  // base a cada `db:seed` — cinco "Caixa Principal", seis "Dinheiro" — e o PDV
  // passava a oferecer o mesmo método várias vezes.
  for (const a of accounts) {
    const existing = await prisma.financialAccount.findFirst({
      where: { tenantId, name: a.name },
      select: { id: true },
    });
    const data = {
      tenantId,
      name: a.name,
      type: a.type as any,
      code: a.code,
      bankName: a.bankName,
      acceptsDirectSales: a.acceptsDirectSales ?? false,
      isActive: true,
    };
    if (existing) {
      await prisma.financialAccount.update({ where: { id: existing.id }, data });
    } else {
      await prisma.financialAccount.create({ data });
    }
  }
}

/** Tipos liquidados na hora — a API exige conta vinculada neles (SCRUM-30). */
const IMMEDIATE_METHOD_TYPES = ['CASH', 'PIX', 'DEBIT_CARD'];

async function seedPaymentMethods(tenantId: string) {
  console.log('Seeding payment methods...');
  const methods: { name: string; type: string; fiscalCode: string; requiresAuthorization: boolean; feePercentage?: number; settlementDays?: number }[] = [
    { name: 'Dinheiro', type: 'CASH', fiscalCode: '01', requiresAuthorization: false },
    { name: 'PIX', type: 'PIX', fiscalCode: '17', requiresAuthorization: false },
    { name: 'Cartão de Crédito', type: 'CREDIT_CARD', fiscalCode: '03', requiresAuthorization: true, feePercentage: 3.19, settlementDays: 30 },
    { name: 'Cartão de Débito', type: 'DEBIT_CARD', fiscalCode: '04', requiresAuthorization: true, feePercentage: 1.59, settlementDays: 1 },
    { name: 'Boleto', type: 'BOLETO', fiscalCode: '15', requiresAuthorization: false, settlementDays: 3 },
    { name: 'Transferência Bancária', type: 'BANK_TRANSFER', fiscalCode: '03', requiresAuthorization: false, settlementDays: 1 },
  ];
  // Métodos à vista precisam de conta financeira vinculada: sem ela a API recusa
  // a venda (SCRUM-30) e o PDV fica travado numa base recém-semeada — o operador
  // não tem como adivinhar que falta configurar isso. O seed já entrega ligado.
  const cashAccount = await prisma.financialAccount.findFirst({
    where: { tenantId, acceptsDirectSales: true },
    select: { id: true },
  });

  for (const m of methods) {
    const existing = await prisma.paymentMethod.findFirst({
      where: { tenantId, name: m.name },
      select: { id: true },
    });
    const data = {
      tenantId,
      name: m.name,
      type: m.type as any,
      fiscalCode: m.fiscalCode,
      requiresAuthorization: m.requiresAuthorization,
      feePercentage: m.feePercentage ?? 0,
      settlementDays: m.settlementDays ?? 0,
      defaultAccountId: IMMEDIATE_METHOD_TYPES.includes(m.type)
        ? cashAccount?.id ?? null
        : null,
      isActive: true,
    };
    if (existing) {
      await prisma.paymentMethod.update({ where: { id: existing.id }, data });
    } else {
      await prisma.paymentMethod.create({ data });
    }
  }
}

async function seedPaymentConditions(tenantId: string) {
  console.log('Seeding payment conditions...');
  const conditions: { name: string; code: string; type: string; installments: number; daysBetweenInstallments: number; entryPercentage: number }[] = [
    { name: 'À Vista', code: 'AV', type: 'CASH', installments: 1, daysBetweenInstallments: 0, entryPercentage: 0 },
    { name: '30 dias', code: '30D', type: 'INSTALLMENT', installments: 1, daysBetweenInstallments: 30, entryPercentage: 0 },
    { name: '2x sem juros', code: '2X', type: 'INSTALLMENT', installments: 2, daysBetweenInstallments: 30, entryPercentage: 0 },
    { name: '3x sem juros', code: '3X', type: 'INSTALLMENT', installments: 3, daysBetweenInstallments: 30, entryPercentage: 0 },
    { name: '30/60/90', code: '30-60-90', type: 'INSTALLMENT', installments: 3, daysBetweenInstallments: 30, entryPercentage: 0 },
    { name: 'Entrada 30% + 2x', code: 'E30-2X', type: 'ENTRY_PLUS_INSTALLMENT', installments: 2, daysBetweenInstallments: 30, entryPercentage: 30 },
  ];
  for (const c of conditions) {
    await prisma.paymentCondition.create({
      data: {
        tenantId,
        name: c.name,
        code: c.code,
        type: c.type as any,
        installments: c.installments,
        daysBetweenInstallments: c.daysBetweenInstallments,
        entryPercentage: c.entryPercentage,
        isActive: true,
      },
    }).catch(() => {
      // Ignore duplicates on re-seed
    });
  }
}

async function seedChartOfAccounts(tenantId: string) {
  console.log('Seeding chart of accounts...');

  const accounts: { code: string; name: string; type: AccountType; parentCode?: string }[] = [
    // Level 1 – groups
    { code: '1', name: 'Ativo', type: AccountType.ASSET },
    { code: '2', name: 'Passivo', type: AccountType.LIABILITY },
    { code: '3', name: 'Patrimônio Líquido', type: AccountType.EQUITY },
    { code: '4', name: 'Receitas', type: AccountType.REVENUE },
    { code: '5', name: 'Despesas', type: AccountType.EXPENSE },

    // Level 2 – Asset
    { code: '1.1', name: 'Ativo Circulante', type: AccountType.ASSET, parentCode: '1' },
    { code: '1.2', name: 'Ativo Não Circulante', type: AccountType.ASSET, parentCode: '1' },

    // Level 2 – Liability
    { code: '2.1', name: 'Passivo Circulante', type: AccountType.LIABILITY, parentCode: '2' },
    { code: '2.2', name: 'Passivo Não Circulante', type: AccountType.LIABILITY, parentCode: '2' },

    // Level 3 – Asset detail
    { code: '1.1.01', name: 'Caixa', type: AccountType.ASSET, parentCode: '1.1' },
    { code: '1.1.02', name: 'Bancos Conta Movimento', type: AccountType.ASSET, parentCode: '1.1' },
    { code: '1.1.03', name: 'Contas a Receber', type: AccountType.ASSET, parentCode: '1.1' },
    { code: '1.1.04', name: 'Estoques', type: AccountType.ASSET, parentCode: '1.1' },

    // Level 3 – Liability detail
    { code: '2.1.01', name: 'Fornecedores', type: AccountType.LIABILITY, parentCode: '2.1' },
    { code: '2.1.02', name: 'Obrigações Trabalhistas', type: AccountType.LIABILITY, parentCode: '2.1' },
    { code: '2.1.03', name: 'Obrigações Tributárias', type: AccountType.LIABILITY, parentCode: '2.1' },

    // Level 2 – Equity detail
    { code: '3.1', name: 'Capital Social', type: AccountType.EQUITY, parentCode: '3' },
    { code: '3.2', name: 'Reservas de Lucros', type: AccountType.EQUITY, parentCode: '3' },

    // Level 2 – Revenue detail
    { code: '4.1', name: 'Receita de Vendas', type: AccountType.REVENUE, parentCode: '4' },
    { code: '4.2', name: 'Receitas Financeiras', type: AccountType.REVENUE, parentCode: '4' },
    { code: '4.3', name: 'Outras Receitas', type: AccountType.REVENUE, parentCode: '4' },

    // Level 2 – Expense detail
    { code: '5.1', name: 'Custo das Mercadorias Vendidas (CMV)', type: AccountType.EXPENSE, parentCode: '5' },
    { code: '5.2', name: 'Despesas Operacionais', type: AccountType.EXPENSE, parentCode: '5' },
    { code: '5.3', name: 'Despesas Administrativas', type: AccountType.EXPENSE, parentCode: '5' },
    { code: '5.4', name: 'Despesas Financeiras', type: AccountType.EXPENSE, parentCode: '5' },
    { code: '5.5', name: 'Impostos e Taxas', type: AccountType.EXPENSE, parentCode: '5' },
  ];

  // Build a map of code -> id for parent references
  const codeIdMap: Record<string, string> = {};

  for (const acc of accounts) {
    const parentId = acc.parentCode ? codeIdMap[acc.parentCode] : undefined;
    const created = await prisma.chartOfAccounts.upsert({
      where: { tenantId_code: { tenantId, code: acc.code } },
      update: { name: acc.name },
      create: {
        tenantId,
        code: acc.code,
        name: acc.name,
        type: acc.type,
        parentId: parentId || null,
      },
    });
    codeIdMap[acc.code] = created.id;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Starting seed...\n');

  const permissions = await seedPermissions();
  const tenant = await seedTenant();
  const roleMap = await seedRolesAndAssign(tenant.id, permissions);
  await seedUsers(tenant.id, roleMap);
  await seedCategories(tenant.id);
  const brands = await seedBrands(tenant.id);
  const categories = await seedCategories(tenant.id);
  const warehouse = await seedWarehouse(tenant.id);
  await seedProducts(tenant.id, categories, brands, warehouse.id);
  await seedCustomers(tenant.id);
  await seedFinancialAccounts(tenant.id);
  await seedPaymentMethods(tenant.id);
  await seedPaymentConditions(tenant.id);
  await seedChartOfAccounts(tenant.id);

  console.log('\nSeed completed successfully!');
  console.log('  Tenant: Loja Exemplo Ltda');
  console.log('  Admin : admin@admin.com / 123456');
  console.log('  Seller: vendedor@exemplo.com / Vendedor@123');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
