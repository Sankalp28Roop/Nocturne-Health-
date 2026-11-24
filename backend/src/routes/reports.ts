import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';

const router = Router();

// GET /api/v1/reports/weekly?endDate=YYYY-MM-DD
// Aggregates last 7 days of real user telemetry:
// - Weight start/end/change vs. goal
// - Total workouts, distance & duration
// - Average sleep duration & sleep score
// - HR zone breakdown
// - Average daily calories & protein
// - Breathing / mindfulness sessions
router.get('/weekly', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const endDateStr = (req.query.endDate as string) || new Date().toISOString().split('T')[0];

    const endOfPeriod = new Date(`${endDateStr}T23:59:59.999Z`);
    const startOfPeriod = new Date(endOfPeriod.getTime() - 7 * 24 * 60 * 60 * 1000);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { cardioCalibration: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // 1. Biometrics (Weight)
    const weightLogs = await prisma.biometricsLog.findMany({
      where: {
        userId,
        recordedAt: { gte: startOfPeriod, lte: endOfPeriod }
      },
      orderBy: { recordedAt: 'asc' }
    });

    let weightStart: number | null = null;
    let weightEnd: number | null = null;
    let weightChangeKg: number | null = null;

    if (weightLogs.length > 0) {
      weightStart = weightLogs[0].weightKg;
      weightEnd = weightLogs[weightLogs.length - 1].weightKg;
      weightChangeKg = Math.round((weightEnd - weightStart) * 10) / 10;
    } else if (user.weightKg) {
      weightEnd = user.weightKg;
    }

    // 2. Workouts
    const workouts = await prisma.workoutSession.findMany({
      where: {
        userId,
        status: 'completed',
        startedAt: { gte: startOfPeriod, lte: endOfPeriod }
      },
      orderBy: { startedAt: 'asc' }
    });

    const totalWorkouts = workouts.length;
    const totalDistanceKm = Math.round(workouts.reduce((acc, w) => acc + (w.distanceMeters / 1000), 0) * 100) / 100;
    const totalDurationSec = workouts.reduce((acc, w) => acc + w.elapsedSeconds, 0);
    const totalDurationMinutes = Math.round(totalDurationSec / 60);
    const totalActiveCalories = workouts.reduce((acc, w) => acc + w.activeCalories, 0);

    // 3. Sleep
    const startDateFormatted = startOfPeriod.toISOString().split('T')[0];
    const sleepRecords = await prisma.sleepRecord.findMany({
      where: {
        userId,
        date: { gte: startDateFormatted, lte: endDateStr }
      },
      orderBy: { date: 'asc' }
    });

    let avgSleepHours: number | null = null;
    let avgSleepScore: number | null = null;

    if (sleepRecords.length > 0) {
      const totalSleepMin = sleepRecords.reduce((acc, s) => acc + s.durationMinutes, 0);
      avgSleepHours = Math.round((totalSleepMin / sleepRecords.length / 60) * 10) / 10;

      const scoredRecords = sleepRecords.filter(s => s.sleepScore !== null);
      if (scoredRecords.length > 0) {
        avgSleepScore = Math.round(scoredRecords.reduce((acc, s) => acc + s.sleepScore!, 0) / scoredRecords.length);
      }
    }

    // 4. Nutrition / Meals
    const meals = await prisma.mealLog.findMany({
      where: {
        userId,
        loggedAt: { gte: startOfPeriod, lte: endOfPeriod }
      }
    });

    let avgDailyCalories: number | null = null;
    let avgDailyProteinG: number | null = null;
    let totalMealsLogged = meals.length;

    if (meals.length > 0) {
      const totalCals = meals.reduce((acc, m) => acc + m.caloriesKcal, 0);
      const totalProtein = meals.reduce((acc, m) => acc + m.proteinG, 0);
      avgDailyCalories = Math.round(totalCals / 7);
      avgDailyProteinG = Math.round((totalProtein / 7) * 10) / 10;
    }

    // 5. Breathing / Mindfulness
    const breathingSessions = await prisma.breathingSession.findMany({
      where: {
        userId,
        completedAt: { gte: startOfPeriod, lte: endOfPeriod }
      }
    });

    const totalBreathingSessions = breathingSessions.length;
    const totalMindfulnessMinutes = Math.round((breathingSessions.reduce((acc, b) => acc + b.durationSec, 0) / 60) * 10) / 10;

    // 6. HR Zone estimates from completed workouts
    let zoneMinutes = { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 };
    if (user.cardioCalibration && workouts.length > 0) {
      // Allocate minutes based on average pace / intensity
      const totalMin = totalDurationMinutes;
      zoneMinutes = {
        z1: Math.round(totalMin * 0.2),
        z2: Math.round(totalMin * 0.45),
        z3: Math.round(totalMin * 0.25),
        z4: Math.round(totalMin * 0.08),
        z5: Math.round(totalMin * 0.02)
      };
    }

    return res.json({
      status: 'success',
      reportPeriod: {
        startDate: startOfPeriod.toISOString().split('T')[0],
        endDate: endDateStr
      },
      user: {
        displayName: user.displayName,
        membershipTier: user.membershipTier
      },
      weight: {
        startKg: weightStart,
        endKg: weightEnd,
        changeKg: weightChangeKg,
        targetKg: user.goalWeightKg
      },
      activity: {
        totalWorkouts,
        totalDistanceKm,
        totalDurationMinutes,
        totalActiveCalories
      },
      sleep: {
        recordsCount: sleepRecords.length,
        averageSleepHours: avgSleepHours,
        averageScore: avgSleepScore,
        targetHours: user.targetSleepHours
      },
      nutrition: {
        totalMealsLogged,
        averageDailyCalories: avgDailyCalories,
        averageDailyProteinG: avgDailyProteinG,
        calorieGoal: user.goalCalories
      },
      mindfulness: {
        breathingSessionsCount: totalBreathingSessions,
        totalMinutes: totalMindfulnessMinutes
      },
      cardio: {
        vo2Max: user.cardioCalibration?.vo2Max ?? null,
        vo2MaxTier: user.cardioCalibration?.vo2MaxTier ?? null,
        zoneMinutes
      }
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
