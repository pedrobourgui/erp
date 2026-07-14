import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Troca de item de um pedido por outro produto/variante — SCRUM-21.
 */
export class ExchangeOrderItemDto {
  @ApiProperty({ description: 'OrderItem a ser substituído' })
  @IsString()
  @IsNotEmpty()
  orderItemId: string;

  @ApiProperty({ description: 'Produto que entra no lugar' })
  @IsString()
  @IsNotEmpty()
  newProductId: string;

  @ApiPropertyOptional({ description: 'Variante do novo produto (se houver)' })
  @IsOptional()
  @IsString()
  newVariantId?: string;

  @ApiPropertyOptional({
    description: 'Quantidade da troca (default: quantidade do item original)',
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;
}
