/**
 * UAS Backend — Authentication Utilities
 *
 * JWT token generation/verification and password hashing.
 */

import jwt, { SignOptions } from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { Request, Response, NextFunction } from "express";

export interface TokenPayload {
  userId: string;
  username: string;
}

const SALT_ROUNDS = 10;

/**
 * Hash a plaintext password.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash.
 */
export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a JWT token for a user.
 */
export function generateToken(
  payload: TokenPayload,
  secret: string,
  expiry: string,
): string {
  const opts: SignOptions = { expiresIn: expiry as any };
  return jwt.sign(payload, secret, opts);
}

/**
 * Verify and decode a JWT token.
 */
export function verifyToken(token: string, secret: string): TokenPayload {
  return jwt.verify(token, secret) as TokenPayload;
}

/**
 * Express middleware: require authentication.
 * Extracts the Bearer token from Authorization header,
 * verifies it, and attaches the payload to req.user.
 */
export function requireAuth(secret: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      res
        .status(401)
        .json({ error: "Missing or invalid Authorization header" });
      return;
    }

    const token = header.slice(7);
    try {
      const payload = verifyToken(token, secret);
      (req as any).user = payload;
      next();
    } catch {
      res.status(401).json({ error: "Invalid or expired token" });
    }
  };
}
