"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

const TYPES = [
  { id: "push", label: "Push", subtitle: "Pecs, Épaules, Triceps, Quads", icon: "🔥", color: "bg-emerald" },
  { id: "pull", label: "Pull", subtitle: "Dos, Biceps, Stabilité", icon: "🧗", color: "bg-sky" },
  { id: "other", label: "Autre", subtitle: "Cardio, Mobilité, etc.", icon: "⚡", color: "bg-orange" },
];

export default function WorkoutTypePage() {
  const router = useRouter();
  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/")}
          className="text-2xl p-1"
        >
          ←
        </button>
        <div>
          <h1 className="text-xl font-bold">Nouvelle Séance</h1>
          <p className="text-muted text-sm capitalize">{today}</p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {TYPES.map((t) => (
          <Link
            key={t.id}
            href={`/workout/${t.id}`}
            className={`flex items-center gap-4 p-5 rounded-2xl ${t.color} active:scale-95 transition-transform`}
          >
            <span className="text-3xl">{t.icon}</span>
            <div>
              <div className="text-xl font-bold text-white">{t.label}</div>
              <div className="text-white/70 text-sm">{t.subtitle}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
