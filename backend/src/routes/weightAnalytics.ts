import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';
import { calculateBmi, getBmiCategory } from '../utils/calculations.js';

const router = Router();

// GET /api/v1/analytics/weight?timeframe=day|week|month|year
router.get('/weight', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const timeframe = ((req.query.timeframe as string) || 'month').toLowerCase();

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const now = new Date();
    let startDate = new Date();

    if (timeframe === 'day') {
      startDate.setDate(now.getDate() - 1);
    } else if (timeframe === 'week') {
      startDate.setDate(now.getDate() - 7);
    } else if (timeframe === 'year') {
      startDate.setFullYear(now.getFullYear() - 1);
    } else {
      startDate.setDate(now.getDate() - 30);
    }

    const logs = await prisma.biometricsLog.findMany({
      where: {
        userId,
        recordedAt: { gte: startDate }
      },
      orderBy: { recordedAt: 'asc' }
    });

    if (logs.length === 0) {
      return res.json({
        timeframe,
        dateRangeFormatted: `${startDate.toLocaleDateString()} – ${now.toLocaleDateString()}`,
        averageWeightKg: null,
        bmi: null,
        bmiCategory: null,
        deltaKg: null,
        goalWeightKg: user.goalWeightKg ?? null,
        remainingToGoalKg: null,
        history: []
      });
    }

    const averageWeight = Number((logs.reduce((acc, l) => acc + l.weightKg, 0) / logs.length).toFixed(1));
    const bmi = calculateBmi(averageWeight, user.heightCm);
    const bmiCategory = getBmiCategory(bmi);
    const goalWeightKg = user.goalWeightKg ?? null;
    const remainingToGoalKg = goalWeightKg !== null ? Number((averageWeight - goalWeightKg).toFixed(1)) : null;

    // deltaKg is difference between oldest and newest in timeframe
    const deltaKg = logs.length >= 2
      ? Number((logs[logs.length - 1].weightKg - logs[0].weightKg).toFixed(1))
      : null;

    const dateRangeFormatted = `${startDate.toLocaleDateString()} – ${now.toLocaleDateString()}`;

    return res.json({
      timeframe,
      dateRangeFormatted,
      averageWeightKg: averageWeight,
      bmi,
      bmiCategory,
      deltaKg,
      goalWeightKg,
      remainingToGoalKg,
      history: logs.map(l => ({
        id: l.id,
        date: l.recordedAt.toISOString().split('T')[0],
        recordedAt: l.recordedAt.toISOString(),
        weightKg: l.weightKg,
        bmi: l.bmi,
        isFasting: l.isFasting
      }))
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// PATCH /api/v1/analytics/weight/goal
router.patch('/weight/goal', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { goalWeightKg } = req.body;

    if (!goalWeightKg || isNaN(Number(goalWeightKg))) {
      return res.status(400).json({ error: 'Valid goalWeightKg is required' });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { goalWeightKg: Number(goalWeightKg) }
    });

    return res.json({
      status: 'success',
      goalWeightKg: updated.goalWeightKg,
      message: 'Weight goal updated successfully'
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// DELETE /api/v1/analytics/weight/logs
router.delete('/weight/logs', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { logIds } = req.body;

    if (!Array.isArray(logIds) || logIds.length === 0) {
      return res.status(400).json({ error: 'logIds array is required' });
    }

    const deleted = await prisma.biometricsLog.deleteMany({
      where: {
        userId,
        id: { in: logIds }
      }
    });

    // If latest log deleted, update user.weightKg to new latest or null
    const latest = await prisma.biometricsLog.findFirst({
      where: { userId },
      orderBy: { recordedAt: 'desc' }
    });

    await prisma.user.update({
      where: { id: userId },
      data: { weightKg: latest ? latest.weightKg : null }
    });

    return res.json({
      status: 'success',
      deletedCount: deleted.count,
      message: `Successfully deleted ${deleted.count} weight logs`
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/analytics/weight/export
router.get('/weight/export', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const logs = await prisma.biometricsLog.findMany({
      where: { userId },
      orderBy: { recordedAt: 'asc' }
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="nocturne_weight_logs.csv"');

    let csv = 'ID,Date,Weight(kg),Height(cm),BMI,Fasting,Notes\n';
    logs.forEach(l => {
      csv += `"${l.id}","${l.recordedAt.toISOString()}","${l.weightKg}","${l.heightCm ?? ''}","${l.bmi ?? ''}","${l.isFasting}","${l.notes || ''}"\n`;
    });

    return res.send(csv);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
