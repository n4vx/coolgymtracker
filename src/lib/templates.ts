import { redis } from "./kv";
import { PUSH_EXERCISES, PULL_EXERCISES } from "./exercises";

export interface ExerciseTemplate {
  id: string;
  name: string;
  subtitle?: string;
  defaultSets: string;
  icon: string;
  bodyweight?: boolean;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  icon: string;
  exercises: ExerciseTemplate[];
}

function templatesKey(userId: string) {
  return `templates:${userId}`;
}

export async function getTemplates(userId: string): Promise<WorkoutTemplate[]> {
  const data = await redis.get<string>(templatesKey(userId));
  if (!data) return [];
  return typeof data === "string" ? JSON.parse(data) : data;
}

export async function saveTemplates(userId: string, templates: WorkoutTemplate[]): Promise<void> {
  await redis.set(templatesKey(userId), JSON.stringify(templates));
}

export async function hasTemplates(userId: string): Promise<boolean> {
  const data = await redis.exists(templatesKey(userId));
  return data === 1;
}

export async function initDefaultTemplates(userId: string): Promise<void> {
  const defaults: WorkoutTemplate[] = [
    {
      id: "push",
      name: "Push",
      icon: "🔥",
      exercises: PUSH_EXERCISES.map((e) => ({
        id: e.id,
        name: e.name,
        subtitle: e.subtitle,
        defaultSets: e.defaultSets,
        icon: e.icon,
        bodyweight: e.bodyweight,
      })),
    },
    {
      id: "pull",
      name: "Pull",
      icon: "🧗",
      exercises: PULL_EXERCISES.map((e) => ({
        id: e.id,
        name: e.name,
        subtitle: e.subtitle,
        defaultSets: e.defaultSets,
        icon: e.icon,
        bodyweight: e.bodyweight,
      })),
    },
  ];
  await saveTemplates(userId, defaults);
}

export function getTemplateById(templates: WorkoutTemplate[], id: string): WorkoutTemplate | undefined {
  return templates.find((t) => t.id === id);
}

export function getExerciseFromTemplates(templates: WorkoutTemplate[], exerciseId: string): ExerciseTemplate | undefined {
  for (const tmpl of templates) {
    const ex = tmpl.exercises.find((e) => e.id === exerciseId);
    if (ex) return ex;
  }
  return undefined;
}
