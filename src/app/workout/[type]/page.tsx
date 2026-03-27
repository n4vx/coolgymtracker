"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getExercisesByType } from "@/lib/exercises";
import { Workout, ExerciseLog } from "@/lib/types";
import Link from "next/link";

export default function ExerciseListPage() {
  const params = useParams();
  const router = useRouter();
  const type = params.type as string;
  const exercises = getExercisesByType(type);
  const [workoutId, setWorkoutId] = useState<string | null>(null);
  const [logged, setLogged] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Check if there's already a workout for today of this type
    async function init() {
      const today = new Date().toISOString().split("T")[0];
      const res = await fetch("/api/workouts");
      const workouts: Workout[] = await res.json();
      const existing = workouts.find((w) => w.date === today && w.type === type);

      if (existing) {
        setWorkoutId(existing.id);
        setLogged(new Set(existing.exercises.map((e: ExerciseLog) => e.exerciseId)));
      } else {
        const id = crypto.randomUUID();
        const workout: Workout = {
          id,
          date: today,
          type: type as Workout["type"],
          exercises: [],
          createdAt: new Date().toISOString(),
        };
        await fetch("/api/workouts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(workout),
        });
        setWorkoutId(id);
      }
    }
    init();
  }, [type]);

  const typeLabel = type === "push" ? "Push" : type === "pull" ? "Pull" : "Autre";
  const borderDone =
    type === "push" ? "border-emerald" : type === "pull" ? "border-sky" : "border-orange";
  const textDone =
    type === "push" ? "text-emerald" : type === "pull" ? "text-sky" : "text-orange";

  if (!workoutId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-muted">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/workout")} className="text-2xl p-1">
          ←
        </button>
        <div>
          <h1 className="text-xl font-bold">{typeLabel}</h1>
          <p className="text-muted text-sm">
            {exercises.length} exercices
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {exercises.map((ex) => {
          const done = logged.has(ex.id);
          return (
            <Link
              key={ex.id}
              href={`/workout/exercise/${ex.id}?type=${type}&workoutId=${workoutId}`}
              className={`flex items-center gap-4 p-4 rounded-xl bg-card border transition-all active:scale-[0.98] ${
                done ? borderDone : "border-card-border"
              }`}
            >
              <span className="text-3xl w-12 text-center">{ex.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{ex.name}</div>
                {ex.subtitle && (
                  <div className="text-muted text-sm">{ex.subtitle}</div>
                )}
                <div className="text-muted text-xs mt-0.5">{ex.defaultSets}</div>
              </div>
              {done && (
                <span className={`${textDone} text-xl`}>✓</span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
