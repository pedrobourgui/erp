import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsPositive,
  IsDateString,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Transferência entre contas financeiras — SCRUM-14.
 * Debita a conta de origem e credita a conta de destino de forma atômica,
 * gerando dois FinancialTransaction vinculados.
 */
export class TransferBetweenAccountsDto {
  @ApiProperty({ example: 'acc-origem', description: 'FinancialAccount de origem (débito)' })
  @IsString()
  @IsNotEmpty()
  fromAccountId: string;

  @ApiProperty({ example: 'acc-destino', description: 'FinancialAccount de destino (crédito)' })
  @IsString()
  @IsNotEmpty()
  toAccountId: string;

  @ApiProperty({ example: 500.0, description: 'Valor da transferência (> 0)' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive({ message: 'amount must be greater than zero' })
  amount: number;

  @ApiPropertyOptional({ example: '2026-07-14', description: 'Data da transferência (default: agora)' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ example: 'Transferência para conta corrente', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional({
    description:
      'Confirma explicitamente uma transferência que deixa a conta de origem negativa (FN-17). Conta do tipo Caixa nunca aceita.',
  })
  @IsOptional()
  @IsBoolean()
  allowNegativeBalance?: boolean;
}
