import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import {
  CreateProductDto,
  UpdateProductDto,
  ProductQueryDto,
  CreateCategoryDto,
  UpdateCategoryDto,
  CreateBrandDto,
  UpdateBrandDto,
  BrandQueryDto,
} from './dto/product.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentTenant } from '../../common/decorators/tenant.decorator';

@ApiTags('Products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @RequirePermissions('products:read')
  @ApiOperation({ summary: 'List products with pagination, search, and filters' })
  async findAll(
    @CurrentTenant() tenantId: string,
    @Query() query: ProductQueryDto,
  ) {
    return this.productsService.findAll(tenantId, query);
  }

  // ─── Categories ──────────────────────────────────────────────────────

  @Get('categories')
  @RequirePermissions('products:read')
  @ApiOperation({ summary: 'List all categories as hierarchical tree' })
  async findAllCategories(@CurrentTenant() tenantId: string) {
    const categories = await this.productsService.findAllCategories(tenantId);
    return { success: true, data: categories };
  }

  @Get('categories/:id')
  @RequirePermissions('products:read')
  @ApiOperation({ summary: 'Get a single category by ID' })
  async findOneCategory(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    const category = await this.productsService.findOneCategory(tenantId, id);
    return { success: true, data: category };
  }

  @Post('categories')
  @RequirePermissions('products:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new category' })
  async createCategory(@CurrentTenant() tenantId: string, @Body() dto: CreateCategoryDto) {
    const category = await this.productsService.createCategory(tenantId, dto);
    return { success: true, data: category };
  }

  @Patch('categories/:id')
  @RequirePermissions('products:update')
  @ApiOperation({ summary: 'Update a category' })
  async updateCategory(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    const category = await this.productsService.updateCategory(tenantId, id, dto);
    return { success: true, data: category };
  }

  @Delete('categories/:id')
  @RequirePermissions('products:delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft delete a category' })
  async removeCategory(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.productsService.removeCategory(tenantId, id);
  }

  // ─── Brands ──────────────────────────────────────────────────────────

  @Get('brands')
  @RequirePermissions('products:read')
  @ApiOperation({ summary: 'List all brands with product count and optional search' })
  async findAllBrands(
    @CurrentTenant() tenantId: string,
    @Query() query: BrandQueryDto,
  ) {
    const brands = await this.productsService.findAllBrands(tenantId, query);
    return { success: true, data: brands };
  }

  @Get('brands/:id')
  @RequirePermissions('products:read')
  @ApiOperation({ summary: 'Get a single brand by ID with product count' })
  async findOneBrand(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    const brand = await this.productsService.findOneBrand(tenantId, id);
    return { success: true, data: brand };
  }

  @Post('brands')
  @RequirePermissions('products:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new brand' })
  async createBrand(@CurrentTenant() tenantId: string, @Body() dto: CreateBrandDto) {
    const brand = await this.productsService.createBrand(tenantId, dto);
    return { success: true, data: brand };
  }

  @Patch('brands/:id')
  @RequirePermissions('products:update')
  @ApiOperation({ summary: 'Update a brand' })
  async updateBrand(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateBrandDto,
  ) {
    const brand = await this.productsService.updateBrand(tenantId, id, dto);
    return { success: true, data: brand };
  }

  @Delete('brands/:id')
  @RequirePermissions('products:delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft delete a brand' })
  async removeBrand(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.productsService.removeBrand(tenantId, id);
  }

  // ─── Product by ID ─────────────────────────────────────────────────

  @Get(':id')
  @RequirePermissions('products:read')
  @ApiOperation({ summary: 'Get product by ID with variants, images, and inventory' })
  async findOne(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    const product = await this.productsService.findOne(tenantId, id);
    return { success: true, data: product };
  }

  @Post()
  @RequirePermissions('products:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new product with optional variants' })
  async create(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateProductDto,
  ) {
    const product = await this.productsService.create(tenantId, dto);
    return { success: true, data: product };
  }

  @Patch(':id')
  @RequirePermissions('products:update')
  @ApiOperation({ summary: 'Update a product' })
  async update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    const product = await this.productsService.update(tenantId, id, dto);
    return { success: true, data: product };
  }

  @Delete(':id')
  @RequirePermissions('products:delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft delete a product' })
  async remove(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.productsService.remove(tenantId, id);
  }
}
