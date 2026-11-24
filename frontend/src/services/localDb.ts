/**
 * Nocturne Local-First Embedded Database & Storage Engine
 * Stores user profiles, authentication, biometrics, weight, cardio, sleep,
 * challenges, and workout sessions 100% locally on the device (Capacitor Preferences / localStorage).
 * ZERO cloud or laptop server dependency.
 */

export interface LocalUser {
  id: string;
  email: string;
  passwordHash: string; // Stored securely on device
  displayName: string;
  avatarUrl?: string;
  age?: number;
  gender?: string;
  heightCm?: number;
  weightKg?: number;
  targetWeightKg?: number;
  weeklyGoalKg?: number;
  dailyStepGoal: number;
  dailyCalorieGoal: number;
  dailyActiveMinGoal: number;
  restingHeartRate: number;
  maxHeartRate: number;
  hrvBaselineMs: number;
  vo2MaxEstimate: number;
  aiHealthContextConsent: boolean;
  biometricLockEnabled: boolean;
  createdAt: string;
}

export interface LocalBiometricsLog {
  id: string;
  userId: string;
  weightKg: number;
  heightCm?: number;
  bmi: number;
  bodyFatPercent?: number;
  muscleMassKg?: number;
  recordedAt: string;
}

export interface LocalSleepRecord {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  durationMinutes: number;
  efficiencyScore: number;
  deepSleepMinutes: number;
  remSleepMinutes: number;
  lightSleepMinutes: number;
  awakeMinutes: number;
  notes?: string;
}

export interface LocalWorkoutSession {
  id: string;
  userId: string;
  sportType: string;
  status: 'active' | 'completed' | 'cancelled';
  elapsedSeconds: number;
  distanceKm: number;
  activeCalories: number;
  avgHeartRateBpm?: number;
  maxHeartRateBpm?: number;
  cadenceSpm?: number;
  startedAt: string;
  endedAt?: string;
  routeCoordinates?: any[];
}

