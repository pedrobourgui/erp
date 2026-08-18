import { Test, TestingModule } from '@nestjs/testing';
import {
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RedisService } from '../../database/redis/redis.service';
import {
  createMockPrismaService,
  createMockRedisService,
  createMockUser,
} from '../../../test/helpers/test.utils';

jest.mock('bcryptjs');

describe('AuthService', () => {
  let service: AuthService;
  let prisma: ReturnType<typeof createMockPrismaService>;
  let redis: ReturnType<typeof createMockRedisService>;
  let jwtService: { sign: jest.Mock; verify: jest.Mock };
  let configService: { get: jest.Mock };

  beforeEach(async () => {
    prisma = createMockPrismaService();
    redis = createMockRedisService();
    jwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    };
    configService = {
      get: jest.fn((key: string, defaultValue?: string) => {
        const map: Record<string, string> = {
          'jwt.secret': 'test-secret',
          'jwt.refreshSecret': 'test-refresh-secret',
          'jwt.accessExpiresIn': '15m',
          'jwt.refreshExpiresIn': '7d',
        };
        return map[key] ?? defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // validateUser
  // ═══════════════════════════════════════════════════════════════════════════
  describe('validateUser', () => {
    const email = 'admin@empresa.com';
    const password = 'S3cur3P@ss';

    it('should return user when email and password are valid', async () => {
      const mockUser = createMockUser();
      prisma.user.findMany.mockResolvedValue([mockUser]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.user.update.mockResolvedValue(mockUser);

      const result = await service.validateUser(email, password);

      expect(result).toEqual(mockUser);
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { email, deletedAt: null },
        include: {
          role: { select: { id: true, name: true } },
          tenant: { select: { id: true, name: true, plan: true, status: true } },
        },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(password, mockUser.password);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { lastLoginAt: expect.any(Date) },
      });
    });

    it('should throw UnauthorizedException when email not found', async () => {
      prisma.user.findMany.mockResolvedValue([]);

      await expect(service.validateUser(email, password)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.validateUser(email, password)).rejects.toThrow(
        'Email ou senha inválidos',
      );
      expect(redis.client.incr).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when password is incorrect', async () => {
      const mockUser = createMockUser();
      prisma.user.findMany.mockResolvedValue([mockUser]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.validateUser(email, password)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(redis.client.incr).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when user status is INACTIVE', async () => {
      const mockUser = createMockUser({ status: 'INACTIVE' });
      prisma.user.findMany.mockResolvedValue([mockUser]);

      await expect(service.validateUser(email, password)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.validateUser(email, password)).rejects.toThrow(
        'Conta de usuário inativa ou bloqueada',
      );
    });

    it('should throw UnauthorizedException when user status is BLOCKED', async () => {
      const mockUser = createMockUser({ status: 'BLOCKED' });
      prisma.user.findMany.mockResolvedValue([mockUser]);

      await expect(service.validateUser(email, password)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.validateUser(email, password)).rejects.toThrow(
        'Conta de usuário inativa ou bloqueada',
      );
    });

    it('should throw ForbiddenException when tenant status is SUSPENDED', async () => {
      const mockUser = createMockUser({
        tenant: {
          id: 'tenant-uuid-001',
          name: 'Empresa Teste LTDA',
          plan: 'PRO',
          status: 'SUSPENDED',
        },
      });
      prisma.user.findMany.mockResolvedValue([mockUser]);

      await expect(service.validateUser(email, password)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.validateUser(email, password)).rejects.toThrow(
        'Conta da empresa suspensa ou cancelada',
      );
    });

    it('should clear failed attempts after successful login', async () => {
      const mockUser = createMockUser();
      prisma.user.findMany.mockResolvedValue([mockUser]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.user.update.mockResolvedValue(mockUser);

      await service.validateUser(email, password);

      expect(redis.del).toHaveBeenCalledWith(`auth:failed_attempts:${email}`);
    });

    it('should update lastLoginAt on successful validation', async () => {
      const mockUser = createMockUser();
      prisma.user.findMany.mockResolvedValue([mockUser]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.user.update.mockResolvedValue(mockUser);

      await service.validateUser(email, password);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { lastLoginAt: expect.any(Date) },
      });
    });

    it('should throw HttpException with TENANT_SELECTION_REQUIRED when email exists in multiple tenants', async () => {
      const user1 = createMockUser({
        id: 'user-uuid-001',
        tenantId: 'tenant-uuid-001',
        tenant: { id: 'tenant-uuid-001', name: 'Empresa A', plan: 'PRO', status: 'ACTIVE' },
      });
      const user2 = createMockUser({
        id: 'user-uuid-002',
        tenantId: 'tenant-uuid-002',
        tenant: { id: 'tenant-uuid-002', name: 'Empresa B', plan: 'BASIC', status: 'ACTIVE' },
      });
      prisma.user.findMany.mockResolvedValue([user1, user2]);

      try {
        await service.validateUser(email, password);
        fail('Expected HttpException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(HttpStatus.CONFLICT);
        const response = (error as HttpException).getResponse() as Record<string, unknown>;
        expect(response.error).toBe('TENANT_SELECTION_REQUIRED');
        expect(response.tenants).toEqual([
          { tenantId: 'tenant-uuid-001', tenantName: 'Empresa A' },
          { tenantId: 'tenant-uuid-002', tenantName: 'Empresa B' },
        ]);
      }
    });

    it('should not validate password when multiple tenants are found', async () => {
      const user1 = createMockUser({ id: 'user-uuid-001', tenantId: 'tenant-uuid-001' });
      const user2 = createMockUser({ id: 'user-uuid-002', tenantId: 'tenant-uuid-002' });
      prisma.user.findMany.mockResolvedValue([user1, user2]);

      await expect(service.validateUser(email, password)).rejects.toThrow(HttpException);
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // login
  // ═══════════════════════════════════════════════════════════════════════════
  describe('login', () => {
    const userPayload = {
      id: 'user-uuid-001',
      tenantId: 'tenant-uuid-001',
      roleId: 'role-uuid-001',
      email: 'admin@empresa.com',
    };

    it('should return access token, refresh token, and expiresIn', async () => {
      jwtService.sign
        .mockReturnValueOnce('mock-access-token')
        .mockReturnValueOnce('mock-refresh-token');

      const result = await service.login(userPayload);

      expect(result).toEqual({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresIn: 900,
      });
    });

    // AE-19: the refresh token lives in localStorage, so any XSS hands over the
    // whole session. A 24-hour window is the cheap half of the mitigation; the
    // httpOnly cookie migration is tracked in the ADR.
    it('should store refresh token in Redis with a 24-hour TTL', async () => {
      jwtService.sign
        .mockReturnValueOnce('mock-access-token')
        .mockReturnValueOnce('mock-refresh-token');

      await service.login(userPayload);

      const expectedKey = `refresh_token:${userPayload.id}:mock-refresh-token`;
      const oneDayInSeconds = 24 * 60 * 60;
      expect(redis.set).toHaveBeenCalledWith(expectedKey, 'valid', oneDayInSeconds);
    });

    it('should include correct payload in access token JWT (sub, tenantId, roleId, email)', async () => {
      jwtService.sign
        .mockReturnValueOnce('mock-access-token')
        .mockReturnValueOnce('mock-refresh-token');

      await service.login(userPayload);

      expect(jwtService.sign).toHaveBeenNthCalledWith(
        1,
        {
          sub: userPayload.id,
          tenantId: userPayload.tenantId,
          roleId: userPayload.roleId,
          email: userPayload.email,
        },
        {
          secret: 'test-secret',
          expiresIn: '15m',
        },
      );
    });

    it('should sign refresh token with refresh secret and sub + type', async () => {
      jwtService.sign
        .mockReturnValueOnce('mock-access-token')
        .mockReturnValueOnce('mock-refresh-token');

      await service.login(userPayload);

      expect(jwtService.sign).toHaveBeenNthCalledWith(
        2,
        { sub: userPayload.id, type: 'refresh' },
        {
          secret: 'test-refresh-secret',
          expiresIn: '7d',
        },
      );
    });

    it('should handle user with null roleId', async () => {
      const userWithoutRole = { ...userPayload, roleId: null };
      jwtService.sign
        .mockReturnValueOnce('mock-access-token')
        .mockReturnValueOnce('mock-refresh-token');

      const result = await service.login(userWithoutRole);

      expect(result.accessToken).toBe('mock-access-token');
      expect(jwtService.sign).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ roleId: null }),
        expect.any(Object),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // refreshToken
  // ═══════════════════════════════════════════════════════════════════════════
  describe('refreshToken', () => {
    const oldRefreshToken = 'old-refresh-token';
    const decoded = { sub: 'user-uuid-001', type: 'refresh' };

    it('should return new token pair when refresh token is valid', async () => {
      jwtService.verify.mockReturnValue(decoded);
      redis.exists
        .mockResolvedValueOnce(false) // blacklist check
        .mockResolvedValueOnce(true);  // refresh key check
      redis.del.mockResolvedValue(undefined);
      redis.set.mockResolvedValue(undefined);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-uuid-001',
        tenantId: 'tenant-uuid-001',
        roleId: 'role-uuid-001',
        email: 'admin@empresa.com',
        status: 'ACTIVE',
      });
      jwtService.sign
        .mockReturnValueOnce('new-access-token')
        .mockReturnValueOnce('new-refresh-token');

      const result = await service.refreshToken(oldRefreshToken);

      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 900,
      });
    });

    it('should blacklist old refresh token after rotation', async () => {
      jwtService.verify.mockReturnValue(decoded);
      redis.exists
        .mockResolvedValueOnce(false) // not blacklisted
        .mockResolvedValueOnce(true);  // valid in store
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-uuid-001',
        tenantId: 'tenant-uuid-001',
        roleId: 'role-uuid-001',
        email: 'admin@empresa.com',
        status: 'ACTIVE',
      });
      jwtService.sign
        .mockReturnValueOnce('new-access-token')
        .mockReturnValueOnce('new-refresh-token');

      await service.refreshToken(oldRefreshToken);

      // Should delete old refresh key
      expect(redis.del).toHaveBeenCalledWith(
        `refresh_token:${decoded.sub}:${oldRefreshToken}`,
      );
      // Should blacklist the old token
      const oneDayInSeconds = 24 * 60 * 60;
      expect(redis.set).toHaveBeenCalledWith(
        `blacklist:${oldRefreshToken}`,
        '1',
        oneDayInSeconds,
      );
    });

    it('should throw UnauthorizedException when refresh token is blacklisted', async () => {
      jwtService.verify.mockReturnValue(decoded);
      redis.exists
        .mockResolvedValueOnce(true) // blacklisted (1st call)
        .mockResolvedValueOnce(true); // blacklisted (2nd call for message check)

      await expect(service.refreshToken(oldRefreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.refreshToken(oldRefreshToken)).rejects.toThrow(
        'Refresh token foi revogado',
      );
    });

    it('should throw UnauthorizedException when refresh token is invalid/expired', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(service.refreshToken(oldRefreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.refreshToken(oldRefreshToken)).rejects.toThrow(
        'Refresh token inválido ou expirado',
      );
    });

    it('should throw UnauthorizedException when token type is not refresh', async () => {
      jwtService.verify.mockReturnValue({ sub: 'user-uuid-001', type: 'access' });

      await expect(service.refreshToken(oldRefreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.refreshToken(oldRefreshToken)).rejects.toThrow(
        'Tipo de token inválido',
      );
    });

    it('should throw UnauthorizedException when refresh token is not found in Redis', async () => {
      jwtService.verify.mockReturnValue(decoded);
      redis.exists
        .mockResolvedValueOnce(false)  // not blacklisted
        .mockResolvedValueOnce(false); // not in Redis store

      await expect(service.refreshToken(oldRefreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.refreshToken(oldRefreshToken)).rejects.toThrow(
        'Refresh token não é mais válido',
      );
    });

    it('should throw UnauthorizedException when user is not found after token validation', async () => {
      jwtService.verify.mockReturnValue(decoded);
      redis.exists
        .mockResolvedValueOnce(false)  // not blacklisted (1st call)
        .mockResolvedValueOnce(true)   // valid in store (1st call)
        .mockResolvedValueOnce(false)  // not blacklisted (2nd call)
        .mockResolvedValueOnce(true);  // valid in store (2nd call)
      redis.del.mockResolvedValue(undefined);
      redis.set.mockResolvedValue(undefined);
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.refreshToken(oldRefreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.refreshToken(oldRefreshToken)).rejects.toThrow(
        'Usuário não encontrado ou inativo',
      );
    });

    it('should throw UnauthorizedException when user is inactive during refresh', async () => {
      jwtService.verify.mockReturnValue(decoded);
      redis.exists
        .mockResolvedValueOnce(false)  // not blacklisted (1st call)
        .mockResolvedValueOnce(true)   // valid in store (1st call)
        .mockResolvedValueOnce(false)  // not blacklisted (2nd call)
        .mockResolvedValueOnce(true);  // valid in store (2nd call)
      redis.del.mockResolvedValue(undefined);
      redis.set.mockResolvedValue(undefined);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-uuid-001',
        tenantId: 'tenant-uuid-001',
        roleId: 'role-uuid-001',
        email: 'admin@empresa.com',
        status: 'INACTIVE',
      });

      await expect(service.refreshToken(oldRefreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.refreshToken(oldRefreshToken)).rejects.toThrow(
        'Usuário não encontrado ou inativo',
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // logout
  // ═══════════════════════════════════════════════════════════════════════════
  describe('logout', () => {
    it('should blacklist the refresh token in Redis', async () => {
      const token = 'refresh-token-to-revoke';
      jwtService.verify.mockReturnValue({ sub: 'user-uuid-001' });

      await service.logout(token);

      expect(redis.set).toHaveBeenCalledWith(
        `blacklist:${token}`,
        '1',
        24 * 60 * 60,
      );
    });

    it('should set TTL of 24 hours on blacklisted token', async () => {
      const token = 'refresh-token-to-revoke';
      jwtService.verify.mockReturnValue({ sub: 'user-uuid-001' });

      await service.logout(token);

      const oneDayInSeconds = 24 * 60 * 60;
      expect(redis.set).toHaveBeenCalledWith(
        `blacklist:${token}`,
        '1',
        oneDayInSeconds,
      );
    });

    it('should delete the refresh key from Redis when token is valid', async () => {
      const token = 'refresh-token-to-revoke';
      jwtService.verify.mockReturnValue({ sub: 'user-uuid-001' });

      await service.logout(token);

      expect(redis.del).toHaveBeenCalledWith(
        `refresh_token:user-uuid-001:${token}`,
      );
    });

    it('should still blacklist token even when verify throws (expired token)', async () => {
      const token = 'expired-refresh-token';
      jwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await service.logout(token);

      expect(redis.set).toHaveBeenCalledWith(
        `blacklist:${token}`,
        '1',
        24 * 60 * 60,
      );
      // Should NOT have attempted to delete refresh key since verify failed
      expect(redis.del).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Rate Limiting
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Rate Limiting', () => {
    const email = 'user@test.com';
    const password = 'wrongpassword';

    it('should allow login when under rate limit (less than 5 attempts)', async () => {
      redis.get.mockResolvedValue('3'); // 3 failed attempts - under limit
      const mockUser = createMockUser({ email });
      prisma.user.findMany.mockResolvedValue([mockUser]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.user.update.mockResolvedValue(mockUser);

      const result = await service.validateUser(email, password);

      expect(result).toEqual(mockUser);
    });

    it('should throw ForbiddenException after 5 failed attempts', async () => {
      redis.get.mockResolvedValue('5'); // exactly at limit
      redis.client.ttl.mockResolvedValue(900); // 15 min remaining

      await expect(service.validateUser(email, password)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.validateUser(email, password)).rejects.toThrow(
        /Muitas tentativas de login/,
      );
    });

    it('should throw ForbiddenException when attempts exceed limit', async () => {
      redis.get.mockResolvedValue('7'); // over limit
      redis.client.ttl.mockResolvedValue(600);

      await expect(service.validateUser(email, password)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should reset counter after successful login', async () => {
      redis.get.mockResolvedValue('2'); // some failed attempts
      const mockUser = createMockUser({ email });
      prisma.user.findMany.mockResolvedValue([mockUser]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.user.update.mockResolvedValue(mockUser);

      await service.validateUser(email, password);

      expect(redis.del).toHaveBeenCalledWith(`auth:failed_attempts:${email}`);
    });

    it('should increment failed attempt counter on wrong password', async () => {
      redis.get.mockResolvedValue('0');
      const mockUser = createMockUser({ email });
      prisma.user.findMany.mockResolvedValue([mockUser]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.validateUser(email, password)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(redis.client.incr).toHaveBeenCalledWith(
        `auth:failed_attempts:${email}`,
      );
    });

    it('should set expiry on first failed attempt', async () => {
      redis.get.mockResolvedValue(null); // no prior attempts
      redis.client.incr.mockResolvedValue(1); // first increment
      prisma.user.findMany.mockResolvedValue([]); // user not found

      await expect(service.validateUser(email, password)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(redis.client.expire).toHaveBeenCalledWith(
        `auth:failed_attempts:${email}`,
        15 * 60,
      );
    });

    it('should NOT set expiry on subsequent failed attempts', async () => {
      redis.get.mockResolvedValue('2');
      redis.client.incr.mockResolvedValue(3); // not first increment
      prisma.user.findMany.mockResolvedValue([]);

      await expect(service.validateUser(email, password)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(redis.client.expire).not.toHaveBeenCalled();
    });

    it('should include remaining minutes in rate limit error message', async () => {
      redis.get.mockResolvedValue('5');
      redis.client.ttl.mockResolvedValue(300); // 5 min remaining -> ceil(300/60)=5

      await expect(service.validateUser(email, password)).rejects.toThrow(
        /5 minuto\(s\)/,
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getProfile
  // ═══════════════════════════════════════════════════════════════════════════
  describe('getProfile', () => {
    it('should return user with role and permissions', async () => {
      const mockProfile = {
        id: 'user-uuid-001',
        email: 'admin@empresa.com',
        name: 'Admin User',
        avatar: null,
        phone: '+5511999990000',
        tenantId: 'tenant-uuid-001',
        roleId: 'role-uuid-001',
        role: {
          id: 'role-uuid-001',
          name: 'Admin',
          permissions: [
            { permission: { resource: 'products', action: 'create' } },
            { permission: { resource: 'products', action: 'read' } },
          ],
        },
        tenant: { id: 'tenant-uuid-001', name: 'Empresa Teste LTDA', plan: 'PRO' },
      };
      prisma.user.findUnique.mockResolvedValue(mockProfile);

      const result = await service.getProfile('user-uuid-001');

      expect(result).toEqual(mockProfile);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-uuid-001' },
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
    });

    it('should throw UnauthorizedException when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('nonexistent-id')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.getProfile('nonexistent-id')).rejects.toThrow(
        'Usuário não encontrado',
      );
    });

    it('should return user with null role when roleId is null', async () => {
      const mockProfile = {
        id: 'user-uuid-002',
        email: 'norole@empresa.com',
        name: 'No Role User',
        avatar: null,
        phone: null,
        tenantId: 'tenant-uuid-001',
        roleId: null,
        role: null,
        tenant: { id: 'tenant-uuid-001', name: 'Empresa Teste LTDA', plan: 'PRO' },
      };
      prisma.user.findUnique.mockResolvedValue(mockProfile);

      const result = await service.getProfile('user-uuid-002');

      expect(result.role).toBeNull();
      expect(result.roleId).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // forgotPassword
  // ═══════════════════════════════════════════════════════════════════════════
  describe('forgotPassword', () => {
    const email = 'admin@empresa.com';

    it('should generate token and store in Redis when user exists', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'user-uuid-001', tenantId: 'tenant-uuid-001' });

      await service.forgotPassword(email);

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { email, deletedAt: null, status: 'ACTIVE' },
        select: { id: true, tenantId: true },
      });
      expect(redis.set).toHaveBeenCalledWith(
        expect.stringMatching(/^password_reset:/),
        expect.stringContaining('"userId":"user-uuid-001"'),
        3600, // 1 hour TTL
      );
    });

    it('should return silently (not throw) when email does not exist', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(service.forgotPassword('unknown@test.com')).resolves.toBeUndefined();
      expect(redis.set).not.toHaveBeenCalled();
    });

    it('should store userId and tenantId in the token payload', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'user-uuid-001', tenantId: 'tenant-uuid-001' });

      await service.forgotPassword(email);

      const storedValue = redis.set.mock.calls[0][1] as string;
      const parsed = JSON.parse(storedValue);
      expect(parsed.userId).toBe('user-uuid-001');
      expect(parsed.tenantId).toBe('tenant-uuid-001');
    });

    it('should set TTL of 1 hour on the reset token', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'user-uuid-001', tenantId: 'tenant-uuid-001' });

      await service.forgotPassword(email);

      expect(redis.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        60 * 60,
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // resetPassword
  // ═══════════════════════════════════════════════════════════════════════════
  describe('resetPassword', () => {
    const token = 'valid-reset-token-hex';
    const newPassword = 'NewS3cur3P@ss';

    it('should validate token, hash password, update user, and invalidate token', async () => {
      redis.get.mockResolvedValue(JSON.stringify({ userId: 'user-uuid-001', tenantId: 'tenant-uuid-001' }));
      prisma.user.findUnique.mockResolvedValue({ id: 'user-uuid-001', status: 'ACTIVE' });
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-password');
      prisma.user.update.mockResolvedValue({});

      await service.resetPassword(token, newPassword);

      expect(redis.get).toHaveBeenCalledWith(`password_reset:${token}`);
      expect(bcrypt.hash).toHaveBeenCalledWith(newPassword, 12);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-uuid-001' },
        data: { password: 'new-hashed-password' },
      });
      expect(redis.del).toHaveBeenCalledWith(`password_reset:${token}`);
    });

    it('should throw BadRequestException when token is invalid or expired', async () => {
      redis.get.mockResolvedValue(null);

      await expect(service.resetPassword(token, newPassword)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.resetPassword(token, newPassword)).rejects.toThrow(
        'Token de redefinição inválido ou expirado',
      );
    });

    it('should throw BadRequestException when user is not found', async () => {
      redis.get.mockResolvedValue(JSON.stringify({ userId: 'nonexistent', tenantId: 'tenant-uuid-001' }));
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.resetPassword(token, newPassword)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.resetPassword(token, newPassword)).rejects.toThrow(
        'Usuário não encontrado ou inativo',
      );
    });

    it('should throw BadRequestException when user is inactive', async () => {
      redis.get.mockResolvedValue(JSON.stringify({ userId: 'user-uuid-001', tenantId: 'tenant-uuid-001' }));
      prisma.user.findUnique.mockResolvedValue({ id: 'user-uuid-001', status: 'INACTIVE' });

      await expect(service.resetPassword(token, newPassword)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should invalidate token after successful reset (single use)', async () => {
      redis.get.mockResolvedValue(JSON.stringify({ userId: 'user-uuid-001', tenantId: 'tenant-uuid-001' }));
      prisma.user.findUnique.mockResolvedValue({ id: 'user-uuid-001', status: 'ACTIVE' });
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      prisma.user.update.mockResolvedValue({});

      await service.resetPassword(token, newPassword);

      expect(redis.del).toHaveBeenCalledWith(`password_reset:${token}`);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // acceptInvite
  // ═══════════════════════════════════════════════════════════════════════════
  describe('acceptInvite', () => {
    const inviteToken = 'invite-token-hex';
    const name = 'Novo Usuario';
    const password = 'S3cur3P@ss';
    const inviteData = { email: 'novo@empresa.com', tenantId: 'tenant-uuid-001', roleId: 'role-uuid-001' };

    it('should create user and return JWT tokens when invite is valid', async () => {
      redis.get.mockResolvedValue(JSON.stringify(inviteData));
      prisma.user.findFirst.mockResolvedValue(null); // No existing user
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      prisma.user.create.mockResolvedValue({
        id: 'user-uuid-new',
        tenantId: 'tenant-uuid-001',
        roleId: 'role-uuid-001',
        email: 'novo@empresa.com',
      });
      jwtService.sign
        .mockReturnValueOnce('mock-access-token')
        .mockReturnValueOnce('mock-refresh-token');

      const result = await service.acceptInvite(inviteToken, name, password);

      expect(result).toEqual({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresIn: 900,
      });
    });

    it('should validate invite token from Redis', async () => {
      redis.get.mockResolvedValue(JSON.stringify(inviteData));
      prisma.user.findFirst.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      prisma.user.create.mockResolvedValue({
        id: 'user-uuid-new',
        tenantId: 'tenant-uuid-001',
        roleId: 'role-uuid-001',
        email: 'novo@empresa.com',
      });
      jwtService.sign.mockReturnValue('token');

      await service.acceptInvite(inviteToken, name, password);

      expect(redis.get).toHaveBeenCalledWith(`invite:${inviteToken}`);
    });

    it('should throw BadRequestException when invite token is invalid or expired', async () => {
      redis.get.mockResolvedValue(null);

      await expect(service.acceptInvite(inviteToken, name, password)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.acceptInvite(inviteToken, name, password)).rejects.toThrow(
        'Convite inválido ou expirado',
      );
    });

    it('should throw BadRequestException when user already exists in tenant', async () => {
      redis.get.mockResolvedValue(JSON.stringify(inviteData));
      prisma.user.findFirst.mockResolvedValue({ id: 'existing-user' }); // Existing user

      await expect(service.acceptInvite(inviteToken, name, password)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.acceptInvite(inviteToken, name, password)).rejects.toThrow(
        'Já existe um usuário com este email neste tenant',
      );
    });

    it('should hash password with bcrypt before creating user', async () => {
      redis.get.mockResolvedValue(JSON.stringify(inviteData));
      prisma.user.findFirst.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('secure-hash');
      prisma.user.create.mockResolvedValue({
        id: 'user-uuid-new',
        tenantId: 'tenant-uuid-001',
        roleId: 'role-uuid-001',
        email: 'novo@empresa.com',
      });
      jwtService.sign.mockReturnValue('token');

      await service.acceptInvite(inviteToken, name, password);

      expect(bcrypt.hash).toHaveBeenCalledWith(password, 12);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          password: 'secure-hash',
          email: inviteData.email,
          tenantId: inviteData.tenantId,
          roleId: inviteData.roleId,
          name,
          status: 'ACTIVE',
        }),
        select: { id: true, tenantId: true, roleId: true, email: true },
      });
    });

    it('should invalidate invite token after successful acceptance', async () => {
      redis.get.mockResolvedValue(JSON.stringify(inviteData));
      prisma.user.findFirst.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      prisma.user.create.mockResolvedValue({
        id: 'user-uuid-new',
        tenantId: 'tenant-uuid-001',
        roleId: 'role-uuid-001',
        email: 'novo@empresa.com',
      });
      jwtService.sign.mockReturnValue('token');

      await service.acceptInvite(inviteToken, name, password);

      expect(redis.del).toHaveBeenCalledWith(`invite:${inviteToken}`);
    });
  });
});
