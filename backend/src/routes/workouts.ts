import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';

const router = Router();

// GET /api/v1/workouts/config
router.get('/config', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const config = await prisma.workoutConfig.findUnique({
      where: { userId }
    });

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const completedSessions = await prisma.workoutSession.findMany({
      where: {
        userId,
        status: 'completed',
        startedAt: { gte: sevenDaysAgo }
      }
    });

    const totalSeconds = completedSessions.reduce((acc, s) => acc + s.elapsedSeconds, 0);
    const sessionCount = completedSessions.length;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    return res.json({
      weeklyStats: {
        sessionCount,
        totalMinutes: Math.round(totalSeconds / 60),
        formattedDuration: sessionCount > 0 ? `${hours}h ${minutes}m` : '0m'
      },
      selectedActivity: config?.selectedActivity ?? 'running',
      goal: config && config.goalType !== 'open' ? {
        type: config.goalType,
        value: config.goalValue,
        unit: config.goalUnit
      } : null,
      coaching: config ? {
        voiceCoachEnabled: config.voiceCoachEnabled,
        distanceReminderKm: config.distanceReminderKm,
        durationReminderMin: config.durationReminderMin,
        hrZoneAlertThreshold: config.hrZoneAlertThreshold,
        autoPauseEnabled: config.autoPauseEnabled
      } : {
        voiceCoachEnabled: false,
        distanceReminderKm: null,
        durationReminderMin: null,
        hrZoneAlertThreshold: null,
        autoPauseEnabled: false
      }
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// PUT /api/v1/workouts/config
router.put('/config', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const {
      selectedActivity,
      goalType,
      goalValue,
      goalUnit,
      voiceCoachEnabled,
      distanceReminderKm,
      durationReminderMin,
      hrZoneAlertThreshold,
      autoPauseEnabled
    } = req.body;

    if (selectedActivity === 'cycling' && goalType === 'steps') {
      return res.status(400).json({ error: 'Step goals are not applicable to cycling activity' });
    }

    const updated = await prisma.workoutConfig.upsert({
      where: { userId },
      update: {
        selectedActivity: selectedActivity || undefined,
        goalType: goalType || undefined,
        goalValue: goalValue !== undefined && goalValue !== null ? Number(goalValue) : null,
        goalUnit: goalUnit !== undefined ? goalUnit : undefined,
        voiceCoachEnabled: voiceCoachEnabled !== undefined ? Boolean(voiceCoachEnabled) : undefined,
        distanceReminderKm: distanceReminderKm !== undefined && distanceReminderKm !== null ? Number(distanceReminderKm) : null,
        durationReminderMin: durationReminderMin !== undefined && durationReminderMin !== null ? Number(durationReminderMin) : null,
        hrZoneAlertThreshold: hrZoneAlertThreshold !== undefined && hrZoneAlertThreshold !== null ? Number(hrZoneAlertThreshold) : null,
        autoPauseEnabled: autoPauseEnabled !== undefined ? Boolean(autoPauseEnabled) : undefined
      },
      create: {
        userId,
        selectedActivity: selectedActivity || 'running',
        goalType: goalType || 'open',
        goalValue: goalValue ? Number(goalValue) : null,
        goalUnit: goalUnit || null,
        voiceCoachEnabled: Boolean(voiceCoachEnabled),
        distanceReminderKm: distanceReminderKm ? Number(distanceReminderKm) : null,
        durationReminderMin: durationReminderMin ? Number(durationReminderMin) : null,
        hrZoneAlertThreshold: hrZoneAlertThreshold ? Number(hrZoneAlertThreshold) : null,
        autoPauseEnabled: Boolean(autoPauseEnabled)
      }
    });

    return res.json({
      status: 'success',
      config: updated
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/v1/workouts/session/start
router.post('/session/start', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { activityType = 'running', routeName = null } = req.body;

    const session = await prisma.workoutSession.create({
      data: {
        userId,
        activityType,
        routeName,
        status: 'active',
        startedAt: new Date()
      }
    });

    return res.status(201).json({
      status: 'success',
      sessionId: session.id,
      startedAt: session.startedAt,
      activityType: session.activityType,
      countdownSeconds: 3
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// PATCH /api/v1/workouts/session/:sessionId/telemetry
router.patch('/session/:sessionId/telemetry', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sessionId = String(req.params.sessionId);
    const {
      elapsedSeconds,
      distanceMeters,
      currentPaceSecPerKm,
      averagePaceSecPerKm,
      heartRateBpm,
      activeCalories,
      cadenceSpm,
      elevationGainMeters,
      telemetryPoints
    } = req.body;

    const session = await prisma.workoutSession.update({
      where: { id: sessionId },
      data: {
        elapsedSeconds: elapsedSeconds !== undefined ? Number(elapsedSeconds) : undefined,
        distanceMeters: distanceMeters !== undefined ? Number(distanceMeters) : undefined,
        currentPaceSecPerKm: currentPaceSecPerKm !== undefined ? Number(currentPaceSecPerKm) : undefined,
        averagePaceSecPerKm: averagePaceSecPerKm !== undefined ? Number(averagePaceSecPerKm) : undefined,
        heartRateBpm: heartRateBpm !== undefined ? Number(heartRateBpm) : undefined,
        activeCalories: activeCalories !== undefined ? Number(activeCalories) : undefined,
        cadenceSpm: cadenceSpm !== undefined ? Number(cadenceSpm) : undefined,
        elevationGainMeters: elevationGainMeters !== undefined ? Number(elevationGainMeters) : undefined,
        telemetryPointsJson: telemetryPoints ? JSON.stringify(telemetryPoints) : undefined
      }
    });

    return res.json({
      status: 'success',
      sessionId: session.id,
      elapsedSeconds: session.elapsedSeconds,
      distanceKm: Number((session.distanceMeters / 1000).toFixed(2)),
      heartRateBpm: session.heartRateBpm,
      activeCalories: session.activeCalories
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/v1/workouts/session/:sessionId/finish
router.post('/session/:sessionId/finish', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sessionId = String(req.params.sessionId);
    const { action = 'save' } = req.body;

    const session = await prisma.workoutSession.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      return res.status(404).json({ error: 'Workout session not found' });
    }

    if (action === 'discard') {
      await prisma.workoutSession.update({
        where: { id: sessionId },
        data: { status: 'discarded', endedAt: new Date() }
      });
      return res.json({
        status: 'discarded',
        sessionId,
        message: 'Workout session discarded'
      });
    }

    const completed = await prisma.workoutSession.update({
      where: { id: sessionId },
      data: { status: 'completed', endedAt: new Date() }
    });

    // Update real user aggregate metrics
    const sessionHours = completed.elapsedSeconds / 3600;
    await prisma.user.update({
      where: { id: session.userId },
      data: {
        totalWorkouts: { increment: 1 },
        totalActiveHours: { increment: Number(sessionHours.toFixed(2)) },
        streakDays: { increment: 1 }
      }
    });

    // If joined in active challenge, update user's real progress
    const distanceKm = completed.distanceMeters / 1000;
    if (distanceKm > 0) {
      await prisma.userChallengeProgress.updateMany({
        where: {
          userId: session.userId,
          challenge: { activityType: completed.activityType }
        },
        data: {
          completedValue: { increment: Number(distanceKm.toFixed(2)) }
        }
      });
    }

    return res.json({
      status: 'completed',
      sessionId: completed.id,
      summary: {
        activityType: completed.activityType,
        elapsedSeconds: completed.elapsedSeconds,
        distanceKm: Number((completed.distanceMeters / 1000).toFixed(2)),
        activeCalories: completed.activeCalories,
        averagePaceSecPerKm: completed.averagePaceSecPerKm,
        savedToDashboard: true
      }
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// PATCH /api/v1/workouts/session/:sessionId/privacy - Trim route start/end & custom labels
router.patch('/session/:sessionId/privacy', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const sessionId = req.params.sessionId as string;
    const { trimStartMeters, trimEndMeters, customStartLabel, customEndLabel } = req.body;

    const session = await prisma.workoutSession.findFirst({
      where: { id: sessionId, userId }
    });

    if (!session) {
      return res.status(404).json({ error: 'Workout session not found or unauthorized' });
    }

    const updated = await prisma.workoutSession.update({
      where: { id: sessionId },
      data: {
        trimStartMeters: typeof trimStartMeters === 'number' ? Math.max(0, trimStartMeters) : session.trimStartMeters,
        trimEndMeters: typeof trimEndMeters === 'number' ? Math.max(0, trimEndMeters) : session.trimEndMeters,
        customStartLabel: customStartLabel !== undefined ? customStartLabel : session.customStartLabel,
        customEndLabel: customEndLabel !== undefined ? customEndLabel : session.customEndLabel
      }
    });

    return res.json({
      status: 'success',
      privacy: {
        sessionId: updated.id,
        trimStartMeters: updated.trimStartMeters,
        trimEndMeters: updated.trimEndMeters,
        customStartLabel: updated.customStartLabel,
        customEndLabel: updated.customEndLabel
      }
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
