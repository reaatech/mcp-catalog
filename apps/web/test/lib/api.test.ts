import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authStore } from '../../src/lib/api.js';

describe('authStore', () => {
  beforeEach(() => {
    authStore.clear();
  });

  it('should start with no token or user', () => {
    expect(authStore.getToken()).toBeNull();
    expect(authStore.getUser()).toBeNull();
  });

  it('should store and retrieve session', () => {
    const user = { id: 'u1', email: 'test@test.com', name: 'Test', role: 'viewer' as const };
    authStore.setSession('token-123', user);

    expect(authStore.getToken()).toBe('token-123');
    expect(authStore.getUser()).toEqual(user);
  });

  it('should clear session', () => {
    const user = { id: 'u1', email: 'test@test.com', name: 'Test', role: 'viewer' as const };
    authStore.setSession('token-123', user);
    authStore.clear();

    expect(authStore.getToken()).toBeNull();
    expect(authStore.getUser()).toBeNull();
  });

  it('should return null for invalid user JSON', () => {
    localStorage.setItem('mcp_catalog_user', 'invalid json');
    expect(authStore.getUser()).toBeNull();
  });
});
