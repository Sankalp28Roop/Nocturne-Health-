import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';
import { calculateMaxHr, calculateHrZones } from '../utils/calculations.js';

const router = Router();

// GET /api/v1/analytics/cardio?timeframe=day|week|month|6m
router.get('/cardio', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const timeframe = (req.query.timeframe as string) || 'day';

    const cardio = await prisma.cardioCalibration.findUnique({
      where: { userId }
    });

    if (!cardio) {
      return res.json({
        timeframe,
        vo2Max: null,
        vo2MaxTier: null,
        vo2MaxRank: null,
        fitnessAge: null,
        restingHrBpm: null,
        nightlyHrvMs: null,
        trajectory90Days: null,
        lastSessionInZones: null,
        zones: [],
        calibration: null
      });
    }

    const zones = [
      { zone: 1, name: 'Recovery', minBpm: cardio.z1Min, maxBpm: cardio.z1Max, minutesSpent: 0 },
      { zone: 2, name: 'Aerobic Base', minBpm: cardio.z2Min, maxBpm: cardio.z2Max, minutesSpent: 0 },
      { zone: 3, name: 'Tempo', minBpm: cardio.z3Min, maxBpm: cardio.z3Max, minutesSpent: 0 },
      { zone: 4, name: 'Threshold', minBpm: cardio.z4Min, maxBpm: cardio.z4Max, minutesSpent: 0 },
      { zone: 5, name: 'Peak', minBpm: cardio.z5Min, maxBpm: cardio.z5Max, minutesSpent: 0 }
    ];

    return res.json({
      timeframe,
      vo2Max: cardio.vo2Max,
      vo2MaxTier: cardio.vo2MaxTier,
      vo2MaxRank: cardio.vo2MaxRank,
      fitnessAge: cardio.fitnessAge,
      restingHrBpm: cardio.restingHr,
      nightlyHrvMs: cardio.nightlyHrvMs,
      trajectory90Days: null,
      lastSessionInZones: null,
      zones,
      calibration: {
        age: cardio.age,
        restingHr: cardio.restingHr,
        maxHr: cardio.maxHr,
        method: cardio.method
      }
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/v1/analytics/cardio/calibrate
router.post('/cardio/calibrate', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { age, restingHr, method = 'tanaka', customMaxHr } = req.body;
    if (!age || !restingHr) {
      return res.status(400).json({ error: 'age and restingHr are required to calibrate' });
    }

    const computedMaxHr = calculateMaxHr(Number(age), method, customMaxHr ? Number(customMaxHr) : undefined);
    const zones = calculateHrZones(computedMaxHr, Number(restingHr));

    return res.json({
      status: 'success',
      calibration: {
        age: Number(age),
        restingHr: Number(restingHr),
        maxHr: computedMaxHr,
        method
      },
      zones
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// PUT /api/v1/analytics/cardio/zones
router.put('/cardio/zones', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { age, restingHr, method = 'tanaka', customMaxHr, customZones, vo2Max } = req.body;

    if (!age || !restingHr) {
      return res.status(400).json({ error: 'age and restingHr are required' });
    }

    const computedMaxHr = calculateMaxHr(Number(age), method, customMaxHr ? Number(customMaxHr) : undefined);
    const zones = customZones && Array.isArray(customZones) && customZones.length === 5
      ? customZones
      : calculateHrZones(computedMaxHr, Number(restingHr));

    if (zones.length < 5) {
      return res.status(400).json({ error: 'Unable to calculate 5 heart rate zones with given inputs' });
    }

    const updated = await prisma.cardioCalibration.upsert({
      where: { userId },
      update: {
        age: Number(age),
        restingHr: Number(restingHr),
        maxHr: computedMaxHr,
        method,
        vo2Max: vo2Max ? Number(vo2Max) : undefined,
        z1Min: zones[0].minBpm,
        z1Max: zones[0].maxBpm,
        z2Min: zones[1].minBpm,
        z2Max: zones[1].maxBpm,
        z3Min: zones[2].minBpm,
        z3Max: zones[2].maxBpm,
        z4Min: zones[3].minBpm,
        z4Max: zones[3].maxBpm,
        z5Min: zones[4].minBpm,
        z5Max: zones[4].maxBpm
      },
      create: {
        userId,
        age: Number(age),
        restingHr: Number(restingHr),
        maxHr: computedMaxHr,
        method,
        vo2Max: vo2Max ? Number(vo2Max) : null,
        z1Min: zones[0].minBpm,
        z1Max: zones[0].maxBpm,
        z2Min: zones[1].minBpm,
        z2Max: zones[1].maxBpm,
        z3Min: zones[2].minBpm,
        z3Max: zones[2].maxBpm,
        z4Min: zones[3].minBpm,
        z4Max: zones[3].maxBpm,
        z5Min: zones[4].minBpm,
        z5Max: zones[4].maxBpm
      }
    });

    // Also sync age to user profile
    await prisma.user.update({
      where: { id: userId },
      data: { age: Number(age) }
    });

    return res.json({
      status: 'success',
      message: 'Cardio zones saved',
      calibration: {
        age: updated.age,
        restingHr: updated.restingHr,
        maxHr: updated.maxHr,
        method: updated.method
      },
      zones
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
