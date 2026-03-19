import type { Request, Response, NextFunction } from "express";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "dev-secret-change-in-production"
);

export async function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  try {
    const token =
      req.cookies?.token ??
      req.headers.authorization?.replace("Bearer ", "");

    if (token) {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      (req as any).user = payload;
    }
  } catch {
    // token inválido ou ausente — req.user fica undefined
  }
  next();
}
