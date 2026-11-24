import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'nocturne_jwt_super_secret_key_2026_obsidian_kinetic';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userEmail?: string;
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing or invalid authorization token' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email?: string };
    if (!decoded.userId) {
      res.status(401).json({ error: 'Unauthorized: Invalid token payload' });
      return;
    }
    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized: Invalid or expired access token' });
  }
}
