import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsStrongPassword } from '../../../common/validators/is-strong-password.validator';

export class CreateUserDto {
  @ApiProperty({ example: 'João Silva', description: 'Nome completo do usuário' })
  @IsString({ message: 'Nome deve ser uma string' })
  @IsNotEmpty({ message: 'Nome é obrigatório' })
  name: string;

  @ApiProperty({ example: 'joao@empresa.com', description: 'Email do usuário' })
  @IsEmail({}, { message: 'Informe um email válido' })
  @IsNotEmpty({ message: 'Email é obrigatório' })
  email: string;

  @ApiProperty({ example: 'S3cur3P@ss', description: 'Senha do usuário' })
  @IsString({ message: 'Senha deve ser uma string' })
  @IsNotEmpty({ message: 'Senha é obrigatória' })
  // FN-25: política única, compartilhada com o front (@erp/validators).
  @IsStrongPassword(['email', 'name'])
  password: string;

  @ApiPropertyOptional({ example: '11999998888', description: 'Telefone do usuário' })
  @IsOptional()
  @IsString({ message: 'Telefone deve ser uma string' })
  phone?: string;

  @ApiPropertyOptional({ description: 'ID do role a ser atribuído' })
  @IsOptional()
  @IsString({ message: 'Role ID deve ser uma string' })
  roleId?: string;
}

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'João Silva', description: 'Nome completo do usuário' })
  @IsOptional()
  @IsString({ message: 'Nome deve ser uma string' })
  name?: string;

  @ApiPropertyOptional({ example: 'joao@empresa.com', description: 'Email do usuário' })
  @IsOptional()
  @IsEmail({}, { message: 'Informe um email válido' })
  email?: string;

  @ApiPropertyOptional({ example: 'NovaSenha123', description: 'Nova senha' })
  @IsOptional()
  @IsString({ message: 'Senha deve ser uma string' })
  // FN-25: política única, compartilhada com o front (@erp/validators).
  @IsStrongPassword(['email', 'name'])
  password?: string;

  @ApiPropertyOptional({ example: '11999998888', description: 'Telefone do usuário' })
  @IsOptional()
  @IsString({ message: 'Telefone deve ser uma string' })
  phone?: string;

  @ApiPropertyOptional({ description: 'ID do role a ser atribuído' })
  @IsOptional()
  @IsString({ message: 'Role ID deve ser uma string' })
  roleId?: string;

  @ApiPropertyOptional({ description: 'Status do usuário', enum: ['ACTIVE', 'INACTIVE', 'BLOCKED'] })
  @IsOptional()
  @IsString({ message: 'Status deve ser uma string' })
  status?: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
}

export class InviteUserDto {
  @ApiProperty({ example: 'joao@empresa.com', description: 'Email do convidado' })
  @IsEmail({}, { message: 'Informe um email válido' })
  @IsNotEmpty({ message: 'Email é obrigatório' })
  email: string;

  @ApiProperty({ description: 'ID do role a ser atribuído' })
  @IsString({ message: 'Role ID deve ser uma string' })
  @IsNotEmpty({ message: 'Role ID é obrigatório' })
  roleId: string;
}

export class PaginationDto {
  @ApiPropertyOptional({ default: 1, description: 'Número da página' })
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, description: 'Itens por página' })
  @IsOptional()
  limit?: number = 20;
}
