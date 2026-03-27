"use client";

import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] gap-6">
      <div className="text-center mb-4">
        <div className="text-5xl mb-3">🏋️</div>
        <h1 className="text-3xl font-bold">Gym Tracker</h1>
      </div>

      <div className="w-full flex flex-col gap-4">
        <Link
          href="/workout"
          className="flex items-center justify-center gap-3 w-full py-5 rounded-2xl bg-emerald text-white font-semibold text-xl active:scale-95 transition-transform"
        >
          <span className="text-2xl">💪</span>
          Nouvelle Séance
        </Link>

        <Link
          href="/stats"
          className="flex items-center justify-center gap-3 w-full py-5 rounded-2xl bg-card border border-card-border text-foreground font-semibold text-xl active:scale-95 transition-transform"
        >
          <span className="text-2xl">📊</span>
          Stats
        </Link>
      </div>
    </div>
  );
}
