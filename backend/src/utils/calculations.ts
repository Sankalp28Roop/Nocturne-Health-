export function calculateBmi(weightKg: number | null | undefined, heightCm: number | null | undefined): number | null {
  if (!weightKg || !heightCm || heightCm <= 0 || weightKg <= 0) {
    return null;
  }
  const heightM = heightCm / 100;
  return Number((weightKg / (heightM * heightM)).toFixed(2));
}

export function getBmiCategory(bmi: number | null | undefined): string | null {
  if (bmi === null || bmi === undefined || isNaN(bmi)) {
    return null;
  }
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 24.9) return 'Normal';
  if (bmi < 29.9) return 'Overweight';
  return 'Obese';
}

export interface ZoneBounds {
  zone: number;
  name: string;
  minBpm: number;
  maxBpm: number;
}

export function calculateMaxHr(age: number, method: 'tanaka' | 'gulati' | 'custom', customMaxHr?: number): number {
  if (method === 'tanaka') {
    return Math.round(208 - 0.7 * age);
  }
  if (method === 'gulati') {
    return Math.round(206 - 0.88 * age);
  }
  return customMaxHr && customMaxHr > 0 ? customMaxHr : Math.round(220 - age);
}

export function calculateHrZones(maxHr: number, restingHr: number): ZoneBounds[] {
  if (!maxHr || !restingHr || maxHr <= restingHr) {
    return [];
  }
  const hrr = Math.max(0, maxHr - restingHr);

  const z1Min = Math.round(restingHr + hrr * 0.50);
  const z1Max = Math.round(restingHr + hrr * 0.60) - 1;

  const z2Min = z1Max + 1;
  const z2Max = Math.round(restingHr + hrr * 0.70) - 1;

  const z3Min = z2Max + 1;
  const z3Max = Math.round(restingHr + hrr * 0.80) - 1;

  const z4Min = z3Max + 1;
  const z4Max = Math.round(restingHr + hrr * 0.90) - 1;

  const z5Min = z4Max + 1;
  const z5Max = maxHr;

  return [
    { zone: 1, name: 'Recovery', minBpm: z1Min, maxBpm: z1Max },
    { zone: 2, name: 'Aerobic Base', minBpm: z2Min, maxBpm: z2Max },
    { zone: 3, name: 'Tempo', minBpm: z3Min, maxBpm: z3Max },
    { zone: 4, name: 'Threshold', minBpm: z4Min, maxBpm: z4Max },
    { zone: 5, name: 'Peak', minBpm: z5Min, maxBpm: z5Max }
  ];
}
