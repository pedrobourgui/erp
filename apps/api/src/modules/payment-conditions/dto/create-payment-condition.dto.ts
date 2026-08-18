import {
  IsString,
  IsNotEmpty,
  IsIn,
  IsNumber,
  IsOptional,
  IsBoolean,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePaymentConditionDto {
  @ApiProperty({ example: 'A Vista' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'AV' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code: string;

  @ApiProperty({ enum: ['CASH', 'INSTALLMENT', 'ENTRY_PLUS_INSTALLMENT'] })
  @IsIn(['CASH', 'INSTALLMENT', 'ENTRY_PLUS_INSTALLMENT'])
  type: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  installments?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  daysBetweenInstallments?: number;

  @ApiPropertyOptional({ default: 0, description: 'Entry percentage (0-100)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  entryPercentage?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
