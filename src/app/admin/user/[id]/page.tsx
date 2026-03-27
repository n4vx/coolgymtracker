"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

interface SetEntry { reps: number; weight: number; }
interface ExerciseLog { exerciseId: string; sets: SetEntry[]; }
interface Workout {
  id: string;
  date: string;
  type: string;
  exercises: ExerciseLog[];
  createdAt: string;
}

interface Template {
  id: string;
  name: string;
  icon: string;
  exercises: { id: string; name: string; icon: string; defaultSets: string; bodyweight?: boolean }[];
}

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/admin?action=user_workouts&uid=${userId}`).then((r) => r.json()),
      fetch(`/api/admin?action=get_key&key=templates:${userId}`).then((r) => r.json()),
      fetch(`/api/admin?action=get_key&key=settings:${userId}`).then((r) => r.json()),
    ]).then(([wData, tData, sData]) => {
      setWorkouts(wData.workouts || []);
      const tVal = tData.value;
      setTemplates(tVal ? (typeof tVal === "string" ? JSON.parse(tVal) : tVal) : []);
      const sVal = sData.value;
      setSettings(sVal ? (typeof sVal === "string" ? JSON.parse(sVal) : sVal) : null);
      setLoading(false);
    });
  }, [userId]);

  function getExerciseName(exerciseId: string): string {
    for (const tmpl of templates) {
      const ex = tmpl.exercises.find((e) => e.id === exerciseId);
      if (ex) return `${ex.icon} ${ex.name}`;
    }
    return exerciseId;
  }

  function getTemplateName(type: string): string {
    const tmpl = templates.find((t) => t.id === type);
    return tmpl ? `${tmpl.icon} ${tmpl.name}` : type;
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh] text-muted">Loading...</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/")} className="text-2xl p-1">←</button>
        <div>
          <h1 className="text-xl font-bold">👤 User {userId}</h1>
          <div className="text-muted text-sm flex gap-3">
            <span>{settings ? (settings.lang === "fr" ? "🇫🇷 FR" : "🇬🇧 EN") : "—"}</span>
            <span>{templates.length} workout type{templates.length !== 1 ? "s" : ""}</span>
            <span>{workouts.length} session{workouts.length !== 1 ? "s" : ""}</span>
          </div>
        </div>
      </div>

      {/* Templates */}
      <div>
        <h2 className="text-lg font-semibold mb-3">📝 Workout Templates</h2>
        <div className="flex flex-col gap-3">
          {templates.map((tmpl) => (
            <div key={tmpl.id} className="bg-card border border-card-border rounded-xl p-4">
              <div className="font-semibold mb-2">{tmpl.icon} {tmpl.name}</div>
              <div className="flex flex-col gap-1">
                {tmpl.exercises.map((ex) => (
                  <div key={ex.id} className="text-sm text-muted flex items-center gap-2">
                    <span>{ex.icon}</span>
                    <span>{ex.name}</span>
                    {ex.bodyweight && <span className="text-xs bg-sky/20 text-sky px-1.5 rounded">BW</span>}
                    <span className="text-xs text-muted ml-auto">{ex.defaultSets}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Workouts */}
      <div>
        <h2 className="text-lg font-semibold mb-3">🏋️ Workout History ({workouts.length})</h2>
        <div className="flex flex-col gap-3">
          {workouts.slice(0, 20).map((w) => (
            <div key={w.id} className="bg-card border border-card-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold">{getTemplateName(w.type)}</span>
                <span className="text-muted text-sm">{w.date}</span>
              </div>
              {w.exercises.length === 0 ? (
                <div className="text-muted text-sm italic">No exercises logged</div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {w.exercises.map((log) => (
                    <div key={log.exerciseId} className="text-sm">
                      <span className="text-muted">{getExerciseName(log.exerciseId)}:</span>{" "}
                      <span>
                        {log.sets
                          .map((s) => (s.weight === 0 ? `${s.reps}` : `${s.reps}×${s.weight}kg`))
                          .join(" · ")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {workouts.length === 0 && (
            <div className="text-muted text-center py-4">No workouts yet</div>
          )}
        </div>
      </div>
    </div>
  );
}
