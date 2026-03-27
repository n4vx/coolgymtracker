import { Redis } from "@upstash/redis";
import { Workout } from "./types";

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const WORKOUT_PREFIX = "workout:";
const WORKOUTS_INDEX = "workouts:index";

export async function saveWorkout(workout: Workout): Promise<void> {
  await redis.set(`${WORKOUT_PREFIX}${workout.id}`, JSON.stringify(workout));
  await redis.zadd(WORKOUTS_INDEX, {
    score: new Date(workout.date).getTime(),
    member: workout.id,
  });
}

export async function getWorkout(id: string): Promise<Workout | null> {
  const data = await redis.get<string>(`${WORKOUT_PREFIX}${id}`);
  if (!data) return null;
  return typeof data === "string" ? JSON.parse(data) : data;
}

export async function getAllWorkouts(): Promise<Workout[]> {
  const ids = await redis.zrange<string[]>(WORKOUTS_INDEX, 0, -1);
  if (!ids.length) return [];

  const workouts = await Promise.all(
    ids.map((id) => getWorkout(id))
  );
  return workouts.filter((w): w is Workout => w !== null);
}

export async function deleteWorkout(id: string): Promise<void> {
  await redis.del(`${WORKOUT_PREFIX}${id}`);
  await redis.zrem(WORKOUTS_INDEX, id);
}
