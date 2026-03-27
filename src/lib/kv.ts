import { Redis } from "@upstash/redis";
import { Workout } from "./types";

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

export { redis };

function workoutKey(userId: string, id: string) {
  return `workout:${userId}:${id}`;
}

function indexKey(userId: string) {
  return `workouts:index:${userId}`;
}

export async function saveWorkout(workout: Workout, userId = "default"): Promise<void> {
  await redis.set(workoutKey(userId, workout.id), JSON.stringify(workout));
  await redis.zadd(indexKey(userId), {
    score: new Date(workout.date).getTime(),
    member: workout.id,
  });
}

export async function getWorkout(id: string, userId = "default"): Promise<Workout | null> {
  const data = await redis.get<string>(workoutKey(userId, id));
  if (!data) return null;
  return typeof data === "string" ? JSON.parse(data) : data;
}

export async function getAllWorkouts(userId = "default"): Promise<Workout[]> {
  const ids = await redis.zrange<string[]>(indexKey(userId), 0, -1);
  if (!ids.length) return [];

  const workouts = await Promise.all(
    ids.map((id) => getWorkout(id, userId))
  );
  return workouts.filter((w): w is Workout => w !== null);
}

export async function deleteWorkout(id: string, userId = "default"): Promise<void> {
  await redis.del(workoutKey(userId, id));
  await redis.zrem(indexKey(userId), id);
}
