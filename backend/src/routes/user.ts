import { Router, Response } from 'express';
import bcrypt from 'bcrypt';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';

const router = Router();

// GET /api/v1/user/profile
router.get('/profile', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      userId: user.id,
      displayName: user.displayName,
      email: user.email,
      membershipTier: user.membershipTier,
      level: user.level,
      stats: {
        workouts: user.totalWorkouts,
        activeHours: user.totalActiveHours,
        streakDays: user.streakDays
      },
      biometrics: {
        heightCm: user.heightCm ?? null,
        weightKg: user.weightKg ?? null,
        age: user.age ?? null,
        gender: user.gender ?? null
      },
      goals: {
        activeMinutes: user.goalActiveMinutes ?? null,
        steps: user.goalSteps ?? null,
        calories: user.goalCalories ?? null,
        weightKg: user.goalWeightKg ?? null,
        sleepHours: user.targetSleepHours ?? null,
        windDownTime: user.windDownTime ?? null
      },
      units: {
        weight: user.unitWeight,
        height: user.unitHeight,
        distance: user.unitDistance,
        temperature: user.unitTemperature
      },
      integrations: {
        healthConnect: user.healthConnectSync,
        aiHealthContextConsent: user.aiHealthContextConsent,
        lastSyncedAt: user.lastSyncedAt ? user.lastSyncedAt.toISOString() : null
      }
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// PATCH /api/v1/user/profile
router.patch('/profile', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const {
      displayName,
      heightCm,
      weightKg,
      age,
      gender,
      goals,
      units,
      healthConnectSync
    } = req.body;

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        displayName: displayName || undefined,
        heightCm: heightCm !== undefined ? (heightCm ? Number(heightCm) : null) : undefined,
        weightKg: weightKg !== undefined ? (weightKg ? Number(weightKg) : null) : undefined,
        age: age !== undefined ? (age ? Number(age) : null) : undefined,
        gender: gender !== undefined ? gender : undefined,
        goalActiveMinutes: goals?.activeMinutes !== undefined ? (goals.activeMinutes ? Number(goals.activeMinutes) : null) : undefined,
        goalSteps: goals?.steps !== undefined ? (goals.steps ? Number(goals.steps) : null) : undefined,
        goalCalories: goals?.calories !== undefined ? (goals.calories ? Number(goals.calories) : null) : undefined,
        goalWeightKg: goals?.weightKg !== undefined ? (goals.weightKg ? Number(goals.weightKg) : null) : undefined,
        targetSleepHours: goals?.sleepHours !== undefined ? (goals.sleepHours ? Number(goals.sleepHours) : null) : undefined,
        windDownTime: goals?.windDownTime !== undefined ? goals.windDownTime : undefined,
        unitWeight: units?.weight || undefined,
        unitHeight: units?.height || undefined,
        unitDistance: units?.distance || undefined,
        unitTemperature: units?.temperature || undefined,
        healthConnectSync: healthConnectSync !== undefined ? Boolean(healthConnectSync) : undefined,
        aiHealthContextConsent: req.body.aiHealthContextConsent !== undefined ? Boolean(req.body.aiHealthContextConsent) : undefined
      }
    });

    return res.json({
      status: 'success',
      message: 'Profile updated',
      user: {
        id: updated.id,
        displayName: updated.displayName,
        membershipTier: updated.membershipTier,
        level: updated.level
      }
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/v1/user/sync
router.post('/sync', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        lastSyncedAt: new Date(),
        healthConnectSync: true
      }
    });

    return res.json({
      status: 'success',
      lastSyncedAt: updated.lastSyncedAt!.toISOString(),
      healthConnectStatus: 'connected',
      message: 'Synchronized with health hub'
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// DELETE /api/v1/user/account
router.delete('/account', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password is required to delete account' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    // Cascade delete user and all associated health records
    await prisma.user.delete({ where: { id: userId } });

    return res.json({
      status: 'success',
      message: 'Account and all associated biometric data permanently deleted'
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
