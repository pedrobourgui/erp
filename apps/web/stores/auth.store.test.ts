import { describe, it, expect, vi, beforeEach } from 'vitest';

import api from '@/lib/api';

import { useAuthStore } from './auth.store';

vi.mock('@/lib/api', () => {
  return {
    default: {
      post: vi.fn(),
      get: vi.fn(),
    },
  };
});


const mockedApi = vi.mocked(api);

describe('useAuthStore', () => {
  beforeEach(() => {
    // Reset store state between tests
    useAuthStore.setState({
      user: null,
      token: null,
      permissions: null,
      isAuthenticated: false,
      isLoading: false,
    });
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('login', () => {
    it('should set user and token on successful login', async () => {
      const mockUser = {
        id: '1',
        name: 'John',
        email: 'john@test.com',
        role: 'admin',
        tenantId: 't1',
      };

      mockedApi.post.mockResolvedValueOnce({
        data: {
          data: {
            user: mockUser,
            accessToken: 'access-123',
            refreshToken: 'refresh-123',
          },
        },
      });

      await useAuthStore.getState().login('john@test.com', 'password');

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.token).toBe('access-123');
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(localStorage.getItem('erp_token')).toBe('access-123');
      expect(localStorage.getItem('erp_refresh_token')).toBe('refresh-123');
    });

    it('should set isLoading to true during login', async () => {
      let resolvePromise: (value: unknown) => void;
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockedApi.post.mockReturnValueOnce(pendingPromise as never);

      const loginPromise = useAuthStore.getState().login('a@b.com', 'pass');
      expect(useAuthStore.getState().isLoading).toBe(true);

      resolvePromise!({
        data: {
          data: {
            user: { id: '1', name: 'A', email: 'a@b.com', role: 'admin', tenantId: 't' },
            accessToken: 'tok',
            refreshToken: 'ref',
          },
        },
      });

      await loginPromise;
      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it('should reset isLoading and throw on error', async () => {
      const error = new Error('Invalid credentials');
      mockedApi.post.mockRejectedValueOnce(error);

      await expect(
        useAuthStore.getState().login('bad@test.com', 'wrong')
      ).rejects.toThrow('Invalid credentials');

      expect(useAuthStore.getState().isLoading).toBe(false);
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  // ─── Permissions (lote 4) ────────────────────────────────────────────────

  describe('permissions', () => {
    const profileWithRole = {
      id: '1',
      name: 'Ana',
      email: 'ana@test.com',
      tenantId: 't1',
      role: {
        id: 'role-1',
        name: 'seller',
        permissions: [
          { permission: { resource: 'orders', action: 'create' } },
          { permission: { resource: 'cash-registers', action: 'read-session' } },
        ],
      },
    };

    it('starts as null — "not loaded yet" is not the same as "has none"', () => {
      expect(useAuthStore.getState().permissions).toBeNull();
    });

    it('fetches /auth/me after login, because the login payload has no permissions', async () => {
      mockedApi.post.mockResolvedValueOnce({
        data: {
          data: {
            user: { id: '1', name: 'Ana', email: 'ana@test.com', role: { id: 'role-1', name: 'seller' }, tenantId: 't1' },
            accessToken: 'access-123',
            refreshToken: 'refresh-123',
          },
        },
      });
      mockedApi.get.mockResolvedValueOnce({ data: { data: profileWithRole } });

      await useAuthStore.getState().login('ana@test.com', 'password');

      expect(mockedApi.get).toHaveBeenCalledWith('/auth/me');
      expect(useAuthStore.getState().permissions).toEqual([
        'orders:create',
        'cash-registers:read-session',
      ]);
      expect(useAuthStore.getState().roleName).toBe('seller');
    });

    it('keeps the session usable when /auth/me fails right after login', async () => {
      mockedApi.post.mockResolvedValueOnce({
        data: {
          data: {
            user: { id: '1', name: 'Ana', email: 'ana@test.com', role: 'seller', tenantId: 't1' },
            accessToken: 'access-123',
            refreshToken: 'refresh-123',
          },
        },
      });
      mockedApi.get.mockRejectedValueOnce(new Error('network'));

      await useAuthStore.getState().login('ana@test.com', 'password');

      // Authenticated, but permissions unknown — the UI must show a loading
      // state, never "acesso negado" (a false denial is worse than a spinner).
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().permissions).toBeNull();
    });

    it('fills permissions on hydrate', async () => {
      localStorage.setItem('erp_token', 'stored-token');
      mockedApi.get.mockResolvedValueOnce({ data: { data: profileWithRole } });

      useAuthStore.getState().hydrate();

      await vi.waitFor(() => {
        expect(useAuthStore.getState().permissions).toEqual([
          'orders:create',
          'cash-registers:read-session',
        ]);
      });
      expect(useAuthStore.getState().roleName).toBe('seller');
    });

    it('reads an empty list when the role has no permissions attached', async () => {
      localStorage.setItem('erp_token', 'stored-token');
      mockedApi.get.mockResolvedValueOnce({
        data: { data: { id: '1', name: 'A', email: 'a@b.com', tenantId: 't', role: { id: 'r', name: 'novo' } } },
      });

      useAuthStore.getState().hydrate();

      await vi.waitFor(() => {
        expect(useAuthStore.getState().permissions).toEqual([]);
      });
    });

    it('clears permissions on logout', () => {
      useAuthStore.setState({ permissions: ['orders:read'], roleName: 'seller' });

      useAuthStore.getState().logout();

      expect(useAuthStore.getState().permissions).toBeNull();
      expect(useAuthStore.getState().roleName).toBeNull();
    });
  });

  describe('logout', () => {
    it('should clear state and localStorage', () => {
      useAuthStore.setState({
        user: { id: '1', name: 'A', email: 'a@b.com', role: 'admin', tenantId: 't' },
        token: 'tok',
        isAuthenticated: true,
      });
      localStorage.setItem('erp_token', 'tok');
      localStorage.setItem('erp_refresh_token', 'ref');

      useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(localStorage.getItem('erp_token')).toBeNull();
      expect(localStorage.getItem('erp_refresh_token')).toBeNull();
    });
  });

  describe('setUser', () => {
    it('should update the user', () => {
      const user = { id: '1', name: 'A', email: 'a@b.com', role: 'admin', tenantId: 't' };
      useAuthStore.getState().setUser(user);
      expect(useAuthStore.getState().user).toEqual(user);
    });
  });

  describe('hydrate', () => {
    it('should do nothing if no token in localStorage', () => {
      useAuthStore.getState().hydrate();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(mockedApi.get).not.toHaveBeenCalled();
    });

    it('should set token and fetch user if token exists', async () => {
      const mockUser = { id: '1', name: 'A', email: 'a@b.com', role: 'admin', tenantId: 't' };
      localStorage.setItem('erp_token', 'stored-token');
      mockedApi.get.mockResolvedValueOnce({ data: { data: mockUser } });

      useAuthStore.getState().hydrate();

      expect(useAuthStore.getState().token).toBe('stored-token');
      expect(useAuthStore.getState().isAuthenticated).toBe(true);

      // Wait for the async .then to resolve
      await vi.waitFor(() => {
        expect(useAuthStore.getState().user).toEqual(mockUser);
      });
    });

    it('should clear state on API failure during hydrate', async () => {
      localStorage.setItem('erp_token', 'bad-token');
      localStorage.setItem('erp_refresh_token', 'ref');
      mockedApi.get.mockRejectedValueOnce(new Error('Unauthorized'));

      useAuthStore.getState().hydrate();

      await vi.waitFor(() => {
        expect(useAuthStore.getState().token).toBeNull();
      });

      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().user).toBeNull();
      expect(localStorage.getItem('erp_token')).toBeNull();
      expect(localStorage.getItem('erp_refresh_token')).toBeNull();
    });
  });
});
