import { Exercise } from "./types";

export const PUSH_EXERCISES: Exercise[] = [
  {
    id: "squat",
    name: "Squat",
    subtitle: "Barre ou Gobelet",
    defaultSets: "3-4 × 8-10",
    icon: "🦵",
    category: "push",
  },
  {
    id: "dev-couche",
    name: "Développé Couché",
    subtitle: "Haltères ou Barre",
    defaultSets: "3-4 × 8-10",
    icon: "🏋️",
    category: "push",
  },
  {
    id: "dev-couche-incline",
    name: "DC Incliné",
    subtitle: "Haltères ou Barre",
    defaultSets: "3-4 × 8-10",
    icon: "🏋️",
    category: "push",
  },
  {
    id: "dev-militaire",
    name: "Développé Militaire",
    subtitle: "Assis",
    defaultSets: "3 × 10-12",
    icon: "💪",
    category: "push",
  },
  {
    id: "triceps",
    name: "Triceps",
    subtitle: "Poulie ou Barre au front",
    defaultSets: "3 × 12-15",
    icon: "🔱",
    category: "push",
  },
  {
    id: "ventre-push",
    name: "Ventre Plat",
    subtitle: "Planche + Vacuum",
    defaultSets: "3×1min + 3 séries",
    icon: "🧘",
    category: "push",
  },
];

export const PULL_EXERCISES: Exercise[] = [
  {
    id: "fentes-bulgares",
    name: "Fentes Bulgares",
    defaultSets: "3 × 10-12 / jambe",
    icon: "🦿",
    category: "pull",
  },
  {
    id: "tractions",
    name: "Tractions",
    defaultSets: "3-4 × 8-10",
    icon: "🧗",
    category: "pull",
    mode: "bodyweight",
  },
  {
    id: "tirage-vertical",
    name: "Tirage Vertical",
    defaultSets: "3-4 × 8-10",
    icon: "🔽",
    category: "pull",
  },
  {
    id: "epaules-laterales",
    name: "Épaules Latérales",
    defaultSets: "3 × 12-15",
    icon: "🦅",
    category: "pull",
  },
  {
    id: "face-pull",
    name: "Face-Pull",
    defaultSets: "3 × 15",
    icon: "🎯",
    category: "pull",
  },
  {
    id: "biceps-curls",
    name: "Biceps Curls",
    subtitle: "Assis",
    defaultSets: "3 × 12",
    icon: "💪",
    category: "pull",
  },
  {
    id: "ventre-pull",
    name: "Ventre Plat",
    subtitle: "Gainage Latéral + Assault Bike",
    defaultSets: "2×1min + 5-8min HIIT",
    icon: "🔥",
    category: "pull",
  },
];

export function getExercisesByType(type: string): Exercise[] {
  if (type === "push") return PUSH_EXERCISES;
  if (type === "pull") return PULL_EXERCISES;
  return [];
}

export function getExerciseById(id: string): Exercise | undefined {
  return [...PUSH_EXERCISES, ...PULL_EXERCISES].find((e) => e.id === id);
}
