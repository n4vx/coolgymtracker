import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

export async function GET(request: NextRequest) {
  const action = request.nextUrl.searchParams.get("action");

  if (action === "keys") {
    let cursor = 0;
    const allKeys: string[] = [];
    do {
      const result = await redis.scan(cursor, { count: 100 });
      cursor = Number(result[0]);
      allKeys.push(...(result[1] as string[]));
    } while (cursor !== 0);
    return NextResponse.json({ keys: allKeys.sort() });
  }

  if (action === "users") {
    let cursor = 0;
    const allKeys: string[] = [];
    do {
      const result = await redis.scan(cursor, { count: 100 });
      cursor = Number(result[0]);
      allKeys.push(...(result[1] as string[]));
    } while (cursor !== 0);

    // Extract unique user IDs
    const userIds = new Set<string>();
    for (const key of allKeys) {
      const match = key.match(/^(?:workouts:index|templates|settings|botstate):(\d+)$/);
      if (match) userIds.add(match[1]);
      const workoutMatch = key.match(/^workout:(\d+):/);
      if (workoutMatch) userIds.add(workoutMatch[1]);
    }

    const users = [];
    for (const uid of userIds) {
      const settingsData = await redis.get<string>(`settings:${uid}`);
      const settings = settingsData ? (typeof settingsData === "string" ? JSON.parse(settingsData) : settingsData) : null;

      const templatesData = await redis.get<string>(`templates:${uid}`);
      const templates = templatesData ? (typeof templatesData === "string" ? JSON.parse(templatesData) : templatesData) : [];

      const workoutIds = await redis.zrange<string[]>(`workouts:index:${uid}`, 0, -1);

      users.push({
        id: uid,
        lang: settings?.lang || "fr",
        templateCount: Array.isArray(templates) ? templates.length : 0,
        workoutCount: workoutIds.length,
        templates: Array.isArray(templates) ? templates : [],
      });
    }

    return NextResponse.json({ users });
  }

  if (action === "user_workouts") {
    const uid = request.nextUrl.searchParams.get("uid");
    if (!uid) return NextResponse.json({ error: "uid required" }, { status: 400 });

    const workoutIds = await redis.zrange<string[]>(`workouts:index:${uid}`, 0, -1);
    const workouts = [];
    for (const id of workoutIds) {
      const data = await redis.get<string>(`workout:${uid}:${id}`);
      if (data) {
        workouts.push(typeof data === "string" ? JSON.parse(data) : data);
      }
    }
    return NextResponse.json({ workouts: workouts.reverse() });
  }

  if (action === "get_key") {
    const key = request.nextUrl.searchParams.get("key");
    if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });
    const value = await redis.get(key);
    return NextResponse.json({ key, value });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function DELETE(request: NextRequest) {
  const { key } = await request.json();
  if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });
  await redis.del(key);
  return NextResponse.json({ ok: true });
}
