import { describe, it, expect } from 'vitest';
import {
  calculateBmi,
  getBmiCategory,
  calculateMaxHr,
  calculateHrZones
} from '../src/utils/calculations.js';

describe('Biometrics & BMI Calculations', () => {
  it('correctly calculates BMI for standard values', () => {
    // 69.0 kg, 178 cm -> 69 / (1.78 * 1.78) = 21.78
    const bmi = calculateBmi(69.0, 178.0);
    expect(bmi).toBe(21.78);
  });

  it('correctly categorizes BMI ranges', () => {
    expect(getBmiCategory(17.5)).toBe('Underweight');
    expect(getBmiCategory(21.8)).toBe('Normal');
    expect(getBmiCategory(26.4)).toBe('Overweight');
    expect(getBmiCategory(31.2)).toBe('Obese');
  });
});

describe('Heart Rate & Zones Calibration (Tanaka / Gulati / Custom)', () => {
  it('calculates Tanaka formula: 208 - (0.7 * age)', () => {
    // For age 28: 208 - (0.7 * 28) = 208 - 19.6 = 188.4 -> 188
    const maxHr = calculateMaxHr(28, 'tanaka');
    expect(maxHr).toBe(188);
  });

  it('calculates Gulati formula: 206 - (0.88 * age)', () => {
    // For age 28: 206 - (0.88 * 28) = 206 - 24.64 = 181.36 -> 181
    const maxHr = calculateMaxHr(28, 'gulati');
    expect(maxHr).toBe(181);
  });

  it('respects custom Max HR input', () => {
    const maxHr = calculateMaxHr(28, 'custom', 195);
    expect(maxHr).toBe(195);
  });

  it('computes 5 discrete HR zone thresholds without overlap', () => {
    const zones = calculateHrZones(192, 54);
    expect(zones.length).toBe(5);

    // Verify progression: Zone 1 < Zone 2 < Zone 3 < Zone 4 < Zone 5
    expect(zones[0].name).toBe('Recovery');
    expect(zones[1].name).toBe('Aerobic Base');
    expect(zones[2].name).toBe('Tempo');
    expect(zones[3].name).toBe('Threshold');
    expect(zones[4].name).toBe('Peak');

    expect(zones[0].minBpm).toBeLessThan(zones[0].maxBpm);
    expect(zones[1].minBpm).toBe(zones[0].maxBpm + 1);
    expect(zones[2].minBpm).toBe(zones[1].maxBpm + 1);
    expect(zones[3].minBpm).toBe(zones[2].maxBpm + 1);
    expect(zones[4].minBpm).toBe(zones[3].maxBpm + 1);
    expect(zones[4].maxBpm).toBe(192);
  });
});
