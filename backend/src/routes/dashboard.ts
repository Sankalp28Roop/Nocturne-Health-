import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';

const router = Router();

router.get('/summary', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const dateStr = (req.query.date as string) || new Date().toISOString().split('T')[0];

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        cardioCalibration: true,
        biometricsLogs: {
          orderBy: { recordedAt: 'desc' },
          take: 1
        },
        sleepRecords: {
          where: { date: dateStr }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const latestBiometrics = user.biometricsLogs[0] || null;
    const todaySleep = user.sleepRecords[0] || null;

    // Format sleep hours if real sleep record exists
    let sleepHoursFormatted: string | null = null;
    if (todaySleep && todaySleep.durationMinutes > 0) {
      const hours = Math.floor(todaySleep.durationMinutes / 60);
      const mins = todaySleep.durationMinutes % 60;
      sleepHoursFormatted = `${hours}h ${mins}m`;
    }

    // Workouts for the requested date
    const dayStart = new Date(`${dateStr}T00:00:00.000Z`);
    const dayEnd = new Date(`${dateStr}T23:59:59.999Z`);

    const todayWorkouts = await prisma.workoutSession.findMany({
      where: {
        userId,
        status: 'completed',
        startedAt: {
          gte: dayStart,
          lte: dayEnd
        }
      }
    });

    const activeMins = todayWorkouts.reduce((acc, s) => acc + Math.round(s.elapsedSeconds / 60), 0);
    const caloriesBurned = todayWorkouts.reduce((acc, s) => acc + s.activeCalories, 0);
    const stepsCurrent = todayWorkouts.reduce((acc, s) => acc + (s.cadenceSpm ? Math.round((s.cadenceSpm * s.elapsedSeconds) / 60) : 0), 0);

    // 7-day routine based strictly on completed workout sessions in DB
    const daysLetter = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const targetDate = new Date(dateStr);
    const dayOfWeek = targetDate.getDay();

    const weekStart = new Date(targetDate);
    weekStart.setDate(targetDate.getDate() - dayOfWeek);
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const weekWorkouts = await prisma.workoutSession.findMany({
      where: {
        userId,
        status: 'completed',
        startedAt: {
          gte: weekStart,
          lte: weekEnd
        }
      }
    });

    const completedDaySet = new Set<number>();
    weekWorkouts.forEach(w => {
      completedDaySet.add(new Date(w.startedAt).getDay());
    });

    const weeklyRoutine = daysLetter.map((letter, idx) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + idx);
      return {
        day: letter,
        date: d.getDate(),
        completed: completedDaySet.has(idx)
      };
    });

    const targetActive = user.goalActiveMinutes || null;
    const targetSteps = user.goalSteps || null;
    const targetCalories = user.goalCalories || null;

    let dailyMilestonePercentage = 0;
    if (targetActive && targetActive > 0) {
      dailyMilestonePercentage = Math.min(100, Math.round((activeMins / targetActive) * 100));
    }

    // Kinetic Score is strictly 0 unless user has real activity or sleep data logged
    let kineticScore = 0;
    if (activeMins > 0 || todaySleep?.sleepScore) {
      const activePart = targetActive ? Math.min(50, Math.round((activeMins / targetActive) * 50)) : Math.min(50, activeMins);
      const sleepPart = todaySleep?.sleepScore ? Math.round(todaySleep.sleepScore * 0.5) : 0;
      kineticScore = activePart + sleepPart;
    }

    return res.json({
      kineticScore,
      dailyMilestonePercentage,
      activeMinutes: {
        current: activeMins,
        target: targetActive
      },
      steps: {
        current: stepsCurrent,
        target: targetSteps,
        aheadDelta: null
      },
      caloriesBurned: {
        current: caloriesBurned,
        target: targetCalories
      },
      weeklyRoutine,
      recentVitals: {
        weightKg: latestBiometrics?.weightKg ?? null,
        sleepHoursFormatted,
        sleepScore: todaySleep?.sleepScore ?? null,
        restingHeartRateBpm: user.cardioCalibration?.restingHr ?? null
      }
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
