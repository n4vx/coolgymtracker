"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Workout } from "@/lib/types";
import { getExerciseById } from "@/lib/exercises";

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1; // Monday = 0
}

export default function StatsPage() {
  const router = useRouter();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  useEffect(() => {
    fetch("/api/workouts")
      .then((r) => r.json())
      .then((data: Workout[]) => {
        setWorkouts(data);
        setLoading(false);
      });
  }, []);

  const workoutsByDate = new Map<string, Workout>();
  workouts.forEach((w) => workoutsByDate.set(w.date, w));

  function prevMonth() {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedWorkout(null);
  }
  function nextMonth() {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedWorkout(null);
  }

  const monthLabel = currentDate.toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });

  function getTypeColor(type: string) {
    if (type === "push") return "bg-emerald";
    if (type === "pull") return "bg-sky";
    return "bg-orange";
  }

  // Count stats
  const thisMonthWorkouts = workouts.filter((w) => {
    const d = new Date(w.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/")} className="text-2xl p-1">
          ←
        </button>
        <h1 className="text-xl font-bold">Stats</h1>
      </div>

      {/* Month stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-card-border rounded-xl p-3 text-center">
          <div className="text-2xl font-bold">{thisMonthWorkouts.length}</div>
          <div className="text-muted text-xs">Séances</div>
        </div>
        <div className="bg-card border border-card-border rounded-xl p-3 text-center">
          <div className="text-2xl font-bold">
            {thisMonthWorkouts.filter((w) => w.type === "push").length}
          </div>
          <div className="text-muted text-xs">Push</div>
        </div>
        <div className="bg-card border border-card-border rounded-xl p-3 text-center">
          <div className="text-2xl font-bold">
            {thisMonthWorkouts.filter((w) => w.type === "pull").length}
          </div>
          <div className="text-muted text-xs">Pull</div>
        </div>
      </div>

      {/* Calendar */}
      <div className="bg-card border border-card-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="text-xl px-2 text-muted">
            ‹
          </button>
          <span className="font-semibold capitalize">{monthLabel}</span>
          <button onClick={nextMonth} className="text-xl px-2 text-muted">
            ›
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted mb-2">
          {DAYS.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const workout = workoutsByDate.get(dateStr);
            const isToday = dateStr === new Date().toISOString().split("T")[0];
            const isSelected = selectedWorkout?.date === dateStr;

            return (
              <button
                key={day}
                onClick={() => workout && setSelectedWorkout(workout)}
                className={`aspect-square flex flex-col items-center justify-center rounded-lg text-sm relative ${
                  isSelected
                    ? "ring-2 ring-foreground"
                    : isToday
                    ? "ring-1 ring-muted"
                    : ""
                }`}
              >
                <span className={workout ? "font-bold" : "text-muted"}>
                  {day}
                </span>
                {workout && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${getTypeColor(workout.type)} absolute bottom-1`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected workout detail */}
      {selectedWorkout && (
        <div className="bg-card border border-card-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span
              className={`w-2 h-2 rounded-full ${getTypeColor(selectedWorkout.type)}`}
            />
            <span className="font-semibold capitalize">
              {selectedWorkout.type}
            </span>
            <span className="text-muted text-sm">
              {new Date(selectedWorkout.date).toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </span>
          </div>
          {selectedWorkout.exercises.length === 0 ? (
            <p className="text-muted text-sm">Aucun exercice enregistré</p>
          ) : (
            <div className="flex flex-col gap-2">
              {selectedWorkout.exercises.map((log) => {
                const ex = getExerciseById(log.exerciseId);
                return (
                  <div key={log.exerciseId} className="flex items-start gap-3">
                    <span className="text-lg">{ex?.icon || "•"}</span>
                    <div>
                      <div className="text-sm font-medium">
                        {ex?.name || log.exerciseId}
                      </div>
                      <div className="text-muted text-xs">
                        {log.sets
                          .map((s) => `${s.reps}×${s.weight}kg`)
                          .join(" · ")}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="text-muted text-sm text-center">Chargement...</div>
      )}
    </div>
  );
}
