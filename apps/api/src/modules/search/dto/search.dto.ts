import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SearchQueryDto {
  @ApiPropertyOptional({ description: 'Termo de busca (mínimo 2 caracteres)' })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Termo de busca muito longo' })
  q?: string;
}
