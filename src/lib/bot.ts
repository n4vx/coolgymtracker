import { redis, saveWorkout, getWorkout, getAllWorkouts, deleteWorkout } from "./kv";
import { getExercisesByType, getExerciseById, PUSH_EXERCISES, PULL_EXERCISES } from "./exercises";
import { Workout, SetEntry } from "./types";
import { getExerciseProgression, getExerciseMaxReps, renderProgressionChart, renderRepsChart } from "./chart";

const TOKEN = () => process.env.TELEGRAM_BOT_TOKEN!;

// --- Telegram API helpers ---

async function tg(method: string, body: Record<string, unknown>) {
  await fetch(`https://api.telegram.org/bot${TOKEN()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function sendMessage(chatId: number, text: string, keyboard?: unknown[][]) {
  await tg("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    ...(keyboard && {
      reply_markup: { inline_keyboard: keyboard },
    }),
  });
}

async function editMessage(chatId: number, messageId: number, text: string, keyboard?: unknown[][]) {
  await tg("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    ...(keyboard && {
      reply_markup: { inline_keyboard: keyboard },
    }),
  });
}

async function answerCallback(callbackQueryId: string) {
  await tg("answerCallbackQuery", { callback_query_id: callbackQueryId });
}

async function sendPhoto(chatId: number, photo: Buffer, caption: string) {
  const formData = new FormData();
  formData.append("chat_id", String(chatId));
  formData.append("photo", new Blob([new Uint8Array(photo)], { type: "image/png" }), "chart.png");
  formData.append("caption", caption);
  formData.append("parse_mode", "HTML");
  await fetch(`https://api.telegram.org/bot${TOKEN()}/sendPhoto`, {
    method: "POST",
    body: formData,
  });
}

// --- Conversation state ---

interface BotState {
  workoutId?: string;
  workoutType?: string;
  currentExercise?: string;
}

async function getState(userId: string): Promise<BotState> {
  const data = await redis.get<string>(`botstate:${userId}`);
  if (!data) return {};
  return typeof data === "string" ? JSON.parse(data) : data;
}

async function setState(userId: string, state: BotState): Promise<void> {
  await redis.set(`botstate:${userId}`, JSON.stringify(state), { ex: 86400 });
}

async function clearState(userId: string): Promise<void> {
  await redis.del(`botstate:${userId}`);
}

// --- Helpers ---

function formatSets(sets: SetEntry[], bodyweight = false): string {
  return sets.map((s, i) =>
    bodyweight
      ? `  ${i + 1}. ${s.reps} reps`
      : `  ${i + 1}. ${s.reps}×${s.weight}kg`
  ).join("\n");
}

function exerciseView(exerciseId: string, sets: SetEntry[]): { text: string; keyboard: unknown[][] } {
  const exercise = getExerciseById(exerciseId)!;
  const bw = exercise.bodyweight ?? false;
  let text = `<b>${exercise.icon} ${exercise.name}</b>`;
  if (exercise.subtitle) text += `\n<i>${exercise.subtitle}</i>`;
  text += `\nObjectif : ${exercise.defaultSets}`;

  if (sets.length > 0) {
    text += `\n\n📝 Séries :\n${formatSets(sets, bw)}`;
  }

  text += bw
    ? `\n\n📩 Envoie tes reps : <code>8</code> ou <code>8, 10, 12</code>`
    : `\n\n📩 Envoie une série : <code>8x60</code>`;

  const keyboard: unknown[][] = [];

  // Edit/remove buttons for each set
  if (sets.length > 0) {
    const removeButtons = sets.map((_, i) => ({
      text: `🗑 Série ${i + 1}`,
      callback_data: `rmset:${i}`,
    }));
    // Group 3 per row
    for (let i = 0; i < removeButtons.length; i += 3) {
      keyboard.push(removeButtons.slice(i, i + 3));
    }
  }

  keyboard.push([{ text: "✅ Exercice terminé", callback_data: "exercise_done" }]);
  keyboard.push([{ text: "← Retour aux exercices", callback_data: "back_to_exercises" }]);

  return { text, keyboard };
}

