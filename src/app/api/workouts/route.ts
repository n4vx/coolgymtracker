import { NextRequest, NextResponse } from "next/server";
import { saveWorkout, getAllWorkouts, getWorkout, deleteWorkout } from "@/lib/kv";
import { Workout } from "@/lib/types";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");

  if (id) {
    const workout = await getWorkout(id);
    if (!workout) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(workout);
  }

  const workouts = await getAllWorkouts();
  return NextResponse.json(workouts);
}

export async function POST(request: NextRequest) {
  const workout: Workout = await request.json();
  await saveWorkout(workout);
  return NextResponse.json({ ok: true });
}

export async function PUT(request: NextRequest) {
  const workout: Workout = await request.json();
  await saveWorkout(workout);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const { id } = await request.json();
  await deleteWorkout(id);
  return NextResponse.json({ ok: true });
}
