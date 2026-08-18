import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsStrongPassword } from '../../../common/validators/is-strong-password.validator';

/** Self-service update of the authenticated user's own profile — SCRUM-23. */
export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'João Silva' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ example: 'joao@empresa.com' })
  @IsOptional()
  @IsEmail({}, { message: 'Informe um email válido' })
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ example: '11999998888' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;
}

/** Self-service password change (validates current password) — SCRUM-23. */
export class ChangePasswordDto {
  @ApiProperty({ example: 'SenhaAtual123' })
  @IsString()
  @IsNotEmpty({ message: 'Senha atual é obrigatória' })
  currentPassword: string;

  @ApiProperty({ example: 'NovaSenha123' })
  @IsString()
  @IsNotEmpty({ message: 'Nova senha é obrigatória' })
  // FN-25: política única, compartilhada com o front (@erp/validators).
  @IsStrongPassword([])
  @MaxLength(72, { message: 'A senha deve ter no máximo 72 caracteres' })
  newPassword: string;
}