// --- Handlers ---

export async function handleStart(chatId: number) {
  await sendMessage(chatId, "🏋️ <b>Gym Tracker</b>\n\nQue veux-tu faire ?", [
    [{ text: "💪 Nouvelle Séance", callback_data: "new_workout" }],
    [{ text: "📊 Stats", callback_data: "stats" }],
  ]);
}

async function handleNewWorkout(chatId: number, messageId: number) {
  await editMessage(chatId, messageId, "🏋️ <b>Choisis ton type de séance :</b>", [
    [{ text: "🔥 Push", callback_data: "type:push" }],
    [{ text: "🧗 Pull", callback_data: "type:pull" }],
    [{ text: "⚡ Autre", callback_data: "type:other" }],
    [{ text: "← Retour", callback_data: "menu" }],
  ]);
}

async function handleTypeSelection(chatId: number, messageId: number, userId: string, type: string) {
  const today = new Date().toISOString().split("T")[0];

  const allWorkouts = await getAllWorkouts(userId);
  let workout = allWorkouts.find((w) => w.date === today && w.type === type);

  if (!workout) {
    workout = {
      id: crypto.randomUUID(),
      date: today,
      type: type as Workout["type"],
      exercises: [],
      createdAt: new Date().toISOString(),
    };
    await saveWorkout(workout, userId);
  }

  await setState(userId, { workoutId: workout.id, workoutType: type });
  await showExerciseList(chatId, messageId, userId, type, workout);
}

async function showExerciseList(chatId: number, messageId: number, userId: string, type: string, workout: Workout) {
  const exercises = getExercisesByType(type);
  const loggedIds = new Set(workout.exercises.map((e) => e.exerciseId));

  const typeLabel = type === "push" ? "Push 🔥" : type === "pull" ? "Pull 🧗" : "Autre ⚡";

  const keyboard = exercises.map((ex) => {
    const log = workout.exercises.find((e) => e.exerciseId === ex.id);
    const done = loggedIds.has(ex.id);
    const setsInfo = log ? ` (${log.sets.length}s)` : "";
    return [{ text: `${done ? "✅" : ex.icon} ${ex.name}${setsInfo}`, callback_data: `exercise:${ex.id}` }];
  });

  keyboard.push([{ text: "✅ Terminer la séance", callback_data: "done" }]);

  // Clear currentExercise when viewing list
  const state = await getState(userId);
  await setState(userId, { ...state, currentExercise: undefined });

  await editMessage(chatId, messageId, `<b>${typeLabel}</b>\n\nChoisis un exercice :`, keyboard);
}

async function handleExerciseSelection(chatId: number, messageId: number, userId: string, exerciseId: string) {
  const exercise = getExerciseById(exerciseId);
  if (!exercise) return;

  const state = await getState(userId);
  await setState(userId, { ...state, currentExercise: exerciseId });

  // Get existing sets
  let sets: SetEntry[] = [];
  if (state.workoutId) {
    const workout = await getWorkout(state.workoutId, userId);
    const log = workout?.exercises.find((e) => e.exerciseId === exerciseId);
    if (log) sets = log.sets;
  }

  const view = exerciseView(exerciseId, sets);
  await editMessage(chatId, messageId, view.text, view.keyboard);
}

async function handleRemoveSet(chatId: number, messageId: number, userId: string, setIndex: number) {
  const state = await getState(userId);
  if (!state.workoutId || !state.currentExercise) return;

  const workout = await getWorkout(state.workoutId, userId);
  if (!workout) return;

  const log = workout.exercises.find((e) => e.exerciseId === state.currentExercise);
  if (!log) return;

  log.sets.splice(setIndex, 1);

  // If no sets left, remove the exercise log entirely
  if (log.sets.length === 0) {
    workout.exercises = workout.exercises.filter((e) => e.exerciseId !== state.currentExercise);
  }

  await saveWorkout(workout, userId);

  const view = exerciseView(state.currentExercise, log.sets.length > 0 ? log.sets : []);
  await editMessage(chatId, messageId, view.text, view.keyboard);
}

