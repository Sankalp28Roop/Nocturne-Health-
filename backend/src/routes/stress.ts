import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';

const router = Router();

const breathingSchema = z.object({
  protocol: z.string().default('box_4_4_4_4'),
  durationSec: z.number().int().min(10).default(120),
  completedAt: z.string().datetime().optional()
});

// POST /api/v1/stress/breathing - Log completed breathing session
router.post('/breathing', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const parseResult = breathingSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid input', details: parseResult.error.format() });
    }

    const { protocol, durationSec, completedAt } = parseResult.data;

    const session = await prisma.breathingSession.create({
      data: {
        userId,
        protocol,
        durationSec,
        completedAt: completedAt ? new Date(completedAt) : new Date()
      }
    });

    // Count today's total mindfulness minutes
    const today = new Date().toISOString().split('T')[0];
    const startOfDay = new Date(`${today}T00:00:00.000Z`);
    const endOfDay = new Date(`${today}T23:59:59.999Z`);

    const todaysSessions = await prisma.breathingSession.findMany({
      where: {
        userId,
        completedAt: { gte: startOfDay, lte: endOfDay }
      }
    });

    const totalMindfulSeconds = todaysSessions.reduce((acc, s) => acc + s.durationSec, 0);

    return res.status(201).json({
      status: 'success',
      session,
      todayMindfulness: {
        sessionsCount: todaysSessions.length,
        totalMinutes: Math.round((totalMindfulSeconds / 60) * 10) / 10
      }
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/stress/history - Get recent sessions
router.get('/history', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const sessions = await prisma.breathingSession.findMany({
      where: { userId },
      orderBy: { completedAt: 'desc' },
      take: 20
    });

    return res.json({
      status: 'success',
      sessions
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