export interface LocalAiMessage {
  id: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface LocalChallenge {
  id: string;
  title: string;
  description: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  daysRemaining: number;
  participantsCount: number;
  category: 'steps' | 'calories' | 'distance' | 'workouts';
  joined: boolean;
}

const STORAGE_KEYS = {
  USERS: 'nocturne_local_users',
  ACTIVE_USER_ID: 'nocturne_active_user_id',
  BIOMETRICS: 'nocturne_local_biometrics',
  SLEEP: 'nocturne_local_sleep',
  WORKOUTS: 'nocturne_local_workouts',
  AI_MESSAGES: 'nocturne_local_ai_messages',
  CHALLENGES: 'nocturne_local_challenges',
  HYDRATION: 'nocturne_local_hydration'
};

function readItem<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function writeItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Error saving to key ${key}`, e);
  }
}

// In-Memory & LocalStorage DB Class
class LocalDatabase {
  constructor() {
    this.seedDefaultChallenges();
  }

  private seedDefaultChallenges() {
    const existing = this.getChallenges();
    if (!existing || existing.length === 0) {
      const defaultChallenges: LocalChallenge[] = [
        {
          id: 'chal-1',
          title: '70,000 Steps Weekly Crusher',
          description: 'Reach 10,000 steps every day for 7 consecutive days to maximize cardio efficiency.',
          targetValue: 70000,
          currentValue: 12450,
          unit: 'steps',
          daysRemaining: 4,
          participantsCount: 382,
          category: 'steps',
          joined: true
        },
        {
          id: 'chal-2',
          title: '3,500 Active Calorie Melt',
          description: 'Burn 3,500 active calories through running, cycling, or HIIT sessions.',
          targetValue: 3500,
          currentValue: 1820,
          unit: 'kcal',
          daysRemaining: 6,
          participantsCount: 219,
          category: 'calories',
          joined: true
        },
        {
          id: 'chal-3',
          title: '25 km Trail / Road Running',
          description: 'Log 25 kilometers of outdoor or treadmill running sessions.',
          targetValue: 25,
          currentValue: 8.5,
          unit: 'km',
          daysRemaining: 9,
          participantsCount: 147,
          category: 'distance',
          joined: false
        }
      ];
      writeItem(STORAGE_KEYS.CHALLENGES, defaultChallenges);
    }
  }

  // Users
  getUsers(): LocalUser[] {
    return readItem<LocalUser[]>(STORAGE_KEYS.USERS, []);
  }

  saveUsers(users: LocalUser[]): void {
    writeItem(STORAGE_KEYS.USERS, users);
  }

  getActiveUserId(): string | null {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_USER_ID);
  }

  setActiveUserId(id: string | null): void {
    if (id) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_USER_ID, id);
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_USER_ID);
    }
  }

  getActiveUser(): LocalUser | null {
    const id = this.getActiveUserId();
    if (!id) return null;
    return this.getUsers().find(u => u.id === id) || null;
  }

  // Biometrics
  getBiometrics(userId: string): LocalBiometricsLog[] {
    const all = readItem<LocalBiometricsLog[]>(STORAGE_KEYS.BIOMETRICS, []);
    return all.filter(b => b.userId === userId).sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
  }

  addBiometrics(log: LocalBiometricsLog): void {
    const all = readItem<LocalBiometricsLog[]>(STORAGE_KEYS.BIOMETRICS, []);
    all.push(log);
    writeItem(STORAGE_KEYS.BIOMETRICS, all);
  }

  // Sleep
  getSleepRecords(userId: string): LocalSleepRecord[] {
    const all = readItem<LocalSleepRecord[]>(STORAGE_KEYS.SLEEP, []);
    return all.filter(s => s.userId === userId).sort((a, b) => b.date.localeCompare(a.date));
  }

  saveSleepRecord(record: LocalSleepRecord): void {
    const all = readItem<LocalSleepRecord[]>(STORAGE_KEYS.SLEEP, []);
    const idx = all.findIndex(s => s.userId === record.userId && s.date === record.date);
    if (idx >= 0) {
      all[idx] = record;
    } else {
      all.push(record);
    }
    writeItem(STORAGE_KEYS.SLEEP, all);
  }

  // Workouts
  getWorkouts(userId: string): LocalWorkoutSession[] {
    const all = readItem<LocalWorkoutSession[]>(STORAGE_KEYS.WORKOUTS, []);
    return all.filter(w => w.userId === userId).sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  saveWorkout(workout: LocalWorkoutSession): void {
    const all = readItem<LocalWorkoutSession[]>(STORAGE_KEYS.WORKOUTS, []);
    const idx = all.findIndex(w => w.id === workout.id);
    if (idx >= 0) {
      all[idx] = workout;
    } else {
      all.push(workout);
    }
    writeItem(STORAGE_KEYS.WORKOUTS, all);
  }

  // AI Chat Messages
  getAiMessages(userId: string): LocalAiMessage[] {
    const all = readItem<LocalAiMessage[]>(STORAGE_KEYS.AI_MESSAGES, []);
    return all.filter(m => m.userId === userId).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  addAiMessage(msg: LocalAiMessage): void {
    const all = readItem<LocalAiMessage[]>(STORAGE_KEYS.AI_MESSAGES, []);
    all.push(msg);
    writeItem(STORAGE_KEYS.AI_MESSAGES, all);
  }

  clearAiMessages(userId: string): void {
    const all = readItem<LocalAiMessage[]>(STORAGE_KEYS.AI_MESSAGES, []);
    const filtered = all.filter(m => m.userId !== userId);
    writeItem(STORAGE_KEYS.AI_MESSAGES, filtered);
  }

  // Challenges
  getChallenges(): LocalChallenge[] {
    return readItem<LocalChallenge[]>(STORAGE_KEYS.CHALLENGES, []);
  }

  saveChallenges(challenges: LocalChallenge[]): void {
    writeItem(STORAGE_KEYS.CHALLENGES, challenges);
  }

  // Hydration
  getHydration(userId: string, date: string): number {
    const key = `${STORAGE_KEYS.HYDRATION}_${userId}_${date}`;
    return readItem<number>(key, 0);
  }

  setHydration(userId: string, date: string, ml: number): void {
    const key = `${STORAGE_KEYS.HYDRATION}_${userId}_${date}`;
    writeItem<number>(key, ml);
  }
}

export const localDb = new LocalDatabase();
