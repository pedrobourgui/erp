import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  IsDateString,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * FN-04: a reversal is a financial act, not an undo button. It always carries
 * who did it and why — the reason ends up in the audit trail and in the
 * metadata of the transaction that reverses the settlement.
 */
export class ReverseSettlementDto {
  @ApiProperty({ example: 'Baixa lançada na conta errada' })
  @IsString()
  @IsNotEmpty({ message: 'Informe o motivo do estorno' })
  @MaxLength(500)
  reason: string;
}

export class UpdateFinancialEntryDto {
  @ApiPropertyOptional({ example: 'Aluguel de agosto' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional({ example: 1500.5 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount?: number;

  @ApiPropertyOptional({ example: '2026-09-01', description: 'Data civil (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'ChartOfAccounts id' })
  @IsOptional()
  @IsString()
  chartAccountId?: string;
}

export class DeleteFinancialEntryDto {
  @ApiProperty({ example: 'Lançado em duplicidade' })
  @IsString()
  @IsNotEmpty({ message: 'Informe o motivo da exclusão' })
  @MaxLength(500)
  reason: string;
}
