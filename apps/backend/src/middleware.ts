import type { Request, Response, NextFunction } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';

export interface CustomJwtResponse extends JwtPayload {
  userId: string;
}

export interface AuthRequest extends Request {
  userId?: string;
}

export function AuthMiddleWare(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  const token = req.cookies.Authorization;
  if (token === undefined) {
    res.status(400).json({ message: 'cookie not found' });
    return;
  }

  const passcode = process.env.JWT_PASS;
  if (passcode === undefined) {
    console.log('env not loaded');
    res.status(500).json({ message: 'env not found error' });
    return;
  }

  try {
    const tokenData = jwt.verify(token, passcode) as CustomJwtResponse;
    if (typeof tokenData === 'string') {
      throw new Error('expected customJwt but got string');
    }
    console.log('token data', tokenData);
    req.userId = tokenData.userId;
    next();
  } catch (error) {
    console.log('error on authentication', error);
    res.status(400).json({ message: 'error on authorization', error });
  }
}
