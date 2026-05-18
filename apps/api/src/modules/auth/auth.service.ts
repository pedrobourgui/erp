import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RedisService } from '../../database/redis/redis.service';
import { JwtPayload } from './strategies/jwt.strategy';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface TenantOption {
  tenantId: string;
  tenantName: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  phone: string | null;
  tenantId: string;
  roleId: string | null;
  role: {
    id: string;
    name: string;
    permissions: Array<{
      permission: { resource: string; action: string };
    }>;
  } | null;
  tenant: { id: string; name: string; plan: string };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  private readonly MAX_FAILED_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION_SECONDS = 15 * 60;
  private readonly REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
  private readonly BLACKLIST_TTL_SECONDS = 7 * 24 * 60 * 60;
  private readonly RESET_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour
  private readonly INVITE_TOKEN_TTL_SECONDS = 48 * 60 * 60; // 48 hours
  private readonly BCRYPT_SALT_ROUNDS = 12;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redis: RedisService,
  ) {}

  async validateUser(email: string, password: string) {
    await this.checkRateLimit(email);

    const users = await this.prisma.user.findMany({
      where: { email, deletedAt: null },
      include: {
        role: { select: { id: true, name: true } },
        tenant: { select: { id: true, name: true, plan: true, status: true } },
      },
    });

    if (users.length === 0) {
      await this.recordFailedAttempt(email);
      throw new UnauthorizedException('Email ou senha inválidos');
    }

    if (users.length > 1) {
      const tenants: TenantOption[] = users.map((u) => ({
        tenantId: u.tenant.id,
        tenantName: u.tenant.name,
      }));

      throw new HttpException(
        {
          statusCode: HttpStatus.CONFLICT,
          error: 'TENANT_SELECTION_REQUIRED',
          message: 'Email pertence a múltiplos tenants. Selecione o tenant desejado.',
          tenants,
        },
        HttpStatus.CONFLICT,
      );
    }

    const user = users[0];

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Conta de usuário inativa ou bloqueada');
    }

    if (user.tenant.status !== 'ACTIVE') {
      throw new ForbiddenException('Conta da empresa suspensa ou cancelada');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      await this.recordFailedAttempt(email);
      throw new UnauthorizedException('Email ou senha inválidos');
    }

    await this.clearFailedAttempts(email);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return user;
  }

  async validateUserWithTenant(email: string, password: string, tenantId: string) {
    await this.checkRateLimit(email);

    const user = await this.prisma.user.findFirst({
      where: { email, tenantId, deletedAt: null },
      include: {
        role: { select: { id: true, name: true } },
        tenant: { select: { id: true, name: true, plan: true, status: true } },
      },
    });

    if (!user) {
      await this.recordFailedAttempt(email);
      throw new UnauthorizedException('Email ou senha inválidos');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Conta de usuário inativa ou bloqueada');
    }

    if (user.tenant.status !== 'ACTIVE') {
      throw new ForbiddenException('Conta da empresa suspensa ou cancelada');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      await this.recordFailedAttempt(email);
      throw new UnauthorizedException('Email ou senha inválidos');
    }

    await this.clearFailedAttempts(email);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return user;
  }

  async login(user: {
    id: string;
    tenantId: string;
    roleId: string | null;
    email: string;
  }): Promise<TokenPair> {
    const payload: JwtPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      roleId: user.roleId,
      email: user.email,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.secret'),
      expiresIn: this.configService.get<string>('jwt.accessExpiresIn', '15m'),
    });

    const refreshToken = this.jwtService.sign(
      { sub: user.id, type: 'refresh' },
      {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        expiresIn: this.configService.get<string>('jwt.refreshExpiresIn', '7d'),
      },
    );

    const refreshKey = `refresh_token:${user.id}:${refreshToken}`;
    await this.redis.set(refreshKey, 'valid', this.REFRESH_TOKEN_TTL_SECONDS);

    return {
      accessToken,
      refreshToken,
      expiresIn: 900,
    };
  }

  async refreshToken(token: string): Promise<TokenPair> {
    let decoded: { sub: string; type: string };
    try {
      decoded = this.jwtService.verify(token, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }

    if (decoded.type !== 'refresh') {
      throw new UnauthorizedException('Tipo de token inválido');
    }

    const isBlacklisted = await this.redis.exists(`blacklist:${token}`);
    if (isBlacklisted) {
      throw new UnauthorizedException('Refresh token foi revogado');
    }

    const refreshKey = `refresh_token:${decoded.sub}:${token}`;
    const isValid = await this.redis.exists(refreshKey);
    if (!isValid) {
      throw new UnauthorizedException('Refresh token não é mais válido');
    }

    await this.redis.del(refreshKey);
    await this.redis.set(`blacklist:${token}`, '1', this.BLACKLIST_TTL_SECONDS);

    const user = await this.prisma.user.findUnique({
      where: { id: decoded.sub },
      select: { id: true, tenantId: true, roleId: true, email: true, status: true },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Usuário não encontrado ou inativo');
    }

    return this.login(user);
  }

  async logout(token: string): Promise<void> {
    try {
      const decoded = this.jwtService.verify(token, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });

      const refreshKey = `refresh_token:${decoded.sub}:${token}`;
      await this.redis.del(refreshKey);
    } catch {
      // Token pode estar expirado, mas ainda deve ser blacklisted
    }

    await this.redis.set(`blacklist:${token}`, '1', this.BLACKLIST_TTL_SECONDS);
  }

  async getProfile(userId: string): Promise<UserProfile> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        phone: true,
        tenantId: true,
        roleId: true,
        role: {
          select: {
            id: true,
            name: true,
            permissions: {
              select: {
                permission: {
                  select: { resource: true, action: true },
                },
              },
            },
          },
        },
        tenant: { select: { id: true, name: true, plan: true } },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado');
    }

    return user;
  }

  // ─── Password Reset ────────────────────────────────────────────────────

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null, status: 'ACTIVE' },
      select: { id: true, tenantId: true },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      this.logger.warn(`Password reset requested for unknown email: ${email}`);
      return;
    }

    const token = randomBytes(32).toString('hex');
    const redisKey = `password_reset:${token}`;

    await this.redis.set(
      redisKey,
      JSON.stringify({ userId: user.id, tenantId: user.tenantId }),
      this.RESET_TOKEN_TTL_SECONDS,
    );

    // TODO: Send email with reset link via notification/email service
    this.logger.log(`Password reset token generated for user ${user.id} (tenant: ${user.tenantId})`);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const redisKey = `password_reset:${token}`;
    const raw = await this.redis.get(redisKey);

    if (!raw) {
      throw new BadRequestException('Token de redefinição inválido ou expirado');
    }

    const { userId } = JSON.parse(raw) as { userId: string; tenantId: string };

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new BadRequestException('Usuário não encontrado ou inativo');
    }

    const hashedPassword = await bcrypt.hash(newPassword, this.BCRYPT_SALT_ROUNDS);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    // Invalidate the token (single use)
    await this.redis.del(redisKey);

    this.logger.log(`Password reset completed for user ${userId}`);
  }

  // ─── Invite Acceptance ────────────────────────────────────────────────

  async acceptInvite(
    token: string,
    name: string,
    password: string,
  ): Promise<TokenPair> {
    const redisKey = `invite:${token}`;
    const raw = await this.redis.get(redisKey);

    if (!raw) {
      throw new BadRequestException('Convite inválido ou expirado');
    }

    const { email, tenantId, roleId } = JSON.parse(raw) as {
      email: string;
      tenantId: string;
      roleId: string;
    };

    // Check if user already exists in this tenant
    const existing = await this.prisma.user.findFirst({
      where: { tenantId, email, deletedAt: null },
    });

    if (existing) {
      throw new BadRequestException('Já existe um usuário com este email neste tenant');
    }

    const hashedPassword = await bcrypt.hash(password, this.BCRYPT_SALT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        tenantId,
        email,
        name,
        password: hashedPassword,
        roleId,
        status: 'ACTIVE',
      },
      select: { id: true, tenantId: true, roleId: true, email: true },
    });

    // Invalidate the invite token (single use)
    await this.redis.del(redisKey);

    this.logger.log(`Invite accepted: user ${user.id} created for tenant ${tenantId}`);

    return this.login(user);
  }

  // ─── Rate Limiting Helpers ──────────────────────────────────────────────

  private rateLimitKey(email: string): string {
    return `auth:failed_attempts:${email}`;
  }

  private async checkRateLimit(email: string): Promise<void> {
    const key = this.rateLimitKey(email);
    const attemptsRaw = await this.redis.get(key);
    const attempts = attemptsRaw ? parseInt(attemptsRaw, 10) : 0;

    if (attempts >= this.MAX_FAILED_ATTEMPTS) {
      const ttl = await this.redis.client.ttl(key);
      const minutesRemaining = Math.ceil(ttl / 60);
      throw new ForbiddenException(
        `Muitas tentativas de login. Tente novamente em ${minutesRemaining} minuto(s).`,
      );
    }
  }

  private async recordFailedAttempt(email: string): Promise<void> {
    const key = this.rateLimitKey(email);
    const current = await this.redis.client.incr(key);
    if (current === 1) {
      await this.redis.client.expire(key, this.LOCKOUT_DURATION_SECONDS);
    }
    this.logger.warn(
      `Tentativa de login falha para ${email} (${current} de ${this.MAX_FAILED_ATTEMPTS})`,
    );
  }

  private async clearFailedAttempts(email: string): Promise<void> {
    await this.redis.del(this.rateLimitKey(email));
  }
}
