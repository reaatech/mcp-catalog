import { describe, it, expect, vi, beforeAll } from 'vitest';
import {
  generateToken,
  generateRefreshToken,
  verifyToken,
  hashPassword,
  comparePassword,
  generateApiKey,
  verifyApiKey,
} from '../../src/utils/auth.js';

// Mock the env module
vi.mock('../../src/config.js', () => ({
  env: {
    JWT_SECRET: 'test-secret-key-for-testing-only',
    JWT_EXPIRES_IN: '1h',
    JWT_REFRESH_EXPIRES_IN: '7d',
    API_KEY_HASH_ROUNDS: 4,
  },
}));

describe('Auth Utils', () => {
  const mockUser = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'test@example.com',
    name: 'Test User',
    role: 'developer',
    passwordHash: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: null,
  };

  describe('generateToken', () => {
    it('should generate a JWT token', () => {
      const token = generateToken(mockUser);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('should generate verifiable tokens', () => {
      const token = generateToken(mockUser);
      const payload = verifyToken(token);
      expect(payload.userId).toBe(mockUser.id);
      expect(payload.email).toBe(mockUser.email);
      expect(payload.role).toBe(mockUser.role);
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a refresh token', () => {
      const token = generateRefreshToken(mockUser);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    it('should generate verifiable refresh tokens', () => {
      const token = generateRefreshToken(mockUser);
      const payload = verifyToken(token, 'refresh');
      expect(payload.userId).toBe(mockUser.id);
      expect(payload.typ).toBe('refresh');
    });
  });

  describe('verifyToken', () => {
    it('should throw on invalid token', () => {
      expect(() => verifyToken('invalid-token')).toThrow();
    });

    it('should throw on tampered token', () => {
      const token = generateToken(mockUser);
      const tampered = token.slice(0, -5) + 'xxxxx';
      expect(() => verifyToken(tampered)).toThrow();
    });

    it('should reject an access token when a refresh token is expected', () => {
      const token = generateToken(mockUser);
      expect(() => verifyToken(token, 'refresh')).toThrow(/Invalid token type/);
    });

    it('should reject a refresh token when an access token is expected', () => {
      const token = generateRefreshToken(mockUser);
      expect(() => verifyToken(token, 'access')).toThrow(/Invalid token type/);
    });
  });

  describe('hashPassword / comparePassword', () => {
    it('should hash a password', async () => {
      const hash = await hashPassword('mysecretpassword');
      expect(hash).toBeDefined();
      expect(hash).not.toBe('mysecretpassword');
      expect(hash.startsWith('$2')).toBe(true);
    });

    it('should verify correct password', async () => {
      const hash = await hashPassword('mysecretpassword');
      const isValid = await comparePassword('mysecretpassword', hash);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const hash = await hashPassword('mysecretpassword');
      const isValid = await comparePassword('wrongpassword', hash);
      expect(isValid).toBe(false);
    });
  });

  describe('generateApiKey / verifyApiKey', () => {
    it('should generate an API key with hash and prefix', async () => {
      const { key, prefix, hash } = await generateApiKey();
      expect(key).toBeDefined();
      expect(hash).toBeDefined();
      expect(key.startsWith('mcp_')).toBe(true);
      expect(prefix).toBe(key.slice(0, 16));
      expect(key).not.toBe(hash);
    });

    it('should verify correct API key', async () => {
      const { key, hash } = await generateApiKey();
      const isValid = await verifyApiKey(key, hash);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect API key', async () => {
      const { hash } = await generateApiKey();
      const isValid = await verifyApiKey('wrong-key', hash);
      expect(isValid).toBe(false);
    });
  });
});
