import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import {
  CreateProductDto,
  UpdateProductDto,
  ProductQueryDto,
  UpdateCategoryDto,
  UpdateBrandDto,
  BrandQueryDto,
} from './dto/product.dto';
import {
  PaginatedResponse,
  buildPaginatedResponse,
  buildPrismaOrderBy,
} from '../../common/utils/pagination';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * List products with pagination, search, and filters.
   */
  async findAll(
    tenantId: string,
    query: ProductQueryDto,
  ): Promise<PaginatedResponse<any>> {
    const {
      page = 1,
      limit = 20,
      search,
      sortBy,
      sortOrder = 'desc',
      categoryId,
      brandId,
      status,
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {
      tenantId,
      deletedAt: null,
    };

    if (status) {
      where.status = status as any;
    }
    if (categoryId) {
      where.categoryId = categoryId;
    }
    if (brandId) {
      where.brandId = brandId;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { ean: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: buildPrismaOrderBy(sortBy, sortOrder),
        include: {
          category: { select: { id: true, name: true } },
          brand: { select: { id: true, name: true } },
          images: {
            where: { isMain: true },
            take: 1,
            select: { id: true, url: true },
          },
          _count: {
            select: { variants: true, inventoryItems: true },
          },
          inventoryItems: {
            select: { quantity: true, reserved: true, available: true },
          },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    // Aggregate inventory across all warehouses
    const enriched = data.map((product) => {
      const inventory = product.inventoryItems.reduce(
        (acc, item) => ({
          totalQuantity: acc.totalQuantity + item.quantity,
          totalReserved: acc.totalReserved + item.reserved,
          totalAvailable: acc.totalAvailable + item.available,
        }),
        { totalQuantity: 0, totalReserved: 0, totalAvailable: 0 },
      );

      const { inventoryItems, ...rest } = product;
      return { ...rest, inventory };
    });

    return buildPaginatedResponse(enriched, total, { page, limit, sortBy, sortOrder });
  }

  /**
   * Get single product by ID with all relations.
   */
  async findOne(tenantId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        brand: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        variants: {
          orderBy: { createdAt: 'asc' },
          include: {
            inventoryItems: {
              select: {
                id: true,
                warehouseId: true,
                quantity: true,
                reserved: true,
                available: true,
              },
            },
          },
        },
        images: { orderBy: { position: 'asc' } },
        inventoryItems: {
          include: {
            warehouse: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Aggregate total inventory
    const inventory = product.inventoryItems.reduce(
      (acc, item) => ({
        totalQuantity: acc.totalQuantity + item.quantity,
        totalReserved: acc.totalReserved + item.reserved,
        totalAvailable: acc.totalAvailable + item.available,
      }),
      { totalQuantity: 0, totalReserved: 0, totalAvailable: 0 },
    );

    return { ...product, inventorySummary: inventory };
  }

  /**
   * Create a product with optional variants.
   */
  async create(tenantId: string, dto: CreateProductDto) {
    const sku = dto.sku || (await this.generateSku(tenantId));

    // Verify SKU uniqueness
    const existing = await this.prisma.product.findFirst({
      where: { tenantId, sku, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException(`Product with SKU "${sku}" already exists`);
    }

    // Calculate sale price from cost + markup if not provided
    let salePrice = dto.salePrice;
    if (!salePrice && dto.markup != null && dto.costPrice > 0) {
      salePrice = dto.costPrice * (1 + dto.markup / 100);
    }
    if (!salePrice) {
      salePrice = dto.costPrice;
    }

    // Validate categoryId exists if provided
    if (dto.categoryId) {
      const category = await this.prisma.category.findFirst({
        where: { id: dto.categoryId, tenantId },
      });
      if (!category) {
        throw new BadRequestException(`Category with id "${dto.categoryId}" not found`);
      }
    }

    // Validate brandId exists if provided
    if (dto.brandId) {
      const brand = await this.prisma.brand.findFirst({
        where: { id: dto.brandId, tenantId },
      });
      if (!brand) {
        throw new BadRequestException(`Brand with id "${dto.brandId}" not found`);
      }
    }

    const product = await this.prisma.product.create({
      data: {
        tenantId,
        sku,
        name: dto.name,
        description: dto.description,
        type: (dto.type as any) || 'SIMPLE',
        status: (dto.status as any) || 'DRAFT',
        ean: dto.ean,
        ncm: dto.ncm,
        cest: dto.cest,
        costPrice: dto.costPrice,
        salePrice,
        promoPrice: dto.promoPrice,
        markup: dto.markup,
        weight: dto.weight,
        height: dto.height,
        width: dto.width,
        length: dto.length,
        categoryId: dto.categoryId || null,
        brandId: dto.brandId || null,
        supplierId: dto.supplierId || null,
        metadata: dto.metadata as any,
        variants: dto.variants?.length
          ? {
              create: dto.variants.map((v) => ({
                sku: v.sku,
                name: v.name,
                ean: v.ean,
                costPrice: v.costPrice,
                salePrice: v.salePrice,
                attributes: v.attributes as any,
                weight: v.weight,
                height: v.height,
                width: v.width,
                length: v.length,
              })),
            }
          : undefined,
      },
      include: {
        variants: true,
        category: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
      },
    });

    this.logger.log(`Product created: ${product.id} (${product.sku}) for tenant ${tenantId}`);
    return product;
  }

  /**
   * Update a product.
   */
  async update(tenantId: string, id: string, dto: UpdateProductDto) {
    const existing = await this.prisma.product.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Product not found');
    }

    // If SKU changed, check uniqueness
    if (dto.sku && dto.sku !== existing.sku) {
      const skuExists = await this.prisma.product.findFirst({
        where: { tenantId, sku: dto.sku, deletedAt: null, id: { not: id } },
      });
      if (skuExists) {
        throw new ConflictException(`Product with SKU "${dto.sku}" already exists`);
      }
    }

    // Recalculate sale price if markup changed
    let salePrice = dto.salePrice;
    if (dto.markup != null && !salePrice) {
      const costPrice = dto.costPrice ?? Number(existing.costPrice);
      if (costPrice > 0) {
        salePrice = costPrice * (1 + dto.markup / 100);
      }
    }

    const { variants: _variants, ...updateData } = dto;

    const product = await this.prisma.product.update({
      where: { id },
      data: {
        ...updateData,
        salePrice: salePrice !== undefined ? salePrice : undefined,
        status: dto.status as any,
        type: dto.type as any,
        metadata: dto.metadata as any,
      },
      include: {
        variants: true,
        category: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
        images: { orderBy: { position: 'asc' } },
      },
    });

    this.logger.log(`Product updated: ${product.id} for tenant ${tenantId}`);
    return product;
  }

  /**
   * Soft delete a product.
   */
  async remove(tenantId: string, id: string) {
    const existing = await this.prisma.product.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Product not found');
    }

    await this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'INACTIVE' },
    });

    this.logger.log(`Product soft-deleted: ${id} for tenant ${tenantId}`);
    return { success: true, message: 'Product deleted successfully' };
  }

  // ─── Categories ──────────────────────────────────────────────────────

  /**
   * Return all categories as a hierarchical tree with product counts.
   */
  async findAllCategories(tenantId: string) {
    const categories = await this.prisma.category.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        parentId: true,
        _count: { select: { products: true } },
      },
    });

    return this.buildCategoryTree(categories);
  }

  /**
   * Get a single category by ID.
   */
  async findOneCategory(tenantId: string, id: string) {
    const category = await this.prisma.category.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        parentId: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { products: true } },
        children: {
          where: { deletedAt: null },
          select: { id: true, name: true, slug: true },
          orderBy: { name: 'asc' },
        },
        parent: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Category with id "${id}" not found`);
    }

    return category;
  }

  /**
   * Create a category with optional parentId. Validates parent exists if provided.
   */
  async createCategory(tenantId: string, dto: { name: string; slug?: string; parentId?: string }) {
    const slug = dto.slug || dto.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    const existing = await this.prisma.category.findFirst({
      where: { tenantId, slug, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException(`Category with slug "${slug}" already exists`);
    }

    if (dto.parentId) {
      const parent = await this.prisma.category.findFirst({
        where: { id: dto.parentId, tenantId, deletedAt: null },
      });
      if (!parent) {
        throw new BadRequestException(`Parent category with id "${dto.parentId}" not found`);
      }
    }

    const category = await this.prisma.category.create({
      data: {
        tenantId,
        name: dto.name,
        slug,
        parentId: dto.parentId || null,
      },
      select: { id: true, name: true, slug: true, parentId: true },
    });

    this.logger.log(`Category created: ${category.id} for tenant ${tenantId}`);
    return category;
  }

  /**
   * Update a category.
   */
  async updateCategory(tenantId: string, id: string, dto: UpdateCategoryDto) {
    const existing = await this.prisma.category.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException(`Category with id "${id}" not found`);
    }

    // If slug is changing, check uniqueness
    const slug = dto.slug || (dto.name ? dto.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') : undefined);
    if (slug && slug !== existing.slug) {
      const slugExists = await this.prisma.category.findFirst({
        where: { tenantId, slug, deletedAt: null, id: { not: id } },
      });
      if (slugExists) {
        throw new ConflictException(`Category with slug "${slug}" already exists`);
      }
    }

    // Validate parentId if provided
    if (dto.parentId !== undefined) {
      if (dto.parentId) {
        if (dto.parentId === id) {
          throw new BadRequestException('A category cannot be its own parent');
        }
        const parent = await this.prisma.category.findFirst({
          where: { id: dto.parentId, tenantId, deletedAt: null },
        });
        if (!parent) {
          throw new BadRequestException(`Parent category with id "${dto.parentId}" not found`);
        }
      }
    }

    const updateData: Record<string, unknown> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (slug !== undefined) updateData.slug = slug;
    if (dto.parentId !== undefined) updateData.parentId = dto.parentId || null;

    const category = await this.prisma.category.update({
      where: { id },
      data: updateData,
      select: { id: true, name: true, slug: true, parentId: true },
    });

    this.logger.log(`Category updated: ${category.id} for tenant ${tenantId}`);
    return category;
  }

  /**
   * Soft delete a category. Fails if products are still using it.
   */
  async removeCategory(tenantId: string, id: string) {
    const existing = await this.prisma.category.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException(`Category with id "${id}" not found`);
    }

    const productCount = await this.prisma.product.count({
      where: { categoryId: id, tenantId, deletedAt: null },
    });
    if (productCount > 0) {
      throw new ConflictException(
        `Cannot delete category: ${productCount} product(s) are still using it`,
      );
    }

    await this.prisma.category.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Category soft-deleted: ${id} for tenant ${tenantId}`);
    return { success: true, message: 'Category deleted successfully' };
  }

  /**
   * Build a nested tree from a flat list of categories.
   */
  private buildCategoryTree(
    categories: Array<{
      id: string;
      name: string;
      slug: string;
      parentId: string | null;
      _count: { products: number };
    }>,
  ) {
    const map = new Map<string, Record<string, unknown>>();
    const roots: Array<Record<string, unknown>> = [];

    for (const cat of categories) {
      map.set(cat.id, { ...cat, children: [] });
    }

    for (const cat of categories) {
      const node = map.get(cat.id)!;
      if (cat.parentId && map.has(cat.parentId)) {
        const parent = map.get(cat.parentId)!;
        (parent.children as Array<Record<string, unknown>>).push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  // ─── Brands ──────────────────────────────────────────────────────────

  /**
   * List all brands with product count and optional search.
   */
  async findAllBrands(tenantId: string, query?: BrandQueryDto) {
    const where: Prisma.BrandWhereInput = {
      tenantId,
      deletedAt: null,
    };

    if (query?.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }

    return this.prisma.brand.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        logo: true,
        _count: { select: { products: true } },
      },
    });
  }

  /**
   * Get a single brand by ID with product count.
   */
  async findOneBrand(tenantId: string, id: string) {
    const brand = await this.prisma.brand.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: {
        id: true,
        name: true,
        logo: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { products: true } },
      },
    });

    if (!brand) {
      throw new NotFoundException(`Brand with id "${id}" not found`);
    }

    return brand;
  }

  /**
   * Create a brand with optional logo.
   */
  async createBrand(tenantId: string, dto: { name: string; logo?: string }) {
    const existing = await this.prisma.brand.findFirst({
      where: { tenantId, name: dto.name, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException(`Brand "${dto.name}" already exists`);
    }

    const brand = await this.prisma.brand.create({
      data: {
        tenantId,
        name: dto.name,
        logo: dto.logo || null,
      },
      select: { id: true, name: true, logo: true },
    });

    this.logger.log(`Brand created: ${brand.id} for tenant ${tenantId}`);
    return brand;
  }

  /**
   * Update a brand.
   */
  async updateBrand(tenantId: string, id: string, dto: UpdateBrandDto) {
    const existing = await this.prisma.brand.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException(`Brand with id "${id}" not found`);
    }

    // If name is changing, check uniqueness
    if (dto.name && dto.name !== existing.name) {
      const nameExists = await this.prisma.brand.findFirst({
        where: { tenantId, name: dto.name, deletedAt: null, id: { not: id } },
      });
      if (nameExists) {
        throw new ConflictException(`Brand "${dto.name}" already exists`);
      }
    }

    const updateData: Record<string, unknown> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.logo !== undefined) updateData.logo = dto.logo;

    const brand = await this.prisma.brand.update({
      where: { id },
      data: updateData,
      select: { id: true, name: true, logo: true },
    });

    this.logger.log(`Brand updated: ${brand.id} for tenant ${tenantId}`);
    return brand;
  }

  /**
   * Soft delete a brand. Fails if products are still using it.
   */
  async removeBrand(tenantId: string, id: string) {
    const existing = await this.prisma.brand.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException(`Brand with id "${id}" not found`);
    }

    const productCount = await this.prisma.product.count({
      where: { brandId: id, tenantId, deletedAt: null },
    });
    if (productCount > 0) {
      throw new ConflictException(
        `Cannot delete brand: ${productCount} product(s) are still using it`,
      );
    }

    await this.prisma.brand.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Brand soft-deleted: ${id} for tenant ${tenantId}`);
    return { success: true, message: 'Brand deleted successfully' };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────

  /**
   * Auto-generate a unique SKU for the tenant.
   */
  private async generateSku(tenantId: string): Promise<string> {
    const count = await this.prisma.product.count({ where: { tenantId } });
    const sequence = (count + 1).toString().padStart(6, '0');
    return `PRD-${sequence}`;
  }
}
