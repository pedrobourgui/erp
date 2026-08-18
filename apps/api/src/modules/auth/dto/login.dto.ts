import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsStrongPassword } from '../../../common/validators/is-strong-password.validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@empresa.com', description: 'Email do usuário' })
  @IsEmail({}, { message: 'Informe um email válido' })
  @IsNotEmpty({ message: 'Email é obrigatório' })
  email: string;

  @ApiProperty({ example: 'S3cur3P@ss', description: 'Senha do usuário' })
  @IsString({ message: 'Senha deve ser uma string' })
  @IsNotEmpty({ message: 'Senha é obrigatória' })
  // Login **não** endurece: quem cadastrou senha sob a política antiga
  // continua entrando. A política nova vale onde a senha é definida.
  @MinLength(6, { message: 'Senha deve ter no mínimo 6 caracteres' })
  password: string;
}

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token para renovação' })
  @IsString({ message: 'Refresh token deve ser uma string' })
  @IsNotEmpty({ message: 'Refresh token é obrigatório' })
  refreshToken: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'admin@empresa.com', description: 'Email do usuário' })
  @IsEmail({}, { message: 'Informe um email válido' })
  @IsNotEmpty({ message: 'Email é obrigatório' })
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token de reset de senha' })
  @IsString({ message: 'Token deve ser uma string' })
  @IsNotEmpty({ message: 'Token é obrigatório' })
  token: string;

  @ApiProperty({ example: 'NovaSenha@123', description: 'Nova senha' })
  @IsString({ message: 'Senha deve ser uma string' })
  @IsNotEmpty({ message: 'Senha é obrigatória' })
  // FN-25: 6 caracteres sem complexidade protegendo o faturamento da
  // empresa inteira. A política vem de @erp/validators, a mesma do front.
  @IsStrongPassword()
  password: string;
}

export class AcceptInviteDto {
  @ApiProperty({ description: 'Token do convite' })
  @IsString({ message: 'Token deve ser uma string' })
  @IsNotEmpty({ message: 'Token é obrigatório' })
  token: string;

  @ApiProperty({ example: 'João Silva', description: 'Nome do usuário' })
  @IsString({ message: 'Nome deve ser uma string' })
  @IsNotEmpty({ message: 'Nome é obrigatório' })
  name: string;

  @ApiProperty({ example: 'MinhaSenha@123', description: 'Senha do usuário' })
  @IsString({ message: 'Senha deve ser uma string' })
  @IsNotEmpty({ message: 'Senha é obrigatória' })
  // FN-25: 6 caracteres sem complexidade protegendo o faturamento da
  // empresa inteira. A política vem de @erp/validators, a mesma do front.
  @IsStrongPassword(['email', 'name'])
  password: string;
}
