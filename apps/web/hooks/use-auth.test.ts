import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock the auth store
const mockHydrate = vi.fn();
const mockLogin = vi.fn();
const mockLogout = vi.fn();

const mockStoreState = {
  user: null as { id: string; name: string; email: string; role: string; tenantId: string } | null,
  token: null as string | null,
  isAuthenticated: false,
  isLoading: false,
  login: mockLogin,
  logout: mockLogout,
  hydrate: mockHydrate,
  setUser: vi.fn(),
};

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: vi.fn(() => mockStoreState),
}));

import { useAuth } from './use-auth';

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState.user = null;
    mockStoreState.token = null;
    mockStoreState.isAuthenticated = false;
    mockStoreState.isLoading = false;
  });

  it('should call hydrate on mount', () => {
    renderHook(() => useAuth());
    expect(mockHydrate).toHaveBeenCalledTimes(1);
  });

  it('should return user, token, isAuthenticated, isLoading, login, logout', () => {
    mockStoreState.user = {
      id: '1',
      name: 'John',
      email: 'john@test.com',
      role: 'admin',
      tenantId: 't1',
    };
    mockStoreState.token = 'tok';
    mockStoreState.isAuthenticated = true;

    const { result } = renderHook(() => useAuth());

    expect(result.current.user).toEqual(mockStoreState.user);
    expect(result.current.token).toBe('tok');
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.login).toBe(mockLogin);
    expect(result.current.logout).toBe(mockLogout);
  });

  it('should return null user when not authenticated', () => {
    const { result } = renderHook(() => useAuth());

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });
});
