"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface UserInfo {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  createdAt: string | null;
  lang: string;
  templateCount: number;
  workoutCount: number;
  templates: { id: string; name: string; icon: string; exercises: { id: string; name: string }[] }[];
}

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof data?.error === "string" ? data.error : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data as T;
}

export default function AdminDashboard() {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [keys, setKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"users" | "keys">("users");

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      readJson<{ users?: UserInfo[] }>("/api/admin?action=users"),
      readJson<{ keys?: string[] }>("/api/admin?action=keys"),
    ])
      .then(([usersData, keysData]) => {
        if (cancelled) return;
        setUsers(usersData.users || []);
        setKeys(keysData.keys || []);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load the admin dashboard.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-muted">
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="max-w-lg rounded-xl border border-card-border bg-card p-6 text-center">
          <h1 className="text-xl font-semibold mb-2">Admin dashboard unavailable</h1>
          <p className="text-sm text-muted">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg bg-emerald px-4 py-2 text-sm font-medium text-white"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">🏋️ Cool Workout Bot</h1>
          <p className="text-muted text-sm">Admin Dashboard</p>
        </div>
        <div className="flex gap-2 text-sm">
          <span className="px-3 py-1 rounded-lg bg-emerald/20 text-emerald">
            {users.length} user{users.length !== 1 ? "s" : ""}
          </span>
          <span className="px-3 py-1 rounded-lg bg-sky/20 text-sky">
            {keys.length} keys
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-card-border pb-2">
        <button
          onClick={() => setTab("users")}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            tab === "users" ? "bg-emerald text-white" : "text-muted hover:text-foreground"
          }`}
        >
          👥 Users
        </button>
        <Link
          href="/admin/workouts"
          className="px-4 py-2 rounded-lg text-sm font-medium text-muted hover:text-foreground"
        >
          📝 Workouts
        </Link>
        <button
          onClick={() => setTab("keys")}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            tab === "keys" ? "bg-emerald text-white" : "text-muted hover:text-foreground"
          }`}
        >
          🗄️ Database Keys
        </button>
      </div>

      {tab === "users" && (
        <div className="flex flex-col gap-4">
          {users.map((user) => (
            <Link
              key={user.id}
              href={`/admin/user/${user.id}`}
              className="bg-card border border-card-border rounded-xl p-5 hover:border-emerald/50 transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">👤</span>
                  <div>
                    <div className="font-semibold">
                      {user.firstName || user.username || `User ${user.id}`}
                      {user.lastName ? ` ${user.lastName}` : ""}
                    </div>
                    <div className="text-muted text-xs flex gap-2">
                      {user.username && <span>@{user.username}</span>}
                      <span>{user.lang === "fr" ? "🇫🇷" : "🇬🇧"}</span>
                      {user.createdAt && <span>Joined {new Date(user.createdAt).toLocaleDateString()}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 text-sm">
                  <span className="text-muted">
                    {user.templateCount} workout{user.templateCount !== 1 ? "s" : ""}
                  </span>
                  <span className="text-muted">
                    {user.workoutCount} session{user.workoutCount !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {user.templates.map((tmpl) => (
                  <span
                    key={tmpl.id}
                    className="px-2 py-1 rounded-md bg-card-border text-xs"
                  >
                    {tmpl.icon} {tmpl.name} ({tmpl.exercises.length})
                  </span>
                ))}
              </div>
            </Link>
          ))}
          {users.length === 0 && (
            <div className="text-muted text-center py-8">No users yet</div>
          )}
        </div>
      )}

      {tab === "keys" && (
        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          <div className="max-h-[60vh] overflow-y-auto">
            {keys.map((key) => (
              <div
                key={key}
                className="flex items-center justify-between px-4 py-2.5 border-b border-card-border last:border-0 hover:bg-card-border/30 text-sm font-mono"
              >
                <span className="truncate">{key}</span>
                <KeyType keyName={key} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function KeyType({ keyName }: { keyName: string }) {
  let color = "text-muted";
  let label = "other";

  if (keyName.startsWith("workout:")) { color = "text-emerald"; label = "workout"; }
  else if (keyName.startsWith("workouts:index")) { color = "text-sky"; label = "index"; }
  else if (keyName.startsWith("templates:")) { color = "text-orange"; label = "template"; }
  else if (keyName.startsWith("settings:")) { color = "text-sky"; label = "settings"; }
  else if (keyName.startsWith("botstate:")) { color = "text-muted"; label = "state"; }

  return <span className={`text-xs ${color}`}>{label}</span>;
}
