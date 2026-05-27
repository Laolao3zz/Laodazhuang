import { WorkoutSetLog } from '../types';

/**
 * 1RM 估算 —— Epley 主，Brzycki 备
 *
 * Epley: 1RM = w × (1 + r / 30)
 * Brzycki: 1RM = w × 36 / (37 - r)   适用于 r ≤ 10
 *
 * 实务：
 * - r === 1：直接是 1RM，不估算
 * - r ≤ 10：取 Epley/Brzycki 平均值
 * - r > 10：仅用 Epley（Brzycki 此区间偏离严重）
 */

export function epley(weight: number, reps: number): number {
  if (reps <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

export function brzycki(weight: number, reps: number): number {
  if (reps <= 0 || reps >= 37) return 0;
  return (weight * 36) / (37 - reps);
}

export interface OneRMResult {
  value: number;
  formula: 'direct' | 'epley' | 'brzycki' | 'avg';
  basis: { weight: number; reps: number };
}

/** 单组估算 */
export function estimateSet(weight: number, reps: number): OneRMResult | null {
  if (weight <= 0 || reps <= 0) return null;
  if (reps === 1) {
    return { value: weight, formula: 'direct', basis: { weight, reps } };
  }
  const e = epley(weight, reps);
  if (reps <= 10) {
    const b = brzycki(weight, reps);
    return {
      value: Math.round(((e + b) / 2) * 10) / 10,
      formula: 'avg',
      basis: { weight, reps },
    };
  }
  return {
    value: Math.round(e * 10) / 10,
    formula: 'epley',
    basis: { weight, reps },
  };
}

/** 在一批组里挑出估算值最高的那一组 */
export function bestEstimate(sets: WorkoutSetLog[]): OneRMResult | null {
  let best: OneRMResult | null = null;
  for (const s of sets) {
    if (!s.completed) continue;
    const w = parseFloat(s.weight) || 0;
    const r = parseFloat(s.reps) || 0;
    const r1m = estimateSet(w, r);
    if (r1m && (!best || r1m.value > best.value)) best = r1m;
  }
  return best;
}
