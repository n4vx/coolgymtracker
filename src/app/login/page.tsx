"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });

    if (res.ok) {
      router.push("/");
    } else {
      setError("Wrong password");
      setPin("");
    }
    setLoading(false);
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] gap-8">
      <div className="text-center">
        <div className="text-5xl mb-4">🏋️</div>
        <h1 className="text-2xl font-bold">Cool Workout Bot</h1>
        <p className="text-muted text-sm mt-1">Admin Dashboard</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-xs flex flex-col gap-4">
        <input
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="Password"
          autoFocus
          className="w-full px-4 py-3 rounded-xl bg-card border border-card-border text-foreground text-center text-lg focus:outline-none focus:ring-2 focus:ring-emerald"
        />
        {error && <p className="text-red text-sm text-center">{error}</p>}
        <button
          type="submit"
          disabled={!pin || loading}
          className="w-full py-3 rounded-xl bg-emerald text-white font-semibold text-lg disabled:opacity-40 active:scale-95 transition-transform"
        >
          {loading ? "..." : "Login"}
        </button>
      </form>
    </div>
  );
}
