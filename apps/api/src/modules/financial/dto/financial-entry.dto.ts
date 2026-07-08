import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsPositive,
  IsBoolean,
  IsDateString,
  Min,
  MaxLength,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Manual financial entry (despesa/receita) — SCRUM-10.
 * REVENUE = receita (crédito), EXPENSE = despesa (débito).
 */
export const FINANCIAL_ENTRY_TYPES = ['REVENUE', 'EXPENSE'] as const;
export type FinancialEntryType = (typeof FINANCIAL_ENTRY_TYPES)[number];

export const FINANCIAL_ENTRY_STATUS = ['PAID', 'OPEN'] as const;
export type FinancialEntryStatusFilter = (typeof FINANCIAL_ENTRY_STATUS)[number];

export class CreateFinancialEntryDto {
  @ApiProperty({ enum: FINANCIAL_ENTRY_TYPES, example: 'REVENUE' })
  @IsEnum(FINANCIAL_ENTRY_TYPES)
  type: FinancialEntryType;

  @ApiProperty({ example: 'acc-123', description: 'FinancialAccount id' })
  @IsString()
  @IsNotEmpty()
  accountId: string;

  @ApiPropertyOptional({ example: 'chart-123', description: 'ChartOfAccounts id (categoria)' })
  @IsOptional()
  @IsString()
  chartAccountId?: string;

  @ApiProperty({ example: 1500.5 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive({ message: 'amount must be greater than zero' })
  amount: number;

  @ApiProperty({ example: '2026-07-08', description: 'Data de competência/lançamento' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional({ default: true, description: 'À vista (true) ou a prazo (false)' })
  @IsOptional()
  @IsBoolean()
  paid?: boolean = true;

  @ApiPropertyOptional({ example: '2026-08-08', description: 'Vencimento — obrigatório quando a prazo' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ example: 'Aluguel da loja', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}

export class FinancialEntryQueryDto {
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

  @ApiPropertyOptional({ description: 'Início do período (inclusive)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Fim do período (inclusive)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ enum: FINANCIAL_ENTRY_TYPES })
  @IsOptional()
  @IsEnum(FINANCIAL_ENTRY_TYPES)
  type?: FinancialEntryType;

  @ApiPropertyOptional({ description: 'FinancialAccount id' })
  @IsOptional()
  @IsString()
  accountId?: string;

  @ApiPropertyOptional({ enum: FINANCIAL_ENTRY_STATUS, description: 'PAID = pago, OPEN = em aberto' })
  @IsOptional()
  @IsEnum(FINANCIAL_ENTRY_STATUS)
  status?: FinancialEntryStatusFilter;
}
