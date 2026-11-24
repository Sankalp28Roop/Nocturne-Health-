import { describe, it, expect } from 'vitest';

// Utility logic for route privacy trimming & weekly aggregation
export function trimTelemetryCoordinates(
  coords: Array<{ lat: number; lng: number; distMeters: number }>,
  trimStartMeters: number,
  trimEndMeters: number
) {
  if (!coords || coords.length === 0) return [];
  const totalDist = coords[coords.length - 1].distMeters;
  const startThreshold = trimStartMeters;
  const endThreshold = Math.max(0, totalDist - trimEndMeters);

  return coords.filter(c => c.distMeters >= startThreshold && c.distMeters <= endThreshold);
}

export function aggregateWeeklyMetrics(params: {
  weightLogs: Array<{ weightKg: number; recordedAt: string }>;
  workouts: Array<{ distanceMeters: number; elapsedSeconds: number; activeCalories: number }>;
  sleepRecords: Array<{ durationMinutes: number; sleepScore: number | null }>;
  meals: Array<{ caloriesKcal: number; proteinG: number }>;
  breathingSessions: Array<{ durationSec: number }>;
}) {
  const { weightLogs, workouts, sleepRecords, meals, breathingSessions } = params;

  // Weight Change
  let weightStart: number | null = null;
  let weightEnd: number | null = null;
  let weightChangeKg: number | null = null;

  if (weightLogs.length > 0) {
    weightStart = weightLogs[0].weightKg;
    weightEnd = weightLogs[weightLogs.length - 1].weightKg;
    weightChangeKg = Math.round((weightEnd - weightStart) * 10) / 10;
  }

  // Workouts
  const totalWorkouts = workouts.length;
  const totalDistanceKm = Math.round(workouts.reduce((sum, w) => sum + w.distanceMeters / 1000, 0) * 100) / 100;
  const totalDurationMinutes = Math.round(workouts.reduce((sum, w) => sum + w.elapsedSeconds, 0) / 60);

  // Sleep
  let avgSleepHours: number | null = null;
  let avgSleepScore: number | null = null;
  if (sleepRecords.length > 0) {
    avgSleepHours = Math.round((sleepRecords.reduce((sum, s) => sum + s.durationMinutes, 0) / sleepRecords.length / 60) * 10) / 10;
    const scored = sleepRecords.filter(s => s.sleepScore !== null);
    if (scored.length > 0) {
      avgSleepScore = Math.round(scored.reduce((sum, s) => sum + s.sleepScore!, 0) / scored.length);
    }
  }

  // Nutrition
  let avgDailyCalories: number | null = null;
  let avgDailyProteinG: number | null = null;
  if (meals.length > 0) {
    avgDailyCalories = Math.round(meals.reduce((sum, m) => sum + m.caloriesKcal, 0) / 7);
    avgDailyProteinG = Math.round((meals.reduce((sum, m) => sum + m.proteinG, 0) / 7) * 10) / 10;
  }

  // Mindfulness
  const totalBreathingMinutes = Math.round((breathingSessions.reduce((sum, b) => sum + b.durationSec, 0) / 60) * 10) / 10;

  return {
    weight: { startKg: weightStart, endKg: weightEnd, changeKg: weightChangeKg },
    activity: { totalWorkouts, totalDistanceKm, totalDurationMinutes },
    sleep: { averageSleepHours: avgSleepHours, averageScore: avgSleepScore },
    nutrition: { averageDailyCalories: avgDailyCalories, averageDailyProteinG: avgDailyProteinG },
    mindfulness: { breathingSessionsCount: breathingSessions.length, totalMinutes: totalBreathingMinutes }
  };
}

