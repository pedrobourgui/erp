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
import { CustomersService } from './customers.service';
import {
  CreateCustomerDto,
  UpdateCustomerDto,
  CustomerQueryDto,
  CreateCustomerAddressDto,
  UpdateCustomerAddressDto,
} from './dto/customer.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentTenant } from '../../common/decorators/tenant.decorator';

@ApiTags('Customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @RequirePermissions('customers:read')
  @ApiOperation({ summary: 'List customers with pagination, search, and filters' })
  async findAll(
    @CurrentTenant() tenantId: string,
    @Query() query: CustomerQueryDto,
  ) {
    return this.customersService.findAll(tenantId, query);
  }

  @Get(':id')
  @RequirePermissions('customers:read')
  @ApiOperation({ summary: 'Get customer by ID with addresses and interactions' })
  async findOne(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    const customer = await this.customersService.findById(tenantId, id);
    return { success: true, data: customer };
  }

  @Post()
  @RequirePermissions('customers:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new customer' })
  async create(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateCustomerDto,
  ) {
    const customer = await this.customersService.create(tenantId, dto);
    return { success: true, data: customer };
  }

  @Patch(':id')
  @RequirePermissions('customers:update')
  @ApiOperation({ summary: 'Update a customer' })
  async update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    const customer = await this.customersService.update(tenantId, id, dto);
    return { success: true, data: customer };
  }

  @Delete(':id')
  @RequirePermissions('customers:delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft delete a customer' })
  async remove(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.customersService.remove(tenantId, id);
  }

  // ─── Addresses (AE-16) ──────────────────────────────────────────────────

  @Get(':id/addresses')
  @RequirePermissions('customers:read')
  @ApiOperation({ summary: 'List the addresses of a customer' })
  async findAddresses(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    const addresses = await this.customersService.findAddresses(tenantId, id);
    return { success: true, data: addresses };
  }

  @Post(':id/addresses')
  @RequirePermissions('customers:update')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add an address to a customer' })
  async createAddress(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: CreateCustomerAddressDto,
  ) {
    const address = await this.customersService.createAddress(tenantId, id, dto);
    return { success: true, data: address };
  }

  @Patch(':id/addresses/:addressId')
  @RequirePermissions('customers:update')
  @ApiOperation({ summary: 'Update an address of a customer' })
  async updateAddress(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Param('addressId') addressId: string,
    @Body() dto: UpdateCustomerAddressDto,
  ) {
    const address = await this.customersService.updateAddress(
      tenantId,
      id,
      addressId,
      dto,
    );
    return { success: true, data: address };
  }

  @Delete(':id/addresses/:addressId')
  @RequirePermissions('customers:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove an address of a customer' })
  async removeAddress(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Param('addressId') addressId: string,
  ) {
    return this.customersService.removeAddress(tenantId, id, addressId);
  }
}
