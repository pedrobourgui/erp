import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReverseSaleDto {
  @ApiProperty({
    description:
      'Motivo do estorno/devolução. Fica registrado no histórico do pedido.',
    example: 'Cliente desistiu da compra',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}
