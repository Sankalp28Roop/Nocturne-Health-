import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../db.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'nocturne_jwt_super_secret_key_2026_obsidian_kinetic';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'nocturne_refresh_super_secret_key_2026_obsidian_kinetic';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().min(1)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// 1. Register with cost-12 bcrypt and short-lived access token + hashed refresh token
router.post('/register', async (req: Request, res: Response) => {
  try {
    const parseResult = registerSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid input', details: parseResult.error.format() });
    }

    const { email, password, displayName } = parseResult.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    // Cost factor 12
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName
      }
    });

    const accessToken = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '15m' });
    const rawRefreshToken = jwt.sign({ userId: user.id }, JWT_REFRESH_SECRET, { expiresIn: '30d' });

    // Store hashed refresh token in database
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawRefreshToken),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });

    return res.status(201).json({
      status: 'success',
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        membershipTier: user.membershipTier,
        level: user.level
      },
      tokens: { accessToken, refreshToken: rawRefreshToken }
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// 2. Login with cost-12 verification and rotating refresh token
router.post('/login', async (req: Request, res: Response) => {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid input', details: parseResult.error.format() });
    }

    const { email, password } = parseResult.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const accessToken = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '15m' });
    const rawRefreshToken = jwt.sign({ userId: user.id }, JWT_REFRESH_SECRET, { expiresIn: '30d' });

    // Store hashed refresh token
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawRefreshToken),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });

    return res.json({
      status: 'success',
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        membershipTier: user.membershipTier,
        level: user.level
      },
      tokens: { accessToken, refreshToken: rawRefreshToken }
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// 3. Token Rotation on refresh
router.post('/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token is required' });
  }

  try {
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as { userId: string };
    const tHash = hashToken(refreshToken);

    const storedToken = await prisma.refreshToken.findUnique({
      where: { tokenHash: tHash }
    });

    if (!storedToken || storedToken.revoked || storedToken.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Refresh token has been revoked or expired' });
    }

    // Revoke old refresh token (Token rotation)
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revoked: true }
    });

    // Generate new pair
    const newAccessToken = jwt.sign({ userId: decoded.userId }, JWT_SECRET, { expiresIn: '15m' });
    const newRefreshToken = jwt.sign({ userId: decoded.userId }, JWT_REFRESH_SECRET, { expiresIn: '30d' });

    await prisma.refreshToken.create({
      data: {
        userId: decoded.userId,
        tokenHash: hashToken(newRefreshToken),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });

    return res.json({
      status: 'success',
      tokens: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
      }
    });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

// 4. Logout / Token revocation
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      const tHash = hashToken(refreshToken);
      await prisma.refreshToken.updateMany({
        where: { tokenHash: tHash },
        data: { revoked: true }
      });
    }
    return res.json({ status: 'success', message: 'Logged out successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
