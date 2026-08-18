import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsIn,
  IsNumber,
  Min,
  MaxLength,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFinancialAccountDto {
  @ApiProperty({ example: 'Caixa Principal' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({ enum: ['CHECKING', 'SAVINGS', 'CASH', 'DIGITAL'] })
  @IsIn(['CHECKING', 'SAVINGS', 'CASH', 'DIGITAL'])
  type: string;

  @ApiPropertyOptional({ example: '001' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  code?: string;

  @ApiPropertyOptional({ example: 'Banco do Brasil' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  bankName?: string;

  @ApiPropertyOptional({ example: '1234' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  bankBranch?: string;

  @ApiPropertyOptional({ example: '12345-6' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  bankAccount?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  acceptsDirectSales?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateFinancialAccountDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ enum: ['CHECKING', 'SAVINGS', 'CASH', 'DIGITAL'] })
  @IsOptional()
  @IsIn(['CHECKING', 'SAVINGS', 'CASH', 'DIGITAL'])
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  bankName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  bankBranch?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  bankAccount?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  acceptsDirectSales?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class FinancialAccountQueryDto {
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
  search?: string;

  @ApiPropertyOptional({ enum: ['CHECKING', 'SAVINGS', 'CASH', 'DIGITAL'] })
  @IsOptional()
  @IsIn(['CHECKING', 'SAVINGS', 'CASH', 'DIGITAL'])
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;
}
