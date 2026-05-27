
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
  // 爬坡专属字段
  incline?: string;   // 坡度 %
  speed?: string;     // 速度 km/h
  distance?: string;  // 距离 km
}

export interface HistoryItemType {
  date: string;
  timestamp: number;
  /** 'cardio' = 独立有氧（仅爬坡）；'workout' = 力量训练；rest/lazy = 休息 */
  type: 'workout' | 'cardio' | 'rest' | 'lazy';
  planName?: string;
  logs?: Record<string, WorkoutSetLog[]>;
  metrics?: WorkoutMetrics;
  note?: string;
  /** 关联的力量训练记录 timestamp（如果有氧是接在力量后面做的） */
  linkedWorkoutTs?: number;
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