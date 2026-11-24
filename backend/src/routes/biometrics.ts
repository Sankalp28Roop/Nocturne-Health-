import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';
import { calculateBmi } from '../utils/calculations.js';

const router = Router();

// POST /api/v1/biometrics/log
router.post('/log', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { recordedAt, weightKg, heightCm, isFasting, notes } = req.body;

    if (!weightKg || isNaN(Number(weightKg))) {
      return res.status(400).json({ error: 'Valid weightKg is required' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    const finalHeightCm = heightCm !== undefined && heightCm !== null && !isNaN(Number(heightCm))
      ? Number(heightCm)
      : user?.heightCm || null;

    const bmi = calculateBmi(Number(weightKg), finalHeightCm);

    // Calculate real delta against previous log if exists
    const previousLog = await prisma.biometricsLog.findFirst({
      where: { userId },
      orderBy: { recordedAt: 'desc' }
    });

    const deltaVsLastWeekKg = previousLog
      ? Number((Number(weightKg) - previousLog.weightKg).toFixed(1))
      : null;

    const log = await prisma.biometricsLog.create({
      data: {
        userId,
        recordedAt: recordedAt ? new Date(recordedAt) : new Date(),
        weightKg: Number(weightKg),
        heightCm: finalHeightCm,
        bmi,
        isFasting: Boolean(isFasting),
        notes: notes || null,
        deltaVsLastWeekKg
      }
    });

    // Update user profile with latest real weight and height
    await prisma.user.update({
      where: { id: userId },
      data: {
        weightKg: Number(weightKg),
        ...(finalHeightCm ? { heightCm: finalHeightCm } : {})
      }
    });

    return res.status(201).json({
      status: 'success',
      logId: log.id,
      bmi: log.bmi,
      deltaVsLastWeekKg: log.deltaVsLastWeekKg
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/v1/biometrics/hydration
router.post('/hydration', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { amountMl, recordedAt } = req.body;

    if (!amountMl || isNaN(Number(amountMl))) {
      return res.status(400).json({ error: 'Valid amountMl is required' });
    }

    const hydration = await prisma.hydrationLog.create({
      data: {
        userId,
        amountMl: Number(amountMl),
        recordedAt: recordedAt ? new Date(recordedAt) : new Date()
      }
    });

    return res.status(201).json({
      status: 'success',
      hydrationId: hydration.id,
      amountMl: hydration.amountMl,
      message: 'Hydration recorded successfully'
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
