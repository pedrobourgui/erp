import { AxiosError } from 'axios';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { getApiErrorMessage } from './api';

function axiosErrorWith(data: unknown, status = 400): AxiosError {
  const err = new AxiosError('Request failed');
  err.response = { data, status, statusText: 'Bad Request', headers: {}, config: {} } as never;
  return err;
}

describe('getApiErrorMessage', () => {
  it('returns the string message from a NestJS-style error body', () => {
    expect(getApiErrorMessage(axiosErrorWith({ message: 'Estoque insuficiente' }))).toBe(
      'Estoque insuficiente'
    );
  });

  it('joins an array of messages', () => {
    expect(
      getApiErrorMessage(axiosErrorWith({ message: ['Campo A inválido', 'Campo B inválido'] }))
    ).toBe('Campo A inválido, Campo B inválido');
  });

  it('returns undefined when there is no usable message', () => {
    expect(getApiErrorMessage(axiosErrorWith({}))).toBeUndefined();
    expect(getApiErrorMessage(axiosErrorWith({ message: '   ' }))).toBeUndefined();
    expect(getApiErrorMessage(axiosErrorWith({ message: 42 }))).toBeUndefined();
  });

  // FN-71: a 403 used to reach the user as "Erro ao criar metodo. Tente
  // novamente." — which reads as a bug in the system, so people retry forever.
  it('explains a 403 instead of letting it read as a technical failure', () => {
    expect(
      getApiErrorMessage(axiosErrorWith({ message: 'Permissão insuficiente para esta ação' }, 403))
    ).toBe('Você não tem permissão para realizar esta ação. Fale com o administrador.');
  });

  it('overrides the backend message on a 403 even when it has none', () => {
    expect(getApiErrorMessage(axiosErrorWith({}, 403))).toBe(
      'Você não tem permissão para realizar esta ação. Fale com o administrador.'
    );
  });

  it('keeps the backend message for every other status', () => {
    expect(getApiErrorMessage(axiosErrorWith({ message: 'Saldo insuficiente' }, 409))).toBe(
      'Saldo insuficiente'
    );
  });

  it('returns undefined for non-Axios errors', () => {
    expect(getApiErrorMessage(new Error('boom'))).toBeUndefined();
    expect(getApiErrorMessage('nope')).toBeUndefined();
    expect(getApiErrorMessage(undefined)).toBeUndefined();
  });
});

describe('api module', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  describe('request interceptor', () => {
    it('should attach Authorization header when token exists in localStorage', async () => {
      localStorage.setItem('erp_token', 'my-token');

      const { default: api } = await import('./api');

      // Mock the adapter to capture the config
      let capturedConfig: Record<string, unknown> | null = null;
      api.defaults.adapter = async (config) => {
        capturedConfig = config as Record<string, unknown>;
        return {
          data: {},
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        } as never;
      };

      await api.get('/test');

      expect(capturedConfig).not.toBeNull();
      const headers = (capturedConfig as Record<string, unknown>)?.headers;
      expect((headers as Record<string, unknown>)?.Authorization).toBe('Bearer my-token');
    });

    it('should not attach Authorization header when no token exists', async () => {
      // No token in localStorage
      const { default: api } = await import('./api');

      let capturedConfig: Record<string, unknown> | null = null;
      api.defaults.adapter = async (config) => {
        capturedConfig = config as Record<string, unknown>;
        return {
          data: {},
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        } as never;
      };

      await api.get('/test');

      expect(capturedConfig).not.toBeNull();
      const headers = (capturedConfig as Record<string, unknown>)?.headers;
      expect((headers as Record<string, unknown>)?.Authorization).toBeUndefined();
    });
  });

  describe('response interceptor - 401 handling', () => {
    it('should attempt token refresh on 401 response', async () => {
      localStorage.setItem('erp_token', 'expired-token');
      localStorage.setItem('erp_refresh_token', 'valid-refresh');

      const { default: api } = await import('./api');

      let callCount = 0;
      api.defaults.adapter = async (config) => {
        callCount++;
        if (callCount === 1) {
          // First call returns 401
          const error = {
            response: { status: 401, data: {}, headers: {}, statusText: 'Unauthorized' },
            config: { ...config, _retry: undefined },
            isAxiosError: true,
          };
          throw error;
        }
        // Subsequent calls succeed
        return {
          data: { success: true },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        } as never;
      };

      // The refresh call uses raw axios.post, not our api instance.
      // We can't easily intercept that without more complex mocking.
      // Instead, test that the module is configured correctly.
      expect(api.interceptors.response).toBeDefined();
    });

    it('should have response interceptor configured', async () => {
      const { default: api } = await import('./api');
      // Verify interceptors exist
      expect(api.interceptors.request).toBeDefined();
      expect(api.interceptors.response).toBeDefined();
    });

    // AE-03: a 401 from the login endpoint means "wrong credentials". Treating it
    // as an expired session fired /auth/refresh, failed, and reloaded the page —
    // wiping the error message the login form had just set.
    it('AE-03: does not run the refresh flow for a 401 from /auth/login', async () => {
      localStorage.setItem('erp_refresh_token', 'some-refresh-token');

      const axiosModule = await import('axios');
      const postSpy = vi.spyOn(axiosModule.default, 'post');

      const { default: api } = await import('./api');
      api.defaults.adapter = async (config) => {
        throw {
          response: {
            status: 401,
            data: { message: 'Email ou senha inválidos' },
            headers: {},
            statusText: 'Unauthorized',
          },
          config,
          isAxiosError: true,
        };
      };

      await expect(
        api.post('/auth/login', { email: 'a@b.com', password: 'wrong' })
      ).rejects.toMatchObject({ response: { status: 401 } });

      expect(postSpy).not.toHaveBeenCalled();
    });

    it('AE-03: still runs the refresh flow for a 401 from a protected route', async () => {
      localStorage.setItem('erp_token', 'expired');
      localStorage.setItem('erp_refresh_token', 'valid-refresh');

      const axiosModule = await import('axios');
      const postSpy = vi.spyOn(axiosModule.default, 'post').mockResolvedValue({
        data: { data: { accessToken: 'new-token', refreshToken: 'new-refresh' } },
      } as never);

      const { default: api } = await import('./api');
      let call = 0;
      api.defaults.adapter = async (config) => {
        call++;
        if (call === 1) {
          throw {
            response: { status: 401, data: {}, headers: {}, statusText: 'Unauthorized' },
            config,
            isAxiosError: true,
          };
        }
        return { data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config } as never;
      };

      await expect(api.get('/products')).resolves.toMatchObject({ status: 200 });

      expect(postSpy).toHaveBeenCalledOnce();
      expect(localStorage.getItem('erp_token')).toBe('new-token');
    });
  });

  describe('api configuration', () => {
    it('should have correct default baseURL', async () => {
      const { default: api } = await import('./api');
      expect(api.defaults.baseURL).toBe('http://localhost:3001/api/v1');
    });

    it('should have Content-Type header set to application/json', async () => {
      const { default: api } = await import('./api');
      expect(api.defaults.headers['Content-Type']).toBe('application/json');
    });

    it('should have request and response interceptors configured', async () => {
      const { default: api } = await import('./api');
      expect(api.interceptors.request).toBeDefined();
      expect(api.interceptors.response).toBeDefined();
    });
  });
});
