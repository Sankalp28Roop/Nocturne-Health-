import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';

const router = Router();

// GET /api/v1/community/challenges?tab=active|leaderboards|clubs
router.get('/challenges', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const tab = (req.query.tab as string) || 'active';

    const challenges = await prisma.communityChallenge.findMany({
      where: { isActive: true },
      include: {
        participants: {
          where: { userId }
        }
      }
    });

    const activeFeatured = challenges[0] || null;
    let featuredChallenge = null;

    if (activeFeatured) {
      const userProg = activeFeatured.participants[0]?.completedValue ?? 0;
      const target = activeFeatured.targetValue;
      const pct = target > 0 ? Math.min(100, Math.round((userProg / target) * 100)) : 0;
      featuredChallenge = {
        id: activeFeatured.id,
        title: activeFeatured.title,
        description: activeFeatured.description,
        daysRemaining: activeFeatured.daysRemaining,
        totalParticipants: activeFeatured.totalParticipants,
        userProgress: {
          completedKm: userProg,
          targetKm: target,
          percentage: pct,
          remainingKm: Math.max(0, Number((target - userProg).toFixed(1)))
        }
      };
    }

    const rivalries = await prisma.rivalry.findMany({
      where: { userId }
    });

    return res.json({
      tab,
      featuredChallenge,
      rivalries: rivalries.map(r => ({
        id: r.id,
        type: r.title,
        userScore: r.userScore,
        opponentName: r.opponentName,
        opponentScore: r.opponentScore,
        lead: r.userScore - r.opponentScore,
        unit: r.unit,
        endsAt: r.endsAt,
        cheersCount: r.cheersCount
      })),
      leaderboards: []
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/v1/community/challenges/:id/log
router.post('/challenges/:id/log', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const challengeId = String(req.params.id);
    const { amount } = req.body;

    if (!amount || isNaN(Number(amount))) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    const progress = await prisma.userChallengeProgress.upsert({
      where: {
        userId_challengeId: {
          userId,
          challengeId
        }
      },
      update: {
        completedValue: { increment: Number(amount) }
      },
      create: {
        userId,
        challengeId,
        completedValue: Number(amount)
      }
    });

    return res.json({
      status: 'success',
      challengeId,
      newCompletedKm: progress.completedValue,
      message: `Logged ${amount} towards challenge`
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/v1/community/rivalries/:id/cheer
router.post('/rivalries/:id/cheer', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rivalryId = String(req.params.id);

    const updated = await prisma.rivalry.update({
      where: { id: rivalryId },
      data: {
        cheersCount: { increment: 1 }
      }
    });

    return res.json({
      status: 'success',
      rivalryId: updated.id,
      cheersCount: updated.cheersCount,
      message: 'Cheer registered'
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
