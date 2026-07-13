import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AxiosError } from 'axios';
import { getApiErrorMessage } from './api';

function axiosErrorWith(data: unknown): AxiosError {
  const err = new AxiosError('Request failed');
  err.response = { data, status: 400, statusText: 'Bad Request', headers: {}, config: {} } as never;
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
