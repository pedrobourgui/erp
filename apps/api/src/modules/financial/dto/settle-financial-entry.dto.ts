import {
  IsIn,
  IsOptional,
  IsString,
  IsNumber,
  IsPositive,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Settlement (baixa) of an open título — SCRUM-31/32.
 * RECEIVABLE credits the account, PAYABLE debits it.
 */
export const SETTLEABLE_KINDS = ['RECEIVABLE', 'PAYABLE'] as const;
export type SettleableKind = (typeof SETTLEABLE_KINDS)[number];

export class SettleFinancialEntryDto {
  @ApiProperty({ enum: SETTLEABLE_KINDS, example: 'RECEIVABLE' })
  @IsIn(SETTLEABLE_KINDS)
  kind: SettleableKind;

  @ApiPropertyOptional({
    example: 150.0,
    description: 'Valor da baixa. Ausente = liquida o saldo em aberto.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive({ message: 'amount must be greater than zero' })
  amount?: number;

  @ApiPropertyOptional({
    example: 'acc-123',
    description:
      'Conta a creditar/debitar. Ausente = conta do pagamento, da forma de pagamento ou do lançamento.',
  })
  @IsOptional()
  @IsString()
  accountId?: string;

  @ApiPropertyOptional({ example: '2026-07-13', description: 'Data da baixa (padrão: agora)' })
  @IsOptional()
  @IsDateString()
  paidAt?: string;
}
