import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';

const router = Router();

// GET /api/v1/analytics/sleep?date=YYYY-MM-DD
router.get('/sleep', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const dateStr = (req.query.date as string) || new Date().toISOString().split('T')[0];

    const record = await prisma.sleepRecord.findUnique({
      where: {
        userId_date: {
          userId,
          date: dateStr
        }
      }
    });

    if (!record) {
      return res.json({
        date: dateStr,
        sleepScore: null,
        readinessScore: null,
        readinessMessage: null,
        durationMinutes: 0,
        efficiencyPercentage: null,
        onsetLatencyMinutes: null,
        stages: null,
        hypnogram: [],
        notes: null,
        mood: null
      });
    }

    let hypnogram = [];
    if (record.hypnogramJson) {
      try {
        hypnogram = JSON.parse(record.hypnogramJson);
      } catch {
        hypnogram = [];
      }
    }

    const totalMins = record.durationMinutes;
    return res.json({
      date: record.date,
      sleepScore: record.sleepScore,
      readinessScore: record.readinessScore,
      readinessMessage: record.readinessMessage,
      durationMinutes: record.durationMinutes,
      efficiencyPercentage: record.efficiencyPercentage,
      onsetLatencyMinutes: record.onsetLatencyMinutes,
      stages: totalMins > 0 ? {
        deep: {
          minutes: record.deepMinutes ?? 0,
          percentage: record.deepMinutes ? Math.round((record.deepMinutes / totalMins) * 100) : 0,
          benchmarkDeltaMin: null
        },
        rem: {
          minutes: record.remMinutes ?? 0,
          percentage: record.remMinutes ? Math.round((record.remMinutes / totalMins) * 100) : 0,
          benchmarkDeltaMin: null
        },
        light: {
          minutes: record.lightMinutes ?? 0,
          percentage: record.lightMinutes ? Math.round((record.lightMinutes / totalMins) * 100) : 0,
          benchmarkDeltaMin: null
        },
        awake: {
          minutes: record.awakeMinutes ?? 0,
          percentage: record.awakeMinutes ? Math.round((record.awakeMinutes / totalMins) * 100) : 0,
          benchmarkDeltaMin: null
        }
      } : null,
      hypnogram,
      notes: record.notes,
      mood: record.mood
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/v1/analytics/sleep/note
router.post('/sleep/note', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { date, durationMinutes = 0, notes, mood, sleepScore } = req.body;
    const dateStr = date || new Date().toISOString().split('T')[0];

    const updated = await prisma.sleepRecord.upsert({
      where: {
        userId_date: {
          userId,
          date: dateStr
        }
      },
      update: {
        notes,
        mood,
        ...(durationMinutes ? { durationMinutes: Number(durationMinutes) } : {}),
        ...(sleepScore ? { sleepScore: Number(sleepScore) } : {})
      },
      create: {
        userId,
        date: dateStr,
        durationMinutes: Number(durationMinutes) || 0,
        sleepScore: sleepScore ? Number(sleepScore) : null,
        notes,
        mood
      }
    });

    return res.json({
      status: 'success',
      recordId: updated.id,
      notes: updated.notes,
      mood: updated.mood,
      message: 'Sleep record updated'
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
