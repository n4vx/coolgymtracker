export type Lang = "fr" | "en";

const strings = {
  // Home
  home_title: { fr: "🏋️ <b>Gym Tracker</b>\n\nQue veux-tu faire ?", en: "🏋️ <b>Gym Tracker</b>\n\nWhat do you want to do?" },
  btn_new_workout: { fr: "💪 Nouvelle Séance", en: "💪 New Workout" },
  btn_stats: { fr: "📊 Stats", en: "📊 Stats" },
  btn_settings: { fr: "⚙️ Réglages", en: "⚙️ Settings" },

  // Type selection
  choose_type: { fr: "🏋️ <b>Choisis ton type de séance :</b>", en: "🏋️ <b>Choose your workout type:</b>" },
  btn_other: { fr: "⚡ Autre", en: "⚡ Other" },
  btn_back: { fr: "← Retour", en: "← Back" },
  btn_menu: { fr: "← Menu", en: "← Menu" },

  // Exercise list
  choose_exercise: { fr: "Choisis un exercice :", en: "Choose an exercise:" },
  btn_end_workout: { fr: "✅ Terminer la séance", en: "✅ End Workout" },

  // Exercise view
  target: { fr: "Objectif", en: "Target" },
  series: { fr: "Séries", en: "Sets" },
  send_set: { fr: "📩 Envoie une série :", en: "📩 Send a set:" },
  send_reps: { fr: "📩 Envoie tes reps :", en: "📩 Send your reps:" },
  or: { fr: "ou", en: "or" },
  btn_exercise_done: { fr: "✅ Exercice terminé", en: "✅ Exercise Done" },
  btn_back_exercises: { fr: "← Retour aux exercices", en: "← Back to exercises" },
  btn_remove_set: { fr: "🗑 Série", en: "🗑 Set" },
  saved: { fr: "Enregistré !", en: "Saved!" },

  // Workout done
  workout_done: { fr: "Séance", en: "Workout" },
  done_suffix: { fr: "terminée !", en: "completed!" },
  no_exercises: { fr: "Aucun exercice enregistré.", en: "No exercises recorded." },
  duration: { fr: "Durée", en: "Duration" },
  average_duration: { fr: "Durée moyenne", en: "Average duration" },
  median_duration: { fr: "Durée médiane", en: "Median duration" },
  started_at: { fr: "Début", en: "Start" },
  ended_at: { fr: "Fin", en: "End" },

  // Stats
  stats_title: { fr: "Stats (30 derniers jours)", en: "Stats (last 30 days)" },
  total: { fr: "Total", en: "Total" },
  sessions: { fr: "séances", en: "sessions" },
  btn_progression: { fr: "📈 Progression par exercice", en: "📈 Exercise Progression" },
  btn_history: { fr: "📋 Historique de séances", en: "📋 Workout History" },
  btn_edit_sessions: { fr: "✏️ Éditer les séances", en: "✏️ Edit Workouts" },

  // History
  history_title: { fr: "Historique des séances", en: "Workout History" },
  no_sessions: { fr: "Aucune séance.", en: "No workouts." },
  no_exercise_data: { fr: "Aucun exercice", en: "No exercises" },
  details: { fr: "détails", en: "details" },
  btn_history_back: { fr: "← Historique", en: "← History" },

  // Progression
  progression_title: { fr: "Progression par exercice", en: "Exercise Progression" },
  choose_exercise_prog: { fr: "Choisis un exercice :", en: "Choose an exercise:" },
  not_enough_data: { fr: "Pas assez de données (min 2 séances).", en: "Not enough data (min 2 sessions)." },
  btn_other_exercise: { fr: "📈 Autre exercice", en: "📈 Other Exercise" },
  max_reps: { fr: "Max reps", en: "Max reps" },
  no_duration_data: { fr: "Pas encore de données de durée.", en: "No duration data yet." },

  // Edit
  edit_title: { fr: "Éditer les séances", en: "Edit Workouts" },
  select_delete: { fr: "Sélectionne une séance à supprimer :", en: "Select a workout to delete:" },
  confirm_delete: { fr: "Supprimer la séance", en: "Delete workout" },
  confirm_delete_q: { fr: "?", en: "?" },
  btn_yes_delete: { fr: "✅ Oui, supprimer", en: "✅ Yes, delete" },
  btn_cancel: { fr: "← Annuler", en: "← Cancel" },
  deleted: { fr: "🗑 Séance supprimée.", en: "🗑 Workout deleted." },

  // Settings
  settings_title: { fr: "⚙️ <b>Réglages</b>", en: "⚙️ <b>Settings</b>" },
  current_lang: { fr: "Langue : 🇫🇷 Français", en: "Language: 🇬🇧 English" },
  btn_switch_lang: { fr: "🇬🇧 Switch to English", en: "🇫🇷 Passer en Français" },
  btn_reset_history: { fr: "🗑 Réinitialiser l'historique", en: "🗑 Reset History" },
  reset_confirm: { fr: "⚠️ <b>Supprimer TOUTES les séances ?</b>\n\nCette action est irréversible.", en: "⚠️ <b>Delete ALL workouts?</b>\n\nThis cannot be undone." },
  btn_yes_reset: { fr: "✅ Oui, tout supprimer", en: "✅ Yes, delete all" },
  reset_done: { fr: "🗑 Historique réinitialisé.", en: "🗑 History reset." },
  lang_changed: { fr: "✅ Langue changée en Français.", en: "✅ Language changed to English." },

  // Errors
  invalid_format: { fr: "❌ Format invalide.", en: "❌ Invalid format." },
  use_format: { fr: "Utilise", en: "Use" },
  select_exercise_first: { fr: "Sélectionne d'abord un exercice, ou envoie /start.", en: "Select an exercise first, or send /start." },
  workout_not_found: { fr: "Séance introuvable.", en: "Workout not found." },
  no_active_workout: { fr: "Aucune séance en cours.", en: "No active workout." },
  see_other: { fr: "Voir un autre exercice ?", en: "See another exercise?" },
} as const;

type StringKey = keyof typeof strings;

export function t(key: StringKey, lang: Lang): string {
  return strings[key][lang];
}
