import { redis, saveWorkout, getWorkout, getAllWorkouts, deleteWorkout } from "./kv";
import { Workout, SetEntry } from "./types";
import { getExerciseProgression, getExerciseMaxReps, renderProgressionChart, renderRepsChart } from "./chart";
import { t, Lang } from "./i18n";
import { getTemplates, saveTemplates, hasTemplates, initDefaultTemplates, getTemplateById, getExerciseFromTemplates, WorkoutTemplate, ExerciseTemplate } from "./templates";

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
    ...(keyboard && { reply_markup: { inline_keyboard: keyboard } }),
  });
}

async function editMessage(chatId: number, messageId: number, text: string, keyboard?: unknown[][]) {
  await tg("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    ...(keyboard && { reply_markup: { inline_keyboard: keyboard } }),
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
  await fetch(`https://api.telegram.org/bot${TOKEN()}/sendPhoto`, { method: "POST", body: formData });
}

// --- Conversation state ---

interface BotState {
  workoutId?: string;
  workoutType?: string;
  currentExercise?: string;
  // Template creation state
  creatingTemplate?: string; // template ID being created
  awaitingInput?: "template_name" | "exercise_name" | "exercise_sets";
  pendingExercise?: { name: string; icon: string };
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

// --- User settings ---

interface UserSettings { lang: Lang; }

async function getSettings(userId: string): Promise<UserSettings> {
  const data = await redis.get<string>(`settings:${userId}`);
  if (!data) return { lang: "fr" };
  return typeof data === "string" ? JSON.parse(data) : data;
}

async function saveSettings(userId: string, settings: UserSettings): Promise<void> {
  await redis.set(`settings:${userId}`, JSON.stringify(settings));
}

async function getLang(userId: string): Promise<Lang> {
  return (await getSettings(userId)).lang;
}

// --- Helpers ---

function formatSets(sets: SetEntry[], bodyweight = false): string {
  return sets.map((s, i) =>
    bodyweight ? `  ${i + 1}. ${s.reps} reps` : `  ${i + 1}. ${s.reps}×${s.weight}kg`
  ).join("\n");
}

function exerciseView(exercise: ExerciseTemplate, sets: SetEntry[], l: Lang): { text: string; keyboard: unknown[][] } {
  const bw = exercise.bodyweight ?? false;
  let text = `<b>${exercise.icon} ${exercise.name}</b>`;
  if (exercise.subtitle) text += `\n<i>${exercise.subtitle}</i>`;
  text += `\n${t("target", l)} : ${exercise.defaultSets}`;

  if (sets.length > 0) {
    text += `\n\n📝 ${t("series", l)} :\n${formatSets(sets, bw)}`;
  }

  text += bw
    ? `\n\n${t("send_reps", l)} <code>8</code> ${t("or", l)} <code>8, 10, 12</code>`
    : `\n\n${t("send_set", l)} <code>8x60</code>`;

  const keyboard: unknown[][] = [];
  if (sets.length > 0) {
    const rmBtns = sets.map((_, i) => ({ text: `🗑 ${t("btn_remove_set", l)} ${i + 1}`, callback_data: `rmset:${i}` }));
    for (let i = 0; i < rmBtns.length; i += 3) keyboard.push(rmBtns.slice(i, i + 3));
  }
  keyboard.push([{ text: t("btn_exercise_done", l), callback_data: "exercise_done" }]);
  keyboard.push([{ text: t("btn_back_exercises", l), callback_data: "back_to_exercises" }]);

  return { text, keyboard };
}

// --- Handlers ---

export async function handleStart(chatId: number, userId: string) {
  const has = await hasTemplates(userId);
  if (!has) {
    const l = await getLang(userId);
    await sendMessage(chatId, l === "fr"
      ? "🏋️ <b>Bienvenue sur Gym Tracker !</b>\n\nVeux-tu utiliser les séances par défaut (Push/Pull) ou créer les tiennes ?"
      : "🏋️ <b>Welcome to Gym Tracker!</b>\n\nDo you want to use default workouts (Push/Pull) or create your own?",
      [
        [{ text: l === "fr" ? "✅ Utiliser les défauts" : "✅ Use Defaults", callback_data: "onboard_defaults" }],
        [{ text: l === "fr" ? "✏️ Créer les miennes" : "✏️ Create My Own", callback_data: "onboard_custom" }],
      ]);
    return;
  }
  await showMainMenu(chatId, userId);
}

async function showMainMenu(chatId: number, userId: string, messageId?: number) {
  const l = await getLang(userId);
  const kb = [
    [{ text: t("btn_new_workout", l), callback_data: "new_workout" }],
    [{ text: t("btn_stats", l), callback_data: "stats" }],
    [{ text: t("btn_settings", l), callback_data: "settings" }],
  ];
  if (messageId) {
    await editMessage(chatId, messageId, t("home_title", l), kb);
  } else {
    await sendMessage(chatId, t("home_title", l), kb);
  }
}

async function handleNewWorkout(chatId: number, messageId: number, userId: string) {
  const l = await getLang(userId);
  const templates = await getTemplates(userId);
  const keyboard = templates.map((tmpl) => [
    { text: `${tmpl.icon} ${tmpl.name}`, callback_data: `type:${tmpl.id}` },
  ]);
  keyboard.push([{ text: t("btn_back", l), callback_data: "menu" }]);
  await editMessage(chatId, messageId, t("choose_type", l), keyboard);
}

async function handleTypeSelection(chatId: number, messageId: number, userId: string, templateId: string) {
  const templates = await getTemplates(userId);
  const template = getTemplateById(templates, templateId);
  if (!template) return;

  const today = new Date().toISOString().split("T")[0];
  const allWorkouts = await getAllWorkouts(userId);
  let workout = allWorkouts.find((w) => w.date === today && w.type === templateId);

  if (!workout) {
    workout = {
      id: crypto.randomUUID(),
      date: today,
      type: templateId as Workout["type"],
      exercises: [],
      createdAt: new Date().toISOString(),
    };
    await saveWorkout(workout, userId);
  }

  await setState(userId, { workoutId: workout.id, workoutType: templateId });
  await showExerciseList(chatId, messageId, userId, template, workout);
}

async function showExerciseList(chatId: number, messageId: number, userId: string, template: WorkoutTemplate, workout: Workout) {
  const l = await getLang(userId);
  const loggedIds = new Set(workout.exercises.map((e) => e.exerciseId));

  const keyboard = template.exercises.map((ex) => {
    const log = workout.exercises.find((e) => e.exerciseId === ex.id);
    const done = loggedIds.has(ex.id);
    const setsInfo = log ? ` (${log.sets.length}s)` : "";
    return [{ text: `${done ? "✅" : ex.icon} ${ex.name}${setsInfo}`, callback_data: `exercise:${ex.id}` }];
  });
  keyboard.push([{ text: t("btn_end_workout", l), callback_data: "done" }]);

  const state = await getState(userId);
  await setState(userId, { ...state, currentExercise: undefined });

  await editMessage(chatId, messageId, `<b>${template.icon} ${template.name}</b>\n\n${t("choose_exercise", l)}`, keyboard);
}

async function handleExerciseSelection(chatId: number, messageId: number, userId: string, exerciseId: string) {
  const templates = await getTemplates(userId);
  const exercise = getExerciseFromTemplates(templates, exerciseId);
  if (!exercise) return;

  const l = await getLang(userId);
  const state = await getState(userId);
  await setState(userId, { ...state, currentExercise: exerciseId });

  let sets: SetEntry[] = [];
  if (state.workoutId) {
    const workout = await getWorkout(state.workoutId, userId);
    const log = workout?.exercises.find((e) => e.exerciseId === exerciseId);
    if (log) sets = log.sets;
  }

  const view = exerciseView(exercise, sets, l);
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
  if (log.sets.length === 0) {
    workout.exercises = workout.exercises.filter((e) => e.exerciseId !== state.currentExercise);
  }
  await saveWorkout(workout, userId);

  const l = await getLang(userId);
  const templates = await getTemplates(userId);
  const exercise = getExerciseFromTemplates(templates, state.currentExercise!);
  if (!exercise) return;

  const view = exerciseView(exercise, log.sets.length > 0 ? log.sets : [], l);
  await editMessage(chatId, messageId, view.text, view.keyboard);
}

async function handleExerciseDone(chatId: number, messageId: number, userId: string) {
  const state = await getState(userId);
  if (!state.workoutId || !state.workoutType) { await handleStart(chatId, userId); return; }

  const templates = await getTemplates(userId);
  const template = getTemplateById(templates, state.workoutType);
  const workout = await getWorkout(state.workoutId, userId);
  if (!template || !workout) { await handleStart(chatId, userId); return; }

  await showExerciseList(chatId, messageId, userId, template, workout);
}

async function handleDone(chatId: number, messageId: number, userId: string) {
  const l = await getLang(userId);
  const state = await getState(userId);
  if (!state.workoutId) { await editMessage(chatId, messageId, t("no_active_workout", l)); return; }

  const workout = await getWorkout(state.workoutId, userId);
  if (!workout) { await clearState(userId); await editMessage(chatId, messageId, t("workout_not_found", l)); return; }

  const templates = await getTemplates(userId);
  const template = getTemplateById(templates, workout.type);

  let summary = `✅ <b>${t("workout_done", l)} ${template?.name || workout.type.toUpperCase()} ${t("done_suffix", l)}</b>\n📅 ${workout.date}\n\n`;

  if (workout.exercises.length === 0) {
    summary += t("no_exercises", l);
  } else {
    for (const log of workout.exercises) {
      const ex = getExerciseFromTemplates(templates, log.exerciseId);
      summary += `${ex?.icon || "•"} <b>${ex?.name || log.exerciseId}</b>\n`;
      summary += formatSets(log.sets, ex?.bodyweight ?? false);
      summary += "\n\n";
    }
  }

  await clearState(userId);
  await editMessage(chatId, messageId, summary, [
    [{ text: t("btn_new_workout", l), callback_data: "new_workout" }],
    [{ text: t("btn_stats", l), callback_data: "stats" }],
  ]);
}

async function handleStats(chatId: number, messageId: number, userId: string) {
  const l = await getLang(userId);
  const workouts = await getAllWorkouts(userId);

  if (workouts.length === 0) {
    await editMessage(chatId, messageId, `📊 <b>Stats</b>\n\n${t("no_sessions", l)}`, [
      [{ text: t("btn_back", l), callback_data: "menu" }],
    ]);
    return;
  }

  const templates = await getTemplates(userId);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recent = workouts.filter((w) => new Date(w.date) >= thirtyDaysAgo);

  let text = `📊 <b>${t("stats_title", l)}</b>\n\n`;
  text += `🏋️ ${t("total", l)} : <b>${recent.length}</b> ${t("sessions", l)}\n`;

  // Count per template type
  for (const tmpl of templates) {
    const count = recent.filter((w) => w.type === tmpl.id).length;
    text += `${tmpl.icon} ${tmpl.name} : <b>${count}</b>\n`;
  }

  await editMessage(chatId, messageId, text, [
    [{ text: t("btn_progression", l), callback_data: "exo_stats" }],
    [{ text: t("btn_history", l), callback_data: "history" }],
    [{ text: t("btn_edit_sessions", l), callback_data: "edit_sessions" }],
    [{ text: t("btn_back", l), callback_data: "menu" }],
  ]);
}

async function handleHistory(chatId: number, messageId: number, userId: string) {
  const l = await getLang(userId);
  const workouts = await getAllWorkouts(userId);
  const templates = await getTemplates(userId);
  const last5 = workouts.slice(-5).reverse();

  if (last5.length === 0) {
    await editMessage(chatId, messageId, `📋 <b>${t("history_title", l)}</b>\n\n${t("no_sessions", l)}`, [
      [{ text: `← ${l === "fr" ? "Stats" : "Stats"}`, callback_data: "stats" }],
    ]);
    return;
  }

  let text = `📋 <b>${t("history_title", l)}</b>\n`;
  for (const w of last5) {
    const tmpl = getTemplateById(templates, w.type);
    text += `\n${tmpl?.icon || "•"} <b>${w.date} — ${tmpl?.name || w.type}</b>\n`;
    if (w.exercises.length === 0) {
      text += `  <i>${t("no_exercise_data", l)}</i>\n`;
    } else {
      for (const log of w.exercises) {
        const ex = getExerciseFromTemplates(templates, log.exerciseId);
        const bw = ex?.bodyweight ?? false;
        const setsStr = log.sets.map((s) => (bw ? `${s.reps}` : `${s.reps}×${s.weight}kg`)).join(" · ");
        text += `  ${ex?.icon || "•"} ${ex?.name || log.exerciseId}: ${setsStr}\n`;
      }
    }
  }

  const keyboard: unknown[][] = last5.map((w) => {
    const tmpl = getTemplateById(templates, w.type);
    return [{ text: `${tmpl?.icon || "•"} ${w.date} — ${t("details", l)}`, callback_data: `workout_detail:${w.id}` }];
  });
  keyboard.push([{ text: "← Stats", callback_data: "stats" }]);
  await editMessage(chatId, messageId, text, keyboard);
}

async function handleWorkoutDetail(chatId: number, messageId: number, userId: string, workoutId: string) {
  const l = await getLang(userId);
  const workout = await getWorkout(workoutId, userId);
  if (!workout) {
    await editMessage(chatId, messageId, t("workout_not_found", l), [[{ text: `← ${t("history_title", l)}`, callback_data: "history" }]]);
    return;
  }

  const templates = await getTemplates(userId);
  const tmpl = getTemplateById(templates, workout.type);
  let text = `${tmpl?.icon || "•"} <b>${tmpl?.name || workout.type}</b> — ${workout.date}\n\n`;

  if (workout.exercises.length === 0) {
    text += `<i>${t("no_exercises", l)}</i>`;
  } else {
    for (const log of workout.exercises) {
      const ex = getExerciseFromTemplates(templates, log.exerciseId);
      text += `${ex?.icon || "•"} <b>${ex?.name || log.exerciseId}</b>\n`;
      text += formatSets(log.sets, ex?.bodyweight ?? false);
      text += "\n\n";
    }
  }

  await editMessage(chatId, messageId, text, [
    [{ text: `← ${t("history_title", l)}`, callback_data: "history" }],
    [{ text: "← Stats", callback_data: "stats" }],
  ]);
}

async function handleEditSessions(chatId: number, messageId: number, userId: string) {
  const l = await getLang(userId);
  const workouts = await getAllWorkouts(userId);
  const templates = await getTemplates(userId);
  const last10 = workouts.slice(-10).reverse();

  if (last10.length === 0) {
    await editMessage(chatId, messageId, `✏️ <b>${t("edit_title", l)}</b>\n\n${t("no_sessions", l)}`, [
      [{ text: "← Stats", callback_data: "stats" }],
    ]);
    return;
  }

  const keyboard: unknown[][] = last10.map((w) => {
    const tmpl = getTemplateById(templates, w.type);
    return [{ text: `🗑 ${w.date} ${tmpl?.icon || "•"} ${tmpl?.name || w.type}`, callback_data: `delconfirm:${w.id}` }];
  });
  keyboard.push([{ text: "← Stats", callback_data: "stats" }]);
  await editMessage(chatId, messageId, `✏️ <b>${t("edit_title", l)}</b>\n\n${t("select_delete", l)}`, keyboard);
}

// --- Template management ---

async function showTemplateManager(chatId: number, messageId: number, userId: string) {
  const l = await getLang(userId);
  const templates = await getTemplates(userId);

  let text = l === "fr" ? "📝 <b>Mes Séances</b>\n\n" : "📝 <b>My Workouts</b>\n\n";
  for (const tmpl of templates) {
    text += `${tmpl.icon} <b>${tmpl.name}</b> — ${tmpl.exercises.length} ${l === "fr" ? "exercices" : "exercises"}\n`;
  }

  const keyboard: unknown[][] = templates.map((tmpl) => [
    { text: `${tmpl.icon} ${tmpl.name}`, callback_data: `edit_tmpl:${tmpl.id}` },
  ]);
  keyboard.push([{ text: l === "fr" ? "➕ Nouvelle séance" : "➕ New Workout", callback_data: "new_template" }]);
  keyboard.push([{ text: t("btn_settings", l), callback_data: "settings" }]);

  if (messageId) {
    await editMessage(chatId, messageId, text, keyboard);
  } else {
    await sendMessage(chatId, text, keyboard);
  }
}

async function showTemplateDetail(chatId: number, messageId: number, userId: string, templateId: string) {
  const l = await getLang(userId);
  const templates = await getTemplates(userId);
  const tmpl = getTemplateById(templates, templateId);
  if (!tmpl) return;

  let text = `${tmpl.icon} <b>${tmpl.name}</b>\n\n`;
  if (tmpl.exercises.length === 0) {
    text += l === "fr" ? "<i>Aucun exercice</i>" : "<i>No exercises</i>";
  } else {
    for (const ex of tmpl.exercises) {
      text += `${ex.icon} ${ex.name}${ex.bodyweight ? " 🏃" : ""} — ${ex.defaultSets}\n`;
    }
  }

  const keyboard: unknown[][] = [];
  // Remove buttons per exercise
  for (const ex of tmpl.exercises) {
    keyboard.push([{ text: `🗑 ${ex.name}`, callback_data: `rm_exo:${templateId}:${ex.id}` }]);
  }
  keyboard.push([{ text: l === "fr" ? "➕ Ajouter un exercice" : "➕ Add Exercise", callback_data: `add_exo:${templateId}` }]);
  keyboard.push([{ text: `🗑 ${l === "fr" ? "Supprimer cette séance" : "Delete this workout"}`, callback_data: `del_tmpl:${templateId}` }]);
  keyboard.push([{ text: l === "fr" ? "← Mes Séances" : "← My Workouts", callback_data: "manage_templates" }]);

  await editMessage(chatId, messageId, text, keyboard);
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

// --- Text message handler ---

export async function handleTextMessage(chatId: number, userId: string, text: string) {
  if (text === "/start") {
    await handleStart(chatId, userId);
    return;
  }

  const state = await getState(userId);

  // Template creation: awaiting template name
  if (state.awaitingInput === "template_name") {
    const l = await getLang(userId);
    const name = text.trim();
    if (!name) return;
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 20) + "-" + Date.now().toString(36);
    const templates = await getTemplates(userId);
    templates.push({ id, name, icon: "💪", exercises: [] });
    await saveTemplates(userId, templates);
    await setState(userId, { creatingTemplate: id, awaitingInput: undefined });
    await sendMessage(chatId, l === "fr"
      ? `✅ Séance <b>${name}</b> créée ! Ajoute des exercices.`
      : `✅ Workout <b>${name}</b> created! Add exercises now.`,
      [
        [{ text: l === "fr" ? "➕ Ajouter un exercice" : "➕ Add Exercise", callback_data: `add_exo:${id}` }],
        [{ text: l === "fr" ? "← Mes Séances" : "← My Workouts", callback_data: "manage_templates" }],
      ]);
    return;
  }

  // Template creation: awaiting exercise name
  if (state.awaitingInput === "exercise_name" && state.creatingTemplate) {
    const l = await getLang(userId);
    const name = text.trim();
    if (!name) return;
    await setState(userId, { ...state, awaitingInput: "exercise_sets", pendingExercise: { name, icon: "💪" } });
    await sendMessage(chatId, l === "fr"
      ? `📝 <b>${name}</b>\n\nSéries par défaut ? (ex: <code>3 × 10-12</code>)`
      : `📝 <b>${name}</b>\n\nDefault sets? (e.g. <code>3 × 10-12</code>)`);
    return;
  }

  // Template creation: awaiting default sets
  if (state.awaitingInput === "exercise_sets" && state.creatingTemplate && state.pendingExercise) {
    const l = await getLang(userId);
    const defaultSets = text.trim() || "3 × 10";
    const templates = await getTemplates(userId);
    const tmpl = getTemplateById(templates, state.creatingTemplate);
    if (!tmpl) return;

    const exId = state.pendingExercise.name.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 20) + "-" + Date.now().toString(36);
    tmpl.exercises.push({
      id: exId,
      name: state.pendingExercise.name,
      icon: state.pendingExercise.icon,
      defaultSets,
      bodyweight: false,
    });
    await saveTemplates(userId, templates);
    await setState(userId, { creatingTemplate: state.creatingTemplate, awaitingInput: undefined, pendingExercise: undefined });

    await sendMessage(chatId, l === "fr"
      ? `✅ <b>${state.pendingExercise.name}</b> ajouté (${defaultSets})`
      : `✅ <b>${state.pendingExercise.name}</b> added (${defaultSets})`,
      [
        [{ text: l === "fr" ? "➕ Encore un exercice" : "➕ Add Another", callback_data: `add_exo:${state.creatingTemplate}` }],
        [{ text: l === "fr" ? "🏋️ Poids du corps" : "🏋️ Toggle Bodyweight", callback_data: `toggle_bw:${state.creatingTemplate}:${exId}` }],
        [{ text: l === "fr" ? "← Voir la séance" : "← View Workout", callback_data: `edit_tmpl:${state.creatingTemplate}` }],
      ]);
    return;
  }

  // Normal set input during workout
  if (!state.currentExercise || !state.workoutId) {
    const l = await getLang(userId);
    await sendMessage(chatId, t("select_exercise_first", l));
    return;
  }

  const templates = await getTemplates(userId);
  const exercise = getExerciseFromTemplates(templates, state.currentExercise!);
  const bw = exercise?.bodyweight ?? false;
  const l = await getLang(userId);

  const sets = parseSets(text, bw);
  if (!sets) {
    const hint = bw
      ? `${t("use_format", l)} : <code>8</code> ${t("or", l)} <code>8, 10, 12</code>`
      : `${t("use_format", l)} : <code>8x60</code> ${t("or", l)} <code>8x60, 10x65</code>`;
    await sendMessage(chatId, `${t("invalid_format", l)}\n\n${hint}`);
    return;
  }

  const workout = await getWorkout(state.workoutId, userId);
  if (!workout) {
    await sendMessage(chatId, t("workout_not_found", l));
    await clearState(userId);
    return;
  }

  const existingLog = workout.exercises.find((e) => e.exerciseId === state.currentExercise);
  const existingSets = existingLog ? existingLog.sets : [];
  const allSets = [...existingSets, ...sets];

  const otherExercises = workout.exercises.filter((e) => e.exerciseId !== state.currentExercise);
  workout.exercises = [...otherExercises, { exerciseId: state.currentExercise!, sets: allSets }];
  await saveWorkout(workout, userId);

  if (!exercise) return;
  const view = exerciseView(exercise, allSets, l);
  await sendMessage(chatId, view.text, view.keyboard);
}

// --- Callback handler ---

export async function handleCallbackQuery(
  chatId: number, messageId: number, userId: string, data: string, callbackQueryId: string
) {
  await answerCallback(callbackQueryId);

  // Onboarding
  if (data === "onboard_defaults") {
    await initDefaultTemplates(userId);
    await showMainMenu(chatId, userId, messageId);
    return;
  }
  if (data === "onboard_custom") {
    await saveTemplates(userId, []);
    const l = await getLang(userId);
    await setState(userId, { awaitingInput: "template_name" });
    await editMessage(chatId, messageId, l === "fr"
      ? "📝 <b>Créer une séance</b>\n\nEnvoie le nom de ta séance (ex: Push, Leg Day...)"
      : "📝 <b>Create a Workout</b>\n\nSend the workout name (e.g. Push, Leg Day...)",
      []);
    return;
  }

  // Menu
  if (data === "menu") {
    await clearState(userId);
    await showMainMenu(chatId, userId, messageId);
    return;
  }

  if (data === "new_workout") { await handleNewWorkout(chatId, messageId, userId); return; }

  if (data.startsWith("type:")) {
    await handleTypeSelection(chatId, messageId, userId, data.split(":")[1]);
    return;
  }

  if (data.startsWith("exercise:")) {
    await handleExerciseSelection(chatId, messageId, userId, data.split(":")[1]);
    return;
  }

  if (data.startsWith("rmset:")) {
    await handleRemoveSet(chatId, messageId, userId, parseInt(data.split(":")[1]));
    return;
  }

  if (data === "exercise_done" || data === "back_to_exercises") {
    await handleExerciseDone(chatId, messageId, userId);
    return;
  }

  if (data === "done") { await handleDone(chatId, messageId, userId); return; }
  if (data === "stats") { await handleStats(chatId, messageId, userId); return; }

  // Exercise progression
  if (data === "exo_stats") {
    const l = await getLang(userId);
    const templates = await getTemplates(userId);
    const allExos = templates.flatMap((tmpl) => tmpl.exercises);
    const keyboard = allExos.map((ex) => [
      { text: `${ex.icon} ${ex.name}`, callback_data: `exo_chart:${ex.id}` },
    ]);
    keyboard.push([{ text: "← Stats", callback_data: "stats" }]);
    await editMessage(chatId, messageId, `📈 <b>${t("progression_title", l)}</b>\n\n${t("choose_exercise_prog", l)}`, keyboard);
    return;
  }

  if (data.startsWith("exo_chart:")) {
    const exerciseId = data.split(":")[1];
    const l = await getLang(userId);
    const templates = await getTemplates(userId);
    const exercise = getExerciseFromTemplates(templates, exerciseId);
    if (!exercise) return;

    const workouts = await getAllWorkouts(userId);
    const isBw = exercise.bodyweight ?? false;

    if (isBw) {
      const points = getExerciseMaxReps(workouts, exerciseId, 2);
      if (points.length < 2) {
        await editMessage(chatId, messageId, `${exercise.icon} <b>${exercise.name}</b>\n\n${t("not_enough_data", l)}`, [
          [{ text: `← ${t("progression_title", l)}`, callback_data: "exo_stats" }],
        ]);
        return;
      }
      const chart = await renderRepsChart(exerciseId, points, exercise.name);
      await sendPhoto(chatId, chart, `${exercise.icon} <b>${exercise.name}</b>\n${t("max_reps", l)} : ${points[0].maxReps} → ${points[points.length - 1].maxReps}`);
    } else {
      const points = getExerciseProgression(workouts, exerciseId, 2);
      if (points.length < 2) {
        await editMessage(chatId, messageId, `${exercise.icon} <b>${exercise.name}</b>\n\n${t("not_enough_data", l)}`, [
          [{ text: `← ${t("progression_title", l)}`, callback_data: "exo_stats" }],
        ]);
        return;
      }
      const chart = await renderProgressionChart(exerciseId, points, exercise.name);
      const first = points[0].maxWeight, last = points[points.length - 1].maxWeight, diff = last - first;
      const arrow = diff > 0 ? "📈" : diff < 0 ? "📉" : "➡️";
      await sendPhoto(chatId, chart, `${exercise.icon} <b>${exercise.name}</b>\n${arrow} ${first}kg → ${last}kg (${diff > 0 ? "+" : ""}${diff}kg)`);
    }
    await sendMessage(chatId, t("see_other", l), [
      [{ text: t("btn_other_exercise", l), callback_data: "exo_stats" }],
      [{ text: t("btn_stats", l), callback_data: "stats" }],
      [{ text: t("btn_menu", l), callback_data: "menu" }],
    ]);
    return;
  }

  if (data === "history") { await handleHistory(chatId, messageId, userId); return; }

  if (data.startsWith("workout_detail:")) {
    await handleWorkoutDetail(chatId, messageId, userId, data.split(":")[1]);
    return;
  }

  if (data === "edit_sessions") { await handleEditSessions(chatId, messageId, userId); return; }

  // Settings
  if (data === "settings") {
    const l = await getLang(userId);
    await editMessage(chatId, messageId, `${t("settings_title", l)}\n\n${t("current_lang", l)}`, [
      [{ text: t("btn_switch_lang", l), callback_data: "toggle_lang" }],
      [{ text: l === "fr" ? "📝 Gérer mes séances" : "📝 Manage Workouts", callback_data: "manage_templates" }],
      [{ text: t("btn_reset_history", l), callback_data: "reset_confirm" }],
      [{ text: t("btn_menu", l), callback_data: "menu" }],
    ]);
    return;
  }

  if (data === "toggle_lang") {
    const settings = await getSettings(userId);
    settings.lang = settings.lang === "fr" ? "en" : "fr";
    await saveSettings(userId, settings);
    const l = settings.lang;
    await editMessage(chatId, messageId, `${t("lang_changed", l)}\n\n${t("settings_title", l)}\n${t("current_lang", l)}`, [
      [{ text: t("btn_switch_lang", l), callback_data: "toggle_lang" }],
      [{ text: l === "fr" ? "📝 Gérer mes séances" : "📝 Manage Workouts", callback_data: "manage_templates" }],
      [{ text: t("btn_reset_history", l), callback_data: "reset_confirm" }],
      [{ text: t("btn_menu", l), callback_data: "menu" }],
    ]);
    return;
  }

  if (data === "reset_confirm") {
    const l = await getLang(userId);
    await editMessage(chatId, messageId, t("reset_confirm", l), [
      [{ text: t("btn_yes_reset", l), callback_data: "reset_history" }],
      [{ text: t("btn_cancel", l), callback_data: "settings" }],
    ]);
    return;
  }

  if (data === "reset_history") {
    const workouts = await getAllWorkouts(userId);
    for (const w of workouts) await deleteWorkout(w.id, userId);
    await clearState(userId);
    const l = await getLang(userId);
    await editMessage(chatId, messageId, t("reset_done", l), [
      [{ text: t("btn_settings", l), callback_data: "settings" }],
      [{ text: t("btn_menu", l), callback_data: "menu" }],
    ]);
    return;
  }

  // Template management
  if (data === "manage_templates") {
    await showTemplateManager(chatId, messageId, userId);
    return;
  }

  if (data === "new_template") {
    const l = await getLang(userId);
    await setState(userId, { awaitingInput: "template_name" });
    await editMessage(chatId, messageId, l === "fr"
      ? "📝 Envoie le nom de ta nouvelle séance :"
      : "📝 Send the name of your new workout:");
    return;
  }

  if (data.startsWith("edit_tmpl:")) {
    await showTemplateDetail(chatId, messageId, userId, data.split(":")[1]);
    return;
  }

  if (data.startsWith("add_exo:")) {
    const templateId = data.split(":")[1];
    const l = await getLang(userId);
    await setState(userId, { creatingTemplate: templateId, awaitingInput: "exercise_name" });
    await editMessage(chatId, messageId, l === "fr"
      ? "📝 Envoie le nom de l'exercice :"
      : "📝 Send the exercise name:");
    return;
  }

  if (data.startsWith("toggle_bw:")) {
    const [, templateId, exId] = data.split(":");
    const templates = await getTemplates(userId);
    const tmpl = getTemplateById(templates, templateId);
    if (!tmpl) return;
    const ex = tmpl.exercises.find((e) => e.id === exId);
    if (!ex) return;
    ex.bodyweight = !ex.bodyweight;
    await saveTemplates(userId, templates);
    const l = await getLang(userId);
    await editMessage(chatId, messageId, l === "fr"
      ? `${ex.bodyweight ? "🏃 Poids du corps activé" : "🏋️ Poids du corps désactivé"} pour <b>${ex.name}</b>`
      : `${ex.bodyweight ? "🏃 Bodyweight enabled" : "🏋️ Bodyweight disabled"} for <b>${ex.name}</b>`,
      [[{ text: l === "fr" ? "← Voir la séance" : "← View Workout", callback_data: `edit_tmpl:${templateId}` }]]);
    return;
  }

  if (data.startsWith("rm_exo:")) {
    const [, templateId, exId] = data.split(":");
    const templates = await getTemplates(userId);
    const tmpl = getTemplateById(templates, templateId);
    if (!tmpl) return;
    tmpl.exercises = tmpl.exercises.filter((e) => e.id !== exId);
    await saveTemplates(userId, templates);
    await showTemplateDetail(chatId, messageId, userId, templateId);
    return;
  }

  if (data.startsWith("del_tmpl:")) {
    const templateId = data.split(":")[1];
    const l = await getLang(userId);
    const templates = await getTemplates(userId);
    const tmpl = getTemplateById(templates, templateId);
    await editMessage(chatId, messageId, l === "fr"
      ? `⚠️ Supprimer la séance <b>${tmpl?.name}</b> ?`
      : `⚠️ Delete workout <b>${tmpl?.name}</b>?`,
      [
        [{ text: l === "fr" ? "✅ Oui" : "✅ Yes", callback_data: `confirm_del_tmpl:${templateId}` }],
        [{ text: t("btn_cancel", l), callback_data: `edit_tmpl:${templateId}` }],
      ]);
    return;
  }

  if (data.startsWith("confirm_del_tmpl:")) {
    const templateId = data.split(":")[1];
    const templates = await getTemplates(userId);
    const updated = templates.filter((t) => t.id !== templateId);
    await saveTemplates(userId, updated);
    await showTemplateManager(chatId, messageId, userId);
    return;
  }

  // Delete workout
  if (data.startsWith("delconfirm:")) {
    const workoutId = data.split(":")[1];
    const l = await getLang(userId);
    const workout = await getWorkout(workoutId, userId);
    if (!workout) { await handleStats(chatId, messageId, userId); return; }
    const templates = await getTemplates(userId);
    const tmpl = getTemplateById(templates, workout.type);
    await editMessage(chatId, messageId,
      `⚠️ ${t("confirm_delete", l)} <b>${tmpl?.icon || "•"} ${tmpl?.name || workout.type}</b> (${workout.date}) ${t("confirm_delete_q", l)}`,
      [
        [{ text: t("btn_yes_delete", l), callback_data: `delworkout:${workoutId}` }],
        [{ text: t("btn_cancel", l), callback_data: "edit_sessions" }],
      ]);
    return;
  }

  if (data.startsWith("delworkout:")) {
    const workoutId = data.split(":")[1];
    await deleteWorkout(workoutId, userId);
    const l = await getLang(userId);
    await editMessage(chatId, messageId, t("deleted", l), [
      [{ text: t("btn_edit_sessions", l), callback_data: "edit_sessions" }],
      [{ text: t("btn_stats", l), callback_data: "stats" }],
    ]);
    return;
  }
}