async function handleExerciseDone(chatId: number, messageId: number, userId: string) {
  const state = await getState(userId);
  if (!state.workoutId || !state.workoutType) {
    await handleStart(chatId);
    return;
  }

  const workout = await getWorkout(state.workoutId, userId);
  if (!workout) {
    await handleStart(chatId);
    return;
  }

  await showExerciseList(chatId, messageId, userId, state.workoutType, workout);
}

async function handleDone(chatId: number, messageId: number, userId: string) {
  const state = await getState(userId);
  if (!state.workoutId) {
    await editMessage(chatId, messageId, "Aucune séance en cours.");
    return;
  }

  const workout = await getWorkout(state.workoutId, userId);
  if (!workout) {
    await clearState(userId);
    await editMessage(chatId, messageId, "Séance introuvable.");
    return;
  }

  let summary = `✅ <b>Séance ${workout.type.toUpperCase()} terminée !</b>\n📅 ${workout.date}\n\n`;

  if (workout.exercises.length === 0) {
    summary += "Aucun exercice enregistré.";
  } else {
    for (const log of workout.exercises) {
      const ex = getExerciseById(log.exerciseId);
      summary += `${ex?.icon || "•"} <b>${ex?.name || log.exerciseId}</b>\n`;
      summary += formatSets(log.sets, ex?.bodyweight ?? false);
      summary += "\n\n";
    }
  }

  await clearState(userId);
  await editMessage(chatId, messageId, summary, [
    [{ text: "💪 Nouvelle Séance", callback_data: "new_workout" }],
    [{ text: "📊 Stats", callback_data: "stats" }],
  ]);
}

