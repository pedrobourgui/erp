import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { onlyDigits, formatDocument } from '@erp/validators';
import { toMoney, formatBRL } from '../../common/utils/money.util';

/** One row of the command palette. */
export interface SearchHit {
  id: string;
  /** Main line: the product name, the customer name, the order number. */
  title: string;
  /** Secondary line: SKU, document, customer name. */
  subtitle: string | null;
  /** Where the palette navigates to. */
  href: string;
}

export interface SearchGroup {
  entity: 'customers' | 'products' | 'orders';
  label: string;
  hits: SearchHit[];
}

/** Enough to be useful, few enough to stay readable in a dropdown. */
const HITS_PER_GROUP = 5;
const MIN_QUERY_LENGTH = 2;

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Global search across customers, products and orders (AE-18).
   *
   * Every group is gated by the caller's own permission: a seller searching
   * must not get a hit list that reveals rows they cannot open. Narrowing the
   * **response** rather than only the route is the rule the dashboard KPIs
   * established in lote 4.
   */
  async search(
    tenantId: string,
    query: string,
    permissions: readonly string[],
    roleName?: string | null,
  ): Promise<SearchGroup[]> {
    const term = (query ?? '').trim();
    if (term.length < MIN_QUERY_LENGTH) return [];

    const can = (permission: string) =>
      roleName === 'owner' ||
      roleName === 'admin' ||
      permissions.includes(permission);

    const groups = await Promise.all([
      can('customers:read') ? this.searchCustomers(tenantId, term) : null,
      can('products:read') ? this.searchProducts(tenantId, term) : null,
      can('orders:read') ? this.searchOrders(tenantId, term) : null,
    ]);

    return groups.filter((group): group is SearchGroup => !!group && group.hits.length > 0);
  }

  private async searchCustomers(tenantId: string, term: string): Promise<SearchGroup> {
    // AE-15: documents are stored as digits, so a search for "529.982.247-25"
    // has to be unmasked before it can match anything.
    const digits = onlyDigits(term);

    const customers = await this.prisma.customer.findMany({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { email: { contains: term, mode: 'insensitive' } },
          ...(digits.length >= 3 ? [{ document: { contains: digits } }] : []),
        ],
      },
      select: { id: true, name: true, document: true, documentType: true },
      take: HITS_PER_GROUP,
      orderBy: { name: 'asc' },
    });

    return {
      entity: 'customers',
      label: 'Clientes',
      hits: customers.map((customer) => ({
        id: customer.id,
        title: customer.name,
        subtitle: customer.document ? formatDocument(customer.document) : null,
        href: `/clientes/${customer.id}`,
      })),
    };
  }

  private async searchProducts(tenantId: string, term: string): Promise<SearchGroup> {
    const products = await this.prisma.product.findMany({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { sku: { contains: term, mode: 'insensitive' } },
          { ean: { contains: term, mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true, sku: true, salePrice: true },
      take: HITS_PER_GROUP,
      orderBy: { name: 'asc' },
    });

    return {
      entity: 'products',
      label: 'Produtos',
      hits: products.map((product) => ({
        id: product.id,
        title: product.name,
        subtitle: `${product.sku} · ${formatBRL(toMoney(product.salePrice))}`,
        href: `/estoque/produtos/${product.id}`,
      })),
    };
  }

  private async searchOrders(tenantId: string, term: string): Promise<SearchGroup> {
    const orders = await this.prisma.order.findMany({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          { orderNumber: { contains: term, mode: 'insensitive' } },
          { customer: { name: { contains: term, mode: 'insensitive' } } },
        ],
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        customer: { select: { name: true } },
      },
      take: HITS_PER_GROUP,
      orderBy: { createdAt: 'desc' },
    });

    return {
      entity: 'orders',
      label: 'Pedidos',
      hits: orders.map((order) => ({
        id: order.id,
        title: order.orderNumber,
        subtitle: order.customer?.name ?? null,
        href: `/vendas/pedidos/${order.id}`,
      })),
    };
  }
}
