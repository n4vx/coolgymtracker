"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type ExerciseMode = "weight" | "bodyweight" | "time";

interface ExerciseTemplate {
  id: string;
  name: string;
  subtitle?: string;
  defaultSets: string;
  icon: string;
  mode?: ExerciseMode;
  bodyweight?: boolean;
}

interface WorkoutTemplate {
  id: string;
  name: string;
  icon: string;
  exercises: ExerciseTemplate[];
}

interface UserInfo {
  id: string;
  firstName: string;
  username: string;
  templates: WorkoutTemplate[];
}

const MODE_LABELS: Record<ExerciseMode, string> = {
  weight: "🏋️ Weight",
  bodyweight: "🏃 Bodyweight",
  time: "⏱ Time",
};

const MODES: ExerciseMode[] = ["weight", "bodyweight", "time"];

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

function getMode(ex: ExerciseTemplate): ExerciseMode {
  if (ex.mode) return ex.mode;
  if (ex.bodyweight) return "bodyweight";
  return "weight";
}

export default function WorkoutsAdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    readJson<{ users?: UserInfo[] }>("/api/admin?action=users")
      .then((data) => {
        const usersList = data.users || [];
        setUsers(usersList);
        if (usersList.length > 0) {
          setSelectedUser(usersList[0].id);
          setTemplates(usersList[0].templates || []);
        }
        setError(null);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load workout templates.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  function selectUser(uid: string) {
    const user = users.find((u) => u.id === uid);
    setSelectedUser(uid);
    setTemplates(user?.templates || []);
    setDirty(false);
  }

  async function save() {
    if (!selectedUser) return;
    setSaving(true);
    try {
      await readJson("/api/admin", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: selectedUser, templates }),
      });
      setDirty(false);
      setError(null);
      setUsers(users.map((u) => u.id === selectedUser ? { ...u, templates } : u));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save workout templates.");
    } finally {
      setSaving(false);
    }
  }

  function updateExercise(tmplIdx: number, exIdx: number, field: string, value: string) {
    const updated = [...templates];
    const ex = { ...updated[tmplIdx].exercises[exIdx], [field]: value };
    updated[tmplIdx] = {
      ...updated[tmplIdx],
      exercises: updated[tmplIdx].exercises.map((e, i) => i === exIdx ? ex : e),
    };
    setTemplates(updated);
    setDirty(true);
  }

  function cycleMode(tmplIdx: number, exIdx: number) {
    const ex = templates[tmplIdx].exercises[exIdx];
    const current = getMode(ex);
    const nextIdx = (MODES.indexOf(current) + 1) % MODES.length;
    updateExercise(tmplIdx, exIdx, "mode", MODES[nextIdx]);
  }

  function removeExercise(tmplIdx: number, exIdx: number) {
    const updated = [...templates];
    updated[tmplIdx] = {
      ...updated[tmplIdx],
      exercises: updated[tmplIdx].exercises.filter((_, i) => i !== exIdx),
    };
    setTemplates(updated);
    setDirty(true);
  }

  function addExercise(tmplIdx: number) {
    const updated = [...templates];
    const id = "ex-" + Date.now().toString(36);
    updated[tmplIdx] = {
      ...updated[tmplIdx],
      exercises: [
        ...updated[tmplIdx].exercises,
        { id, name: "New Exercise", icon: "💪", defaultSets: "3 × 10", mode: "weight" as ExerciseMode },
      ],
    };
    setTemplates(updated);
    setDirty(true);
  }

  function addTemplate() {
    const id = "tmpl-" + Date.now().toString(36);
    setTemplates([...templates, { id, name: "New Workout", icon: "💪", exercises: [] }]);
    setDirty(true);
  }

  function removeTemplate(tmplIdx: number) {
    setTemplates(templates.filter((_, i) => i !== tmplIdx));
    setDirty(true);
  }

  function updateTemplate(tmplIdx: number, field: string, value: string) {
    const updated = templates.map((t, i) => i === tmplIdx ? { ...t, [field]: value } : t);
    setTemplates(updated);
    setDirty(true);
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh] text-muted">Loading...</div>;
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/")} className="text-2xl p-1">←</button>
          <h1 className="text-xl font-bold">📝 Workout Templates</h1>
        </div>
        <div className="rounded-xl border border-card-border bg-card p-6">
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
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/")} className="text-2xl p-1">←</button>
        <h1 className="text-xl font-bold">📝 Workout Templates</h1>
        {dirty && (
          <button
            onClick={save}
            disabled={saving}
            className="ml-auto px-4 py-2 rounded-lg bg-emerald text-white text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        )}
      </div>

      {/* User selector */}
      {users.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {users.map((u) => (
            <button
              key={u.id}
              onClick={() => selectUser(u.id)}
              className={`px-3 py-1.5 rounded-lg text-sm ${
                selectedUser === u.id
                  ? "bg-emerald text-white"
                  : "bg-card border border-card-border text-muted"
              }`}
            >
              {u.firstName || u.username || u.id}
            </button>
          ))}
        </div>
      )}

      {/* Templates */}
      {templates.map((tmpl, tmplIdx) => (
        <div key={tmpl.id} className="bg-card border border-card-border rounded-xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <input
              value={tmpl.icon}
              onChange={(e) => updateTemplate(tmplIdx, "icon", e.target.value)}
              className="w-12 text-center text-2xl bg-transparent border border-card-border rounded-lg p-1"
            />
            <input
              value={tmpl.name}
              onChange={(e) => updateTemplate(tmplIdx, "name", e.target.value)}
              className="flex-1 px-3 py-2 bg-transparent border border-card-border rounded-lg text-lg font-semibold"
            />
            <button
              onClick={() => removeTemplate(tmplIdx)}
              className="text-red text-sm px-2 py-1 hover:bg-red/10 rounded"
            >
              🗑
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {tmpl.exercises.map((ex, exIdx) => (
              <div
                key={ex.id}
                className="grid grid-cols-[2.5rem_1fr_1fr_6rem_5rem_2rem] gap-2 items-center"
              >
                <input
                  value={ex.icon}
                  onChange={(e) => updateExercise(tmplIdx, exIdx, "icon", e.target.value)}
                  className="w-10 text-center bg-transparent border border-card-border rounded p-1"
                />
                <input
                  value={ex.name}
                  onChange={(e) => updateExercise(tmplIdx, exIdx, "name", e.target.value)}
                  placeholder="Name"
                  className="px-2 py-1.5 bg-transparent border border-card-border rounded text-sm"
                />
                <input
                  value={ex.subtitle || ""}
                  onChange={(e) => updateExercise(tmplIdx, exIdx, "subtitle", e.target.value)}
                  placeholder="Subtitle"
                  className="px-2 py-1.5 bg-transparent border border-card-border rounded text-sm text-muted"
                />
                <input
                  value={ex.defaultSets}
                  onChange={(e) => updateExercise(tmplIdx, exIdx, "defaultSets", e.target.value)}
                  placeholder="Sets"
                  className="px-2 py-1.5 bg-transparent border border-card-border rounded text-sm text-center"
                />
                <button
                  onClick={() => cycleMode(tmplIdx, exIdx)}
                  className="px-2 py-1.5 bg-card-border rounded text-xs text-center hover:bg-emerald/20"
                >
                  {MODE_LABELS[getMode(ex)]}
                </button>
                <button
                  onClick={() => removeExercise(tmplIdx, exIdx)}
                  className="text-red text-sm hover:bg-red/10 rounded p-1"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={() => addExercise(tmplIdx)}
            className="mt-3 w-full py-2 border border-dashed border-card-border rounded-lg text-muted text-sm hover:border-emerald/50 hover:text-emerald"
          >
            + Add Exercise
          </button>
        </div>
      ))}

      <button
        onClick={addTemplate}
        className="w-full py-3 border-2 border-dashed border-card-border rounded-xl text-muted hover:border-emerald/50 hover:text-emerald"
      >
        + Add Workout Type
      </button>
    </div>
  );
}
