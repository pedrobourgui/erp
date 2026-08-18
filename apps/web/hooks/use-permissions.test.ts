import { act, renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';

import { useAuthStore } from '@/stores/auth.store';

import { usePermissions } from './use-permissions';


/**
 * AE-27/FN-09: the UI showed every menu item and every button to every role,
 * so a seller clicked into the financial module and collected 403s. `can()` is
 * the primitive the whole gating rests on — including the distinction between
 * "no permission" and "permissions not loaded yet", which must never render as
 * a denial.
 */

function setSession(permissions: string[] | null, roleName: string | null = 'seller') {
  act(() => {
    useAuthStore.setState({ permissions, roleName });
  });
}

describe('usePermissions', () => {
  beforeEach(() => {
    setSession(null, null);
  });

  describe('can', () => {
    it('is true for a granted permission', () => {
      setSession(['orders:create', 'products:read']);
      const { result } = renderHook(() => usePermissions());

      expect(result.current.can('orders:create')).toBe(true);
    });

    it('is false for a permission the role does not have', () => {
      setSession(['orders:create']);
      const { result } = renderHook(() => usePermissions());

      expect(result.current.can('financial:read')).toBe(false);
    });

    it('is false for a role with no permissions at all', () => {
      setSession([]);
      const { result } = renderHook(() => usePermissions());

      expect(result.current.can('orders:read')).toBe(false);
    });

    it('is true for everything when the role is owner', () => {
      setSession([], 'owner');
      const { result } = renderHook(() => usePermissions());

      expect(result.current.can('financial:read')).toBe(true);
      expect(result.current.can('settings:update')).toBe(true);
    });

    it('is true for everything when the role is admin', () => {
      setSession([], 'admin');
      const { result } = renderHook(() => usePermissions());

      expect(result.current.can('users:delete')).toBe(true);
    });

    it('is false while permissions are still unknown', () => {
      setSession(null);
      const { result } = renderHook(() => usePermissions());

      expect(result.current.can('orders:read')).toBe(false);
      expect(result.current.isLoaded).toBe(false);
    });
  });

  describe('isLoaded', () => {
    it('is true once the list arrived, even when empty', () => {
      setSession([]);
      const { result } = renderHook(() => usePermissions());

      expect(result.current.isLoaded).toBe(true);
    });

    it('is true for owner even before the list arrives', () => {
      setSession(null, 'owner');
      const { result } = renderHook(() => usePermissions());

      expect(result.current.isLoaded).toBe(true);
    });
  });

  describe('canAny', () => {
    it('is true when at least one permission is granted', () => {
      setSession(['orders:read']);
      const { result } = renderHook(() => usePermissions());

      expect(result.current.canAny(['financial:read', 'orders:read'])).toBe(true);
    });

    it('is false when none is granted', () => {
      setSession(['orders:read']);
      const { result } = renderHook(() => usePermissions());

      expect(result.current.canAny(['financial:read', 'users:read'])).toBe(false);
    });

    it('is true for an empty requirement — nothing to satisfy', () => {
      setSession(['orders:read']);
      const { result } = renderHook(() => usePermissions());

      expect(result.current.canAny([])).toBe(true);
    });
  });

  describe('canAll', () => {
    it('is true only when every permission is granted', () => {
      setSession(['orders:read', 'orders:create']);
      const { result } = renderHook(() => usePermissions());

      expect(result.current.canAll(['orders:read', 'orders:create'])).toBe(true);
      expect(result.current.canAll(['orders:read', 'orders:delete'])).toBe(false);
    });
  });

  describe('isOwner', () => {
    it('recognises owner and admin', () => {
      setSession([], 'owner');
      expect(renderHook(() => usePermissions()).result.current.isOwner).toBe(true);

      setSession([], 'admin');
      expect(renderHook(() => usePermissions()).result.current.isOwner).toBe(true);
    });

    it('is false for every other role', () => {
      setSession(['financial:read'], 'financial');
      expect(renderHook(() => usePermissions()).result.current.isOwner).toBe(false);
    });
  });
});
