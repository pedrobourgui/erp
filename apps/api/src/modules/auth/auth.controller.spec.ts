import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';

// ─── Mock AuthService ────────────────────────────────────────────────────────

function createMockAuthService() {
  return {
    validateUser: jest.fn(),
    login: jest.fn(),
    refreshToken: jest.fn(),
    logout: jest.fn(),
    getProfile: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
    acceptInvite: jest.fn(),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('AuthController', () => {
  let controller: AuthController;
  let authService: ReturnType<typeof createMockAuthService>;

  beforeEach(async () => {
    authService = createMockAuthService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── login ────────────────────────────────────────────────────────────
  describe('POST /auth/login', () => {
    const dto = { email: 'admin@empresa.com', password: 'S3cur3P@ss' };

    it('should validate user and return tokens with user info', async () => {
      const mockUser = {
        id: 'user-uuid-001',
        email: 'admin@empresa.com',
        name: 'Admin',
        tenantId: 'tenant-uuid-001',
        role: { id: 'role-001', name: 'Admin' },
      };
      const mockTokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 900,
      };
      authService.validateUser.mockResolvedValue(mockUser);
      authService.login.mockResolvedValue(mockTokens);

      const result = await controller.login(dto);

      expect(authService.validateUser).toHaveBeenCalledWith(dto.email, dto.password);
      expect(authService.login).toHaveBeenCalledWith(mockUser);
      expect(result).toEqual({
        success: true,
        data: {
          user: {
            id: mockUser.id,
            email: mockUser.email,
            name: mockUser.name,
            tenantId: mockUser.tenantId,
            role: mockUser.role,
          },
          ...mockTokens,
        },
      });
    });

    it('should have @Public() decorator', () => {
      const metadata = Reflect.getMetadata(IS_PUBLIC_KEY, controller.login);
      expect(metadata).toBe(true);
    });
  });

  // ─── refresh ──────────────────────────────────────────────────────────
  describe('POST /auth/refresh', () => {
    const dto = { refreshToken: 'old-refresh-token' };

    it('should return new token pair', async () => {
      const mockTokens = {
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
        expiresIn: 900,
      };
      authService.refreshToken.mockResolvedValue(mockTokens);

      const result = await controller.refresh(dto);

      expect(authService.refreshToken).toHaveBeenCalledWith(dto.refreshToken);
      expect(result).toEqual({ success: true, data: mockTokens });
    });

    it('should have @Public() decorator', () => {
      const metadata = Reflect.getMetadata(IS_PUBLIC_KEY, controller.refresh);
      expect(metadata).toBe(true);
    });
  });

  // ─── logout ───────────────────────────────────────────────────────────
  describe('POST /auth/logout', () => {
    const dto = { refreshToken: 'token-to-revoke' };

    it('should call logout and return success message', async () => {
      authService.logout.mockResolvedValue(undefined);

      const result = await controller.logout(dto);

      expect(authService.logout).toHaveBeenCalledWith(dto.refreshToken);
      expect(result).toEqual({
        success: true,
        message: 'Logout realizado com sucesso',
      });
    });

    it('should NOT have @Public() decorator (requires auth)', () => {
      const metadata = Reflect.getMetadata(IS_PUBLIC_KEY, controller.logout);
      expect(metadata).toBeUndefined();
    });
  });

  // ─── me ───────────────────────────────────────────────────────────────
  describe('GET /auth/me', () => {
    it('should return user profile', async () => {
      const mockProfile = {
        id: 'user-uuid-001',
        email: 'admin@empresa.com',
        name: 'Admin',
        tenantId: 'tenant-uuid-001',
        role: { id: 'role-001', name: 'Admin', permissions: [] },
        tenant: { id: 'tenant-uuid-001', name: 'Empresa', plan: 'PRO' },
      };
      authService.getProfile.mockResolvedValue(mockProfile);

      const result = await controller.me('user-uuid-001');

      expect(authService.getProfile).toHaveBeenCalledWith('user-uuid-001');
      expect(result).toEqual({ success: true, data: mockProfile });
    });

    it('should NOT have @Public() decorator (requires auth)', () => {
      const metadata = Reflect.getMetadata(IS_PUBLIC_KEY, controller.me);
      expect(metadata).toBeUndefined();
    });
  });

  // ─── forgot-password ──────────────────────────────────────────────────
  describe('POST /auth/forgot-password', () => {
    const dto = { email: 'user@empresa.com' };

    it('should call forgotPassword and return generic success message', async () => {
      authService.forgotPassword.mockResolvedValue(undefined);

      const result = await controller.forgotPassword(dto);

      expect(authService.forgotPassword).toHaveBeenCalledWith(dto.email);
      expect(result).toEqual({
        success: true,
        message: 'Se o email existir no sistema, um link de redefinição será enviado',
      });
    });

    it('should have @Public() decorator', () => {
      const metadata = Reflect.getMetadata(IS_PUBLIC_KEY, controller.forgotPassword);
      expect(metadata).toBe(true);
    });
  });

  // ─── reset-password ───────────────────────────────────────────────────
  describe('POST /auth/reset-password', () => {
    const dto = { token: 'reset-token', password: 'NewP@ss123' };

    it('should call resetPassword and return success message', async () => {
      authService.resetPassword.mockResolvedValue(undefined);

      const result = await controller.resetPassword(dto);

      expect(authService.resetPassword).toHaveBeenCalledWith(dto.token, dto.password);
      expect(result).toEqual({
        success: true,
        message: 'Senha redefinida com sucesso',
      });
    });

    it('should have @Public() decorator', () => {
      const metadata = Reflect.getMetadata(IS_PUBLIC_KEY, controller.resetPassword);
      expect(metadata).toBe(true);
    });
  });

  // ─── accept-invite ────────────────────────────────────────────────────
  describe('POST /auth/accept-invite', () => {
    const dto = { token: 'invite-token', name: 'Novo User', password: 'S3cur3P@ss' };

    it('should call acceptInvite and return tokens', async () => {
      const mockTokens = {
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
        expiresIn: 900,
      };
      authService.acceptInvite.mockResolvedValue(mockTokens);

      const result = await controller.acceptInvite(dto);

      expect(authService.acceptInvite).toHaveBeenCalledWith(
        dto.token,
        dto.name,
        dto.password,
      );
      expect(result).toEqual({ success: true, data: mockTokens });
    });

    it('should have @Public() decorator', () => {
      const metadata = Reflect.getMetadata(IS_PUBLIC_KEY, controller.acceptInvite);
      expect(metadata).toBe(true);
    });
  });
});
