import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
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

/**
 * A transfer is never *created* as an entry — it only ever exists as a pair of
 * transactions (SCRUM-11) — but it does show up in the unified list, so both
 * the filter and the listed entry accept it.
 */
export const FINANCIAL_ENTRY_LIST_TYPES = ['REVENUE', 'EXPENSE', 'TRANSFER'] as const;
export type FinancialEntryListType = (typeof FINANCIAL_ENTRY_LIST_TYPES)[number];

export const FINANCIAL_ENTRY_STATUS = ['PAID', 'OPEN'] as const;
export type FinancialEntryStatus = (typeof FINANCIAL_ENTRY_STATUS)[number];

/** FN-03: "vencido" is a slice of the open títulos, not a status of its own. */
export const FINANCIAL_ENTRY_STATUS_FILTERS = ['PAID', 'OPEN', 'OVERDUE'] as const;
export type FinancialEntryStatusFilter = (typeof FINANCIAL_ENTRY_STATUS_FILTERS)[number];

export class CreateFinancialEntryDto {
  @ApiProperty({ enum: FINANCIAL_ENTRY_TYPES, example: 'REVENUE' })
  @IsIn(FINANCIAL_ENTRY_TYPES)
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

  @ApiPropertyOptional({ enum: FINANCIAL_ENTRY_LIST_TYPES })
  @IsOptional()
  @IsIn(FINANCIAL_ENTRY_LIST_TYPES)
  type?: FinancialEntryListType;

  @ApiPropertyOptional({ description: 'FinancialAccount id' })
  @IsOptional()
  @IsString()
  accountId?: string;

  @ApiPropertyOptional({
    enum: FINANCIAL_ENTRY_STATUS_FILTERS,
    description: 'PAID = pago, OPEN = em aberto, OVERDUE = vencido',
  })
  @IsOptional()
  @IsIn(FINANCIAL_ENTRY_STATUS_FILTERS)
  status?: FinancialEntryStatusFilter;
}
