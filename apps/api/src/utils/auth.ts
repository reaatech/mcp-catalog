import jwt, { type Secret, type SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { db } from '../db/index.js';
import { refreshTokenFamilies, type User } from '../db/schema.js';
import { eq, and, isNull } from 'drizzle-orm';
import { env } from '../config.js';

export type TokenType = 'access' | 'refresh';

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  typ: TokenType;
  family?: string;
}

function signToken(user: User, typ: TokenType): string {
  const payload: TokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    typ,
  };
  const expiresIn = typ === 'access' ? env.JWT_EXPIRES_IN : env.JWT_REFRESH_EXPIRES_IN;
  return jwt.sign(payload, env.JWT_SECRET as Secret, { expiresIn: expiresIn as SignOptions['expiresIn'] });
}

export function generateToken(user: User): string {
  return signToken(user, 'access');
}

export function generateRefreshToken(user: User): string {
  return signToken(user, 'refresh');
}

export function generateFamilyId(): string {
  return randomBytes(32).toString('hex');
}

export async function createRefreshTokenFamily(userId: string): Promise<{ familyId: string; token: string }> {
  const familyId = generateFamilyId();
  const token = jwt.sign(
    { userId, family: familyId, typ: 'refresh' as const },
    env.JWT_SECRET as Secret,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn'] }
  );
  await db.insert(refreshTokenFamilies).values({
    userId,
    family: familyId,
  });
  return { familyId, token };
}

export async function rotateRefreshToken(
  userId: string,
  familyId: string
): Promise<{ token: string } | null> {
  const [existing] = await db
    .select()
    .from(refreshTokenFamilies)
    .where(and(eq(refreshTokenFamilies.family, familyId), isNull(refreshTokenFamilies.revoked)))
    .limit(1);

  if (!existing) return null;

  await db
    .update(refreshTokenFamilies)
    .set({ revoked: new Date() })
    .where(eq(refreshTokenFamilies.family, familyId));

  await db.insert(refreshTokenFamilies).values({
    userId,
    family: familyId,
  });

  const token = jwt.sign(
    { userId, family: familyId, typ: 'refresh' as const },
    env.JWT_SECRET as Secret,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn'] }
  );

  return { token };
}

export async function revokeRefreshTokenFamily(familyId: string): Promise<void> {
  await db
    .update(refreshTokenFamilies)
    .set({ revoked: new Date() })
    .where(and(eq(refreshTokenFamilies.family, familyId), isNull(refreshTokenFamilies.revoked)));
}

export function verifyToken(token: string, expectedType: TokenType = 'access'): TokenPayload {
  const payload = jwt.verify(token, env.JWT_SECRET) as TokenPayload;
  if (payload.typ !== expectedType) {
    throw new Error(`Invalid token type: expected ${expectedType}, got ${payload.typ}`);
  }
  return payload;
}

export function validatePasswordComplexity(password: string): boolean {
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  return hasUpper && hasLower && hasDigit && hasSpecial;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, env.API_KEY_HASH_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export const API_KEY_PREFIX_LEN = 16;

export function apiKeyPrefix(key: string): string {
  return key.slice(0, API_KEY_PREFIX_LEN);
}

export async function generateApiKey(): Promise<{ key: string; prefix: string; hash: string }> {
  const key = `mcp_${randomBytes(32).toString('hex')}`;
  const hash = await bcrypt.hash(key, env.API_KEY_HASH_ROUNDS);
  return { key, prefix: apiKeyPrefix(key), hash };
}

export async function verifyApiKey(key: string, hash: string): Promise<boolean> {
  return bcrypt.compare(key, hash);
}
