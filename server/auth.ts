import type { Request, Response, NextFunction } from "express";
import { jwtVerify, SignJWT } from "jose";
import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "dev-secret-mude-em-producao-12345"
);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${buf.toString("hex")}`;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [salt, storedHash] = hash.split(":");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  const storedBuf = Buffer.from(storedHash, "hex");
  return timingSafeEqual(buf, storedBuf);
}

export async function createToken(payload: { id: number; email: string; name: string; role: string }): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(JWT_SECRET);
}

export async function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.token ?? req.headers.authorization?.replace("Bearer ", "");
    if (token) {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      (req as any).user = payload;
    }
  } catch {
    // token inválido — req.user fica undefined
  }
  next();
}