async function handleStats(chatId: number, messageId: number, userId: string) {
  const workouts = await getAllWorkouts(userId);

  if (workouts.length === 0) {
    await editMessage(chatId, messageId, "📊 <b>Stats</b>\n\nAucune séance enregistrée.", [
      [{ text: "← Retour", callback_data: "menu" }],
    ]);
    return;
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recent = workouts.filter((w) => new Date(w.date) >= thirtyDaysAgo);

  const pushCount = recent.filter((w) => w.type === "push").length;
  const pullCount = recent.filter((w) => w.type === "pull").length;
  const otherCount = recent.filter((w) => w.type === "other").length;

  let text = `📊 <b>Stats (30 derniers jours)</b>\n\n`;
  text += `🏋️ Total : <b>${recent.length}</b> séances\n`;
  text += `🔥 Push : <b>${pushCount}</b>\n`;
  text += `🧗 Pull : <b>${pullCount}</b>\n`;
  if (otherCount > 0) text += `⚡ Autre : <b>${otherCount}</b>\n`;

  await editMessage(chatId, messageId, text, [
    [{ text: "📈 Progression par exercice", callback_data: "exo_stats" }],
    [{ text: "📋 Historique de séances", callback_data: "history" }],
    [{ text: "✏️ Éditer les séances", callback_data: "edit_sessions" }],
    [{ text: "← Retour", callback_data: "menu" }],
  ]);
}

async function handleHistory(chatId: number, messageId: number, userId: string) {
  const workouts = await getAllWorkouts(userId);
  const last5 = workouts.slice(-5).reverse();

  if (last5.length === 0) {
    await editMessage(chatId, messageId, "📋 <b>Historique</b>\n\nAucune séance.", [
      [{ text: "← Stats", callback_data: "stats" }],
    ]);
    return;
  }

  let text = "📋 <b>Historique des séances</b>\n";

  for (const w of last5) {
    const typeEmoji = w.type === "push" ? "🔥" : w.type === "pull" ? "🧗" : "⚡";
    text += `\n${typeEmoji} <b>${w.date} — ${w.type.toUpperCase()}</b>\n`;
    if (w.exercises.length === 0) {
      text += "  <i>Aucun exercice</i>\n";
    } else {
      for (const log of w.exercises) {
        const ex = getExerciseById(log.exerciseId);
        const bw = ex?.bodyweight ?? false;
        const setsStr = log.sets
          .map((s) => (bw ? `${s.reps}` : `${s.reps}×${s.weight}kg`))
          .join(" · ");
        text += `  ${ex?.icon || "•"} ${ex?.name || log.exerciseId}: ${setsStr}\n`;
      }
    }
  }

  const keyboard: unknown[][] = last5.map((w) => {
    const typeEmoji = w.type === "push" ? "🔥" : w.type === "pull" ? "🧗" : "⚡";
    return [{ text: `${typeEmoji} ${w.date} — détails`, callback_data: `workout_detail:${w.id}` }];
  });
  keyboard.push([{ text: "← Stats", callback_data: "stats" }]);

  await editMessage(chatId, messageId, text, keyboard);
}

async function handleWorkoutDetail(chatId: number, messageId: number, userId: string, workoutId: string) {
  const workout = await getWorkout(workoutId, userId);
  if (!workout) {
    await editMessage(chatId, messageId, "Séance introuvable.", [
      [{ text: "← Historique", callback_data: "history" }],
    ]);
    return;
  }

  const typeEmoji = workout.type === "push" ? "🔥" : workout.type === "pull" ? "🧗" : "⚡";
  let text = `${typeEmoji} <b>${workout.type.toUpperCase()}</b> — ${workout.date}\n\n`;

  if (workout.exercises.length === 0) {
    text += "<i>Aucun exercice enregistré</i>";
  } else {
    for (const log of workout.exercises) {
      const ex = getExerciseById(log.exerciseId);
      const bw = ex?.bodyweight ?? false;
      text += `${ex?.icon || "•"} <b>${ex?.name || log.exerciseId}</b>\n`;
      text += formatSets(log.sets, bw);
      text += "\n\n";
    }
  }

  await editMessage(chatId, messageId, text, [
    [{ text: "← Historique", callback_data: "history" }],
    [{ text: "← Stats", callback_data: "stats" }],
  ]);
}

async function handleEditSessions(chatId: number, messageId: number, userId: string) {
  const workouts = await getAllWorkouts(userId);
  const last10 = workouts.slice(-10).reverse();

  if (last10.length === 0) {
    await editMessage(chatId, messageId, "✏️ <b>Éditer</b>\n\nAucune séance.", [
      [{ text: "← Stats", callback_data: "stats" }],
    ]);
    return;
  }

  const keyboard: unknown[][] = last10.map((w) => {
    const typeEmoji = w.type === "push" ? "🔥" : w.type === "pull" ? "🧗" : "⚡";
    return [{ text: `🗑 ${w.date} ${typeEmoji} ${w.type.toUpperCase()}`, callback_data: `delconfirm:${w.id}` }];
  });
  keyboard.push([{ text: "← Stats", callback_data: "stats" }]);

  await editMessage(chatId, messageId, "✏️ <b>Éditer les séances</b>\n\nSélectionne une séance à supprimer :", keyboard);
}

// --- Set input parsing ---

function parseSets(text: string, bodyweight = false): SetEntry[] | null {
  const parts = text.split(/[,;]\s*/);
  const sets: SetEntry[] = [];

  for (const part of parts) {
    const trimmed = part.trim();
    if (bodyweight) {
      const match = trimmed.match(/^(\d+)$/);
      if (!match) return null;
      sets.push({ reps: parseInt(match[1]), weight: 0 });
    } else {
      const match = trimmed.match(/^(\d+)\s*[x×X]\s*(\d+(?:\.\d+)?)$/);
      if (!match) return null;
      sets.push({ reps: parseInt(match[1]), weight: parseFloat(match[2]) });
    }
  }

  return sets.length > 0 ? sets : null;
}

export async function handleTextMessage(chatId: number, userId: string, text: string) {
  if (text === "/start") {
    await handleStart(chatId);
    return;
  }

  const state = await getState(userId);

  // If user has an active workout but no exercise selected, they might be typing from exercise list
  if (!state.currentExercise || !state.workoutId) {
    await sendMessage(chatId, "Sélectionne d'abord un exercice, ou envoie /start.");
    return;
  }

  const exercise = getExerciseById(state.currentExercise!);
  const bw = exercise?.bodyweight ?? false;

  const sets = parseSets(text, bw);
  if (!sets) {
    const hint = bw
      ? "Utilise : <code>8</code> ou <code>8, 10, 12</code>"
      : "Utilise : <code>8x60</code> ou <code>8x60, 10x65</code>";
    await sendMessage(chatId, `❌ Format invalide.\n\n${hint}`);
    return;
  }

  // Append sets to existing ones (not replace)
  const workout = await getWorkout(state.workoutId, userId);
  if (!workout) {
    await sendMessage(chatId, "Séance introuvable. Envoie /start.");
    await clearState(userId);
    return;
  }

  const existingLog = workout.exercises.find((e) => e.exerciseId === state.currentExercise);
  const existingSets = existingLog ? existingLog.sets : [];
  const allSets = [...existingSets, ...sets];

  const otherExercises = workout.exercises.filter((e) => e.exerciseId !== state.currentExercise);
  workout.exercises = [...otherExercises, { exerciseId: state.currentExercise!, sets: allSets }];
  await saveWorkout(workout, userId);

  // Show updated exercise view with all sets
  const view = exerciseView(state.currentExercise!, allSets);
  await sendMessage(chatId, view.text, view.keyboard);
}

export async function handleCallbackQuery(
  chatId: number,
  messageId: number,
  userId: string,
  data: string,
  callbackQueryId: string
) {
  await answerCallback(callbackQueryId);

  if (data === "menu") {
    await clearState(userId);
    await editMessage(chatId, messageId, "🏋️ <b>Gym Tracker</b>\n\nQue veux-tu faire ?", [
      [{ text: "💪 Nouvelle Séance", callback_data: "new_workout" }],
      [{ text: "📊 Stats", callback_data: "stats" }],
    ]);
    return;
  }

  if (data === "new_workout") {
    await handleNewWorkout(chatId, messageId);
    return;
  }

  if (data.startsWith("type:")) {
    const type = data.split(":")[1];
    await handleTypeSelection(chatId, messageId, userId, type);
    return;
  }

  if (data.startsWith("exercise:")) {
    const exerciseId = data.split(":")[1];
    await handleExerciseSelection(chatId, messageId, userId, exerciseId);
    return;
  }

  if (data.startsWith("rmset:")) {
    const setIndex = parseInt(data.split(":")[1]);
    await handleRemoveSet(chatId, messageId, userId, setIndex);
    return;
  }

  if (data === "exercise_done") {
    await handleExerciseDone(chatId, messageId, userId);
    return;
  }

  if (data === "back_to_exercises") {
    await handleExerciseDone(chatId, messageId, userId);
    return;
  }

  if (data === "done") {
    await handleDone(chatId, messageId, userId);
    return;
  }

  if (data === "stats") {
    await handleStats(chatId, messageId, userId);
    return;
  }

  if (data === "exo_stats") {
    const allExos = [...PUSH_EXERCISES, ...PULL_EXERCISES];
    const keyboard = allExos.map((ex) => [
      { text: `${ex.icon} ${ex.name}`, callback_data: `exo_chart:${ex.id}` },
    ]);
    keyboard.push([{ text: "← Stats", callback_data: "stats" }]);
    await editMessage(chatId, messageId, "📈 <b>Progression par exercice</b>\n\nChoisis un exercice :", keyboard);
    return;
  }

  if (data.startsWith("exo_chart:")) {
    const exerciseId = data.split(":")[1];
    const exercise = getExerciseById(exerciseId);
    if (!exercise) return;

    const workouts = await getAllWorkouts(userId);
    const isBw = exercise.bodyweight ?? false;

    if (isBw) {
      const points = getExerciseMaxReps(workouts, exerciseId, 2);
      if (points.length < 2) {
        await editMessage(chatId, messageId, `${exercise.icon} <b>${exercise.name}</b>\n\nPas assez de données (min 2 séances).`, [
          [{ text: "← Exercices", callback_data: "exo_stats" }],
        ]);
        return;
      }
      const chart = await renderRepsChart(exerciseId, points);
      const caption = `${exercise.icon} <b>${exercise.name}</b>\nMax reps : ${points[0].maxReps} → ${points[points.length - 1].maxReps}`;
      await sendPhoto(chatId, chart, caption);
    } else {
      const points = getExerciseProgression(workouts, exerciseId, 2);
      if (points.length < 2) {
        await editMessage(chatId, messageId, `${exercise.icon} <b>${exercise.name}</b>\n\nPas assez de données (min 2 séances).`, [
          [{ text: "← Exercices", callback_data: "exo_stats" }],
        ]);
        return;
      }
      const chart = await renderProgressionChart(exerciseId, points);
      const first = points[0].maxWeight;
      const last = points[points.length - 1].maxWeight;
      const diff = last - first;
      const arrow = diff > 0 ? "📈" : diff < 0 ? "📉" : "➡️";
      const caption = `${exercise.icon} <b>${exercise.name}</b>\n${arrow} ${first}kg → ${last}kg (${diff > 0 ? "+" : ""}${diff}kg)`;
      await sendPhoto(chatId, chart, caption);
    }
    // Send navigation buttons as a separate message
    await sendMessage(chatId, "Voir un autre exercice ?", [
      [{ text: "📈 Autre exercice", callback_data: "exo_stats" }],
      [{ text: "📊 Stats", callback_data: "stats" }],
      [{ text: "← Menu", callback_data: "menu" }],
    ]);
    return;
  }

  if (data === "history") {
    await handleHistory(chatId, messageId, userId);
    return;
  }

  if (data.startsWith("workout_detail:")) {
    const workoutId = data.split(":")[1];
    await handleWorkoutDetail(chatId, messageId, userId, workoutId);
    return;
  }

  if (data === "edit_sessions") {
    await handleEditSessions(chatId, messageId, userId);
    return;
  }

  if (data.startsWith("delconfirm:")) {
    const workoutId = data.split(":")[1];
    const workout = await getWorkout(workoutId, userId);
    if (!workout) {
      await handleStats(chatId, messageId, userId);
      return;
    }
    const typeEmoji = workout.type === "push" ? "🔥" : workout.type === "pull" ? "🧗" : "⚡";
    await editMessage(
      chatId,
      messageId,
      `⚠️ Supprimer la séance <b>${typeEmoji} ${workout.type.toUpperCase()}</b> du <b>${workout.date}</b> ?`,
      [
        [{ text: "✅ Oui, supprimer", callback_data: `delworkout:${workoutId}` }],
        [{ text: "← Annuler", callback_data: "edit_sessions" }],
      ]
    );
    return;
  }

  if (data.startsWith("delworkout:")) {
    const workoutId = data.split(":")[1];
    await deleteWorkout(workoutId, userId);
    await editMessage(chatId, messageId, "🗑 Séance supprimée.", [
      [{ text: "✏️ Éditer les séances", callback_data: "edit_sessions" }],
      [{ text: "📊 Stats", callback_data: "stats" }],
    ]);
    return;
  }
}
