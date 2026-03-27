import { Workout } from "./types";

export interface ProgressionPoint {
  date: string;
  maxWeight: number;
}

export function getExerciseProgression(
  workouts: Workout[],
  exerciseId: string,
  months = 2
): ProgressionPoint[] {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);

  const sorted = [...workouts]
    .filter((w) => new Date(w.date) >= cutoff)
    .sort((a, b) => a.date.localeCompare(b.date));

  const points: ProgressionPoint[] = [];
  for (const workout of sorted) {
    const log = workout.exercises.find((e) => e.exerciseId === exerciseId);
    if (!log || log.sets.length === 0) continue;
    const maxWeight = Math.max(...log.sets.map((s) => s.weight));
    points.push({ date: workout.date, maxWeight });
  }
  return points;
}

export function getExerciseMaxReps(
  workouts: Workout[],
  exerciseId: string,
  months = 2
): { date: string; maxReps: number }[] {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);

  const sorted = [...workouts]
    .filter((w) => new Date(w.date) >= cutoff)
    .sort((a, b) => a.date.localeCompare(b.date));

  const points: { date: string; maxReps: number }[] = [];
  for (const workout of sorted) {
    const log = workout.exercises.find((e) => e.exerciseId === exerciseId);
    if (!log || log.sets.length === 0) continue;
    const maxReps = Math.max(...log.sets.map((s) => s.reps));
    points.push({ date: workout.date, maxReps });
  }
  return points;
}

function formatDate(date: string): string {
  const d = new Date(date);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

export async function renderProgressionChart(
  exerciseId: string,
  points: ProgressionPoint[],
  exerciseName?: string
): Promise<Buffer> {
  const config = {
    type: "line",
    data: {
      labels: points.map((p) => formatDate(p.date)),
      datasets: [
        {
          label: "Poids max (kg)",
          data: points.map((p) => p.maxWeight),
          borderColor: "#10b981",
          backgroundColor: "rgba(16,185,129,0.1)",
          borderWidth: 3,
          pointBackgroundColor: "#10b981",
          pointRadius: 6,
          fill: true,
          tension: 0.3,
        },
      ],
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: `${exerciseName || exerciseId} - Progression`,
          color: "#f4f4f5",
          font: { size: 18 },
        },
        legend: { display: false },
      },
      scales: {
        x: { ticks: { color: "#a1a1aa" }, grid: { color: "rgba(161,161,170,0.15)" } },
        y: {
          ticks: { color: "#a1a1aa", callback: (v: number) => v + "kg" },
          grid: { color: "rgba(161,161,170,0.15)" },
        },
      },
    },
  };

  return fetchChart(config);
}

export async function renderRepsChart(
  exerciseId: string,
  points: { date: string; maxReps: number }[],
  exerciseName?: string
): Promise<Buffer> {
  const config = {
    type: "line",
    data: {
      labels: points.map((p) => formatDate(p.date)),
      datasets: [
        {
          label: "Max reps",
          data: points.map((p) => p.maxReps),
          borderColor: "#0ea5e9",
          backgroundColor: "rgba(14,165,233,0.1)",
          borderWidth: 3,
          pointBackgroundColor: "#0ea5e9",
          pointRadius: 6,
          fill: true,
          tension: 0.3,
        },
      ],
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: `${exerciseName || exerciseId} - Progression Reps`,
          color: "#f4f4f5",
          font: { size: 18 },
        },
        legend: { display: false },
      },
      scales: {
        x: { ticks: { color: "#a1a1aa" }, grid: { color: "rgba(161,161,170,0.15)" } },
        y: { ticks: { color: "#a1a1aa" }, grid: { color: "rgba(161,161,170,0.15)" } },
      },
    },
  };

  return fetchChart(config);
}

export function getExerciseMaxDuration(
  workouts: Workout[],
  exerciseId: string,
  months = 2
): { date: string; maxDuration: number }[] {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);

  const sorted = [...workouts]
    .filter((w) => new Date(w.date) >= cutoff)
    .sort((a, b) => a.date.localeCompare(b.date));

  const points: { date: string; maxDuration: number }[] = [];
  for (const workout of sorted) {
    const log = workout.exercises.find((e) => e.exerciseId === exerciseId);
    if (!log || log.sets.length === 0) continue;
    const maxDuration = Math.max(...log.sets.map((s) => s.weight));
    points.push({ date: workout.date, maxDuration });
  }
  return points;
}

export async function renderDurationChart(
  exerciseId: string,
  points: { date: string; maxDuration: number }[],
  exerciseName?: string
): Promise<Buffer> {
  const config = {
    type: "line",
    data: {
      labels: points.map((p) => formatDate(p.date)),
      datasets: [
        {
          label: "Max duration",
          data: points.map((p) => p.maxDuration),
          borderColor: "#f97316",
          backgroundColor: "rgba(249,115,22,0.1)",
          borderWidth: 3,
          pointBackgroundColor: "#f97316",
          pointRadius: 6,
          fill: true,
          tension: 0.3,
        },
      ],
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: `${exerciseName || exerciseId} - Duration`,
          color: "#f4f4f5",
          font: { size: 18 },
        },
        legend: { display: false },
      },
      scales: {
        x: { ticks: { color: "#a1a1aa" }, grid: { color: "rgba(161,161,170,0.15)" } },
        y: {
          ticks: {
            color: "#a1a1aa",
            callback: (v: number) => {
              if (v >= 60) return Math.floor(v / 60) + "min";
              return v + "s";
            },
          },
          grid: { color: "rgba(161,161,170,0.15)" },
        },
      },
    },
  };

  return fetchChart(config);
}

async function fetchChart(config: unknown): Promise<Buffer> {
  const res = await fetch("https://quickchart.io/chart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chart: config,
      width: 800,
      height: 400,
      backgroundColor: "#09090b",
      format: "png",
    }),
  });

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
