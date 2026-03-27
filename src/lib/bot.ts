import { redis, saveWorkout, getWorkout, getAllWorkouts } from "./kv";
import { getExercisesByType, getExerciseById } from "./exercises";
import { Workout, SetEntry } from "./types";

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
  await redis.set(`botstate:${userId}`, JSON.stringify(state), { ex: 86400 }); // 24h TTL
}

async function clearState(userId: string): Promise<void> {
  await redis.del(`botstate:${userId}`);
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

  // Check for existing workout today of this type
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
    const done = loggedIds.has(ex.id);
    return [{ text: `${done ? "✅" : ex.icon} ${ex.name}`, callback_data: `exercise:${ex.id}` }];
  });

  keyboard.push([{ text: "✅ Terminer la séance", callback_data: "done" }]);

  await editMessage(chatId, messageId, `<b>${typeLabel}</b>\n\nChoisis un exercice :`, keyboard);
}

async function handleExerciseSelection(chatId: number, messageId: number, userId: string, exerciseId: string) {
  const exercise = getExerciseById(exerciseId);
  if (!exercise) return;

  const state = await getState(userId);
  await setState(userId, { ...state, currentExercise: exerciseId });

  // Check if already logged
  let existingSets = "";
  if (state.workoutId) {
    const workout = await getWorkout(state.workoutId, userId);
    const log = workout?.exercises.find((e) => e.exerciseId === exerciseId);
    if (log && log.sets.length > 0) {
      existingSets = `\n\n📝 Déjà enregistré :\n${log.sets.map((s, i) => `  ${i + 1}. ${s.reps}×${s.weight}kg`).join("\n")}\n\nRenvoie pour remplacer.`;
    }
  }

  await editMessage(
    chatId,
    messageId,
    `<b>${exercise.icon} ${exercise.name}</b>${exercise.subtitle ? `\n<i>${exercise.subtitle}</i>` : ""}\nObjectif : ${exercise.defaultSets}${existingSets}\n\n📩 Envoie tes séries :\n<code>8x60, 10x65, 8x65</code>\n(reps × poids en kg)`,
    [[{ text: "← Retour aux exercices", callback_data: "back_to_exercises" }]]
  );
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

  // Build summary
  let summary = `✅ <b>Séance ${workout.type.toUpperCase()} terminée !</b>\n📅 ${workout.date}\n\n`;

  if (workout.exercises.length === 0) {
    summary += "Aucun exercice enregistré.";
  } else {
    for (const log of workout.exercises) {
      const ex = getExerciseById(log.exerciseId);
      summary += `${ex?.icon || "•"} <b>${ex?.name || log.exerciseId}</b>\n`;
      summary += log.sets.map((s, i) => `  ${i + 1}. ${s.reps}×${s.weight}kg`).join("\n");
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

  // Last 30 days
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

  // Show last 5 workouts
  text += `\n<b>Dernières séances :</b>\n`;
  const last5 = workouts.slice(-5).reverse();
  for (const w of last5) {
    const typeEmoji = w.type === "push" ? "🔥" : w.type === "pull" ? "🧗" : "⚡";
    const exerciseCount = w.exercises.length;
    text += `\n${typeEmoji} <b>${w.date}</b> — ${w.type.toUpperCase()} (${exerciseCount} exercice${exerciseCount > 1 ? "s" : ""})`;
  }

  await editMessage(chatId, messageId, text, [
    [{ text: "← Retour", callback_data: "menu" }],
  ]);
}

// --- Set input parsing ---

function parseSets(text: string): SetEntry[] | null {
  const parts = text.split(/[,;]\s*/);
  const sets: SetEntry[] = [];

  for (const part of parts) {
    const match = part.trim().match(/^(\d+)\s*[x×X]\s*(\d+(?:\.\d+)?)$/);
    if (!match) return null;
    sets.push({ reps: parseInt(match[1]), weight: parseFloat(match[2]) });
  }

  return sets.length > 0 ? sets : null;
}

export async function handleTextMessage(chatId: number, userId: string, text: string) {
  if (text === "/start") {
    await handleStart(chatId);
    return;
  }

  const state = await getState(userId);

  if (!state.currentExercise || !state.workoutId) {
    await sendMessage(chatId, "Envoie /start pour commencer.");
    return;
  }

  const sets = parseSets(text);
  if (!sets) {
    await sendMessage(chatId, "❌ Format invalide.\n\nUtilise : <code>8x60, 10x65, 8x65</code>", [
      [{ text: "← Retour aux exercices", callback_data: "back_to_exercises" }],
    ]);
    return;
  }

  // Save sets to workout
  const workout = await getWorkout(state.workoutId, userId);
  if (!workout) {
    await sendMessage(chatId, "Séance introuvable. Envoie /start.");
    await clearState(userId);
    return;
  }

  const otherExercises = workout.exercises.filter((e) => e.exerciseId !== state.currentExercise);
  workout.exercises = [...otherExercises, { exerciseId: state.currentExercise!, sets }];
  await saveWorkout(workout, userId);

  const exercise = getExerciseById(state.currentExercise!);
  const setsText = sets.map((s, i) => `${i + 1}. ${s.reps}×${s.weight}kg`).join("\n");

  await setState(userId, { ...state, currentExercise: undefined });

  await sendMessage(
    chatId,
    `✅ <b>${exercise?.icon} ${exercise?.name}</b>\n${setsText}\n\nEnregistré !`,
    [
      [{ text: "← Retour aux exercices", callback_data: "back_to_exercises" }],
      [{ text: "✅ Terminer la séance", callback_data: "done" }],
    ]
  );
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

  if (data === "back_to_exercises") {
    const state = await getState(userId);
    if (state.workoutId && state.workoutType) {
      const workout = await getWorkout(state.workoutId, userId);
      if (workout) {
        await setState(userId, { ...state, currentExercise: undefined });
        await showExerciseList(chatId, messageId, userId, state.workoutType, workout);
        return;
      }
    }
    await handleStart(chatId);
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
}
