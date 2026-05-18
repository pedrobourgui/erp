import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../database/prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  tenantId: string;
  roleId: string | null;
  email: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret', 'change-me-in-production'),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        status: true,
        tenantId: true,
        roleId: true,
        email: true,
        tenant: { select: { status: true } },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Conta de usuário inativa ou bloqueada');
    }

    if (user.tenant.status !== 'ACTIVE') {
      throw new UnauthorizedException('Tenant suspenso ou cancelado');
    }

    return {
      sub: user.id,
      tenantId: user.tenantId,
      roleId: user.roleId,
      email: user.email,
    };
  }
}
