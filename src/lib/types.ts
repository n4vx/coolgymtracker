export type WorkoutType = "push" | "pull" | "other";

export interface SetEntry {
  reps: number;
  weight: number; // kg
}

export interface ExerciseLog {
  exerciseId: string;
  sets: SetEntry[];
}

export interface Workout {
  id: string;
  date: string; // YYYY-MM-DD
  type: WorkoutType;
  exercises: ExerciseLog[];
  createdAt: string; // ISO timestamp
  startedAt?: string; // ISO timestamp
  endedAt?: string; // ISO timestamp
}

export interface Exercise {
  id: string;
  name: string;
  subtitle?: string;
  defaultSets: string;
  icon: string;
  category: WorkoutType;
  mode?: "weight" | "bodyweight" | "time";
}