describe('Workout Route Privacy & Trimming', () => {
  const sampleCoords = [
    { lat: 12.9716, lng: 77.5946, distMeters: 0 },
    { lat: 12.9720, lng: 77.5950, distMeters: 200 },
    { lat: 12.9730, lng: 77.5960, distMeters: 500 },
    { lat: 12.9750, lng: 77.5980, distMeters: 1000 },
    { lat: 12.9780, lng: 77.6000, distMeters: 2000 },
    { lat: 12.9800, lng: 77.6020, distMeters: 2500 }
  ];

  it('masks sensitive home location at start of route by specified distance', () => {
    // Trim 300 meters from start
    const trimmed = trimTelemetryCoordinates(sampleCoords, 300, 0);
    expect(trimmed.length).toBe(4);
    expect(trimmed[0].distMeters).toBe(500); // 0 and 200m excluded
  });

  it('masks sensitive destination location at end of route by specified distance', () => {
    // Trim 600 meters from end (total 2500m -> cut after 1900m)
    const trimmed = trimTelemetryCoordinates(sampleCoords, 0, 600);
    expect(trimmed.length).toBe(4);
    expect(trimmed[trimmed.length - 1].distMeters).toBe(1000);
  });

  it('masks both start and end simultaneously for full privacy', () => {
    const trimmed = trimTelemetryCoordinates(sampleCoords, 400, 400);
    expect(trimmed.length).toBe(3);
    expect(trimmed[0].distMeters).toBe(500);
    expect(trimmed[trimmed.length - 1].distMeters).toBe(2000);
  });
});

describe('Weekly Health & Fitness Aggregation (Zero Fake Data)', () => {
  it('returns nulls and zeroes when user has no records logged for the week', () => {
    const report = aggregateWeeklyMetrics({
      weightLogs: [],
      workouts: [],
      sleepRecords: [],
      meals: [],
      breathingSessions: []
    });

    expect(report.weight.startKg).toBeNull();
    expect(report.weight.endKg).toBeNull();
    expect(report.weight.changeKg).toBeNull();
    expect(report.activity.totalWorkouts).toBe(0);
    expect(report.activity.totalDistanceKm).toBe(0);
    expect(report.sleep.averageSleepHours).toBeNull();
    expect(report.sleep.averageScore).toBeNull();
    expect(report.nutrition.averageDailyCalories).toBeNull();
    expect(report.mindfulness.breathingSessionsCount).toBe(0);
  });

  it('correctly calculates weekly weight delta and averages when logged', () => {
    const report = aggregateWeeklyMetrics({
      weightLogs: [
        { weightKg: 72.5, recordedAt: '2026-11-18T08:00:00Z' },
        { weightKg: 71.8, recordedAt: '2026-11-24T08:00:00Z' }
      ],
      workouts: [
        { distanceMeters: 5200, elapsedSeconds: 1800, activeCalories: 350 },
        { distanceMeters: 4800, elapsedSeconds: 1650, activeCalories: 310 }
      ],
      sleepRecords: [
        { durationMinutes: 450, sleepScore: 82 },
        { durationMinutes: 480, sleepScore: 86 }
      ],
      meals: [
        { caloriesKcal: 2100, proteinG: 120 },
        { caloriesKcal: 1900, proteinG: 110 }
      ],
      breathingSessions: [
        { durationSec: 120 },
        { durationSec: 120 }
      ]
    });

    expect(report.weight.startKg).toBe(72.5);
    expect(report.weight.endKg).toBe(71.8);
    expect(report.weight.changeKg).toBe(-0.7); // Lost 0.7 kg

    expect(report.activity.totalWorkouts).toBe(2);
    expect(report.activity.totalDistanceKm).toBe(10); // 5.2 + 4.8 km
    expect(report.activity.totalDurationMinutes).toBe(58); // (1800 + 1650) / 60

    expect(report.sleep.averageSleepHours).toBe(7.8); // 465 min / 60
    expect(report.sleep.averageScore).toBe(84);

    expect(report.nutrition.averageDailyCalories).toBe(571); // 4000 / 7
    expect(report.mindfulness.breathingSessionsCount).toBe(2);
    expect(report.mindfulness.totalMinutes).toBe(4);
  });
});
