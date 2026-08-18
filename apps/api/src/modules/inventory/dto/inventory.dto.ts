import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsIn,
  // IsUUID removed: DB uses cuid(), not uuid
  IsDateString,
  IsBoolean,
  Min,
  MaxLength,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateMovementDto {
  @ApiProperty()
  @IsString()
  productId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  variantId?: string;

  @ApiProperty({ enum: ['ENTRY', 'EXIT', 'TRANSFER', 'ADJUSTMENT', 'RETURN', 'PRODUCTION'] })
  @IsIn(['ENTRY', 'EXIT', 'TRANSFER', 'ADJUSTMENT', 'RETURN', 'PRODUCTION'])
  type: string;

  @ApiProperty({ enum: ['PURCHASE', 'SALE', 'TRANSFER', 'ADJUSTMENT', 'RETURN_CUSTOMER', 'RETURN_SUPPLIER', 'DAMAGE', 'THEFT', 'PRODUCTION', 'INITIAL', 'COUNT'] })
  @IsIn(['PURCHASE', 'SALE', 'TRANSFER', 'ADJUSTMENT', 'RETURN_CUSTOMER', 'RETURN_SUPPLIER', 'DAMAGE', 'THEFT', 'PRODUCTION', 'INITIAL', 'COUNT'])
  reason: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @ApiPropertyOptional({ description: 'Required for ENTRY movements' })
  @IsOptional()
  @IsString()
  toWarehouseId?: string;

  @ApiPropertyOptional({ description: 'Required for EXIT movements' })
  @IsOptional()
  @IsString()
  fromWarehouseId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referenceType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referenceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateMinStockDto {
  @ApiProperty({ description: 'Minimum stock threshold for this inventory item' })
  @IsInt()
  @Min(0)
  minStock: number;
}

export class TransferStockDto {
  @ApiProperty()
  @IsString()
  productId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  variantId?: string;

  @ApiProperty()
  @IsString()
  fromWarehouseId: string;

  @ApiProperty()
  @IsString()
  toWarehouseId: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class AdjustStockDto {
  @ApiProperty()
  @IsString()
  productId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  variantId?: string;

  @ApiProperty()
  @IsString()
  warehouseId: string;

  @ApiProperty({ description: 'Balance counted on the shelf; the delta is derived from it' })
  @IsInt()
  @Min(0)
  countedQuantity: number;

  @ApiProperty({ enum: ['COUNT', 'ADJUSTMENT', 'DAMAGE', 'THEFT', 'INITIAL'] })
  @IsIn(['COUNT', 'ADJUSTMENT', 'DAMAGE', 'THEFT', 'INITIAL'])
  reason: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class InventoryQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}

export class CreateWarehouseDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ description: 'Warehouse code; auto-generated from name if not provided' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2)
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10)
  zipCode?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isDefault?: boolean = false;
}

export class UpdateWarehouseDto extends PartialType(CreateWarehouseDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;
}

export class AlertQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'RESOLVED'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'RESOLVED'])
  status?: string;

  @ApiPropertyOptional({ description: 'Only alerts of this warehouse' })
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @ApiPropertyOptional({ description: 'Only alerts of this product' })
  @IsOptional()
  @IsString()
  productId?: string;
}

export class MovementQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @ApiPropertyOptional({ enum: ['ENTRY', 'EXIT', 'TRANSFER', 'ADJUSTMENT', 'RETURN', 'PRODUCTION'] })
  @IsOptional()
  @IsIn(['ENTRY', 'EXIT', 'TRANSFER', 'ADJUSTMENT', 'RETURN', 'PRODUCTION'])
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ enum: ['PURCHASE', 'SALE', 'TRANSFER', 'ADJUSTMENT', 'RETURN_CUSTOMER', 'RETURN_SUPPLIER', 'DAMAGE', 'THEFT', 'PRODUCTION', 'INITIAL', 'COUNT'] })
  @IsOptional()
  @IsIn(['PURCHASE', 'SALE', 'TRANSFER', 'ADJUSTMENT', 'RETURN_CUSTOMER', 'RETURN_SUPPLIER', 'DAMAGE', 'THEFT', 'PRODUCTION', 'INITIAL', 'COUNT'])
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
