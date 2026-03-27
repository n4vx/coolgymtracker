"use client";

import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback, Suspense } from "react";
import { getExerciseById } from "@/lib/exercises";
import { Workout, SetEntry } from "@/lib/types";

function ExerciseContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const exerciseId = params.id as string;
  const type = searchParams.get("type") || "push";
  const workoutId = searchParams.get("workoutId") || "";

  const exercise = getExerciseById(exerciseId);
  const [sets, setSets] = useState<SetEntry[]>([{ reps: 0, weight: 0 }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      if (!workoutId) return;
      const res = await fetch(`/api/workouts?id=${workoutId}`);
      if (!res.ok) return;
      const workout: Workout = await res.json();
      const log = workout.exercises.find((e) => e.exerciseId === exerciseId);
      if (log && log.sets.length > 0) {
        setSets(log.sets);
      }
    }
    load();
  }, [workoutId, exerciseId]);

  const save = useCallback(
    async (updatedSets: SetEntry[]) => {
      if (!workoutId || saving) return;
      setSaving(true);

      const res = await fetch(`/api/workouts?id=${workoutId}`);
      if (!res.ok) { setSaving(false); return; }
      const workout: Workout = await res.json();

      const filtered = updatedSets.filter((s) => s.reps > 0 || s.weight > 0);
      const otherExercises = workout.exercises.filter(
        (e) => e.exerciseId !== exerciseId
      );

      workout.exercises = [
        ...otherExercises,
        ...(filtered.length > 0
          ? [{ exerciseId, sets: filtered }]
          : []),
      ];

      await fetch("/api/workouts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(workout),
      });
      setSaving(false);
    },
    [workoutId, exerciseId, saving]
  );

  function updateSet(index: number, field: keyof SetEntry, value: string) {
    const num = value === "" ? 0 : parseInt(value, 10);
    if (isNaN(num)) return;
    const updated = sets.map((s, i) =>
      i === index ? { ...s, [field]: num } : s
    );
    setSets(updated);
  }

  function addSet() {
    const lastSet = sets[sets.length - 1];
    setSets([...sets, { reps: lastSet?.reps || 0, weight: lastSet?.weight || 0 }]);
  }

  function removeSet(index: number) {
    if (sets.length <= 1) return;
    const updated = sets.filter((_, i) => i !== index);
    setSets(updated);
    save(updated);
  }

  function handleBlur() {
    save(sets);
  }

  if (!exercise) {
    return <div className="text-muted p-4">Exercice introuvable</div>;
  }

  const addBtnClass =
    type === "push"
      ? "border-emerald/40 text-emerald"
      : type === "pull"
      ? "border-sky/40 text-sky"
      : "border-orange/40 text-orange";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            save(sets).then(() => router.push(`/workout/${type}`));
          }}
          className="text-2xl p-1"
        >
          ←
        </button>
        <div>
          <h1 className="text-xl font-bold">{exercise.name}</h1>
          {exercise.subtitle && (
            <p className="text-muted text-sm">{exercise.subtitle}</p>
          )}
        </div>
      </div>

      <div className="text-muted text-sm">
        Objectif : {exercise.defaultSets}
      </div>

      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-[2rem_1fr_auto_1fr_2rem] gap-2 items-center text-muted text-xs px-1">
          <span>#</span>
          <span className="text-center">Reps</span>
          <span></span>
          <span className="text-center">Kg</span>
          <span></span>
        </div>

        {sets.map((set, i) => (
          <div
            key={i}
            className="grid grid-cols-[2rem_1fr_auto_1fr_2rem] gap-2 items-center"
          >
            <span className="text-muted text-sm text-center">{i + 1}</span>
            <input
              type="number"
              inputMode="numeric"
              value={set.reps || ""}
              onChange={(e) => updateSet(i, "reps", e.target.value)}
              onBlur={handleBlur}
              placeholder="0"
              className="w-full px-3 py-3 rounded-lg bg-card border border-card-border text-center text-lg focus:outline-none focus:ring-2 focus:ring-emerald"
            />
            <span className="text-muted font-bold">×</span>
            <input
              type="number"
              inputMode="decimal"
              value={set.weight || ""}
              onChange={(e) => updateSet(i, "weight", e.target.value)}
              onBlur={handleBlur}
              placeholder="0"
              className="w-full px-3 py-3 rounded-lg bg-card border border-card-border text-center text-lg focus:outline-none focus:ring-2 focus:ring-emerald"
            />
            <button
              onClick={() => removeSet(i)}
              className="text-muted text-lg hover:text-red"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={addSet}
        className={`w-full py-3 rounded-xl border-2 border-dashed ${addBtnClass} font-medium active:scale-95 transition-transform`}
      >
        + Ajouter une série
      </button>

      {saving && (
        <div className="text-muted text-xs text-center">Sauvegarde...</div>
      )}
    </div>
  );
}

export default function ExercisePage() {
  return (
    <Suspense fallback={<div className="text-muted p-4">Chargement...</div>}>
      <ExerciseContent />
    </Suspense>
  );
}
