
export interface Exercise {
  id: string;
  category: string;
  name: string;
  sets: number;
  defaultReps: string;
  unit: string;
  target?: string;
  description: string;
}

export interface Plan {
  id: string;
  name: string;
  exercises: Exercise[];
}

export interface WorkoutSetLog {
  weight: string;
  reps: string;
  completed: boolean;
}

export interface WorkoutMetrics {
  volume?: number;
  duration?: number;
  weight?: string;
  rpe?: number | string;
  note?: string;
  activeCalories?: string;
  avgHeartRate?: string;
}

export interface HistoryItemType {
  date: string;
  timestamp: number;
  type: 'workout' | 'rest' | 'lazy';
  planName?: string;
  logs?: Record<string, WorkoutSetLog[]>;
  metrics?: WorkoutMetrics;
  note?: string;
}

export interface BodyStat {
  date: string;
  weight: string;
  bodyFat?: string;
  timestamp: number;
}

export interface ExerciseHistoryRecord {
  weight: string;
  date: string;
}

export interface ChartDataPoint {
  date: string;
  value: number;
  timestamp?: number;
  x?: number;
  y?: number;
}

export interface RewardRecord {
  date: string;
  count: number;
  timestamp: number;
}