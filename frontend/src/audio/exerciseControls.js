export const EXERCISE_NAMES = Object.freeze({
  warmup_breathing: 'Diaphragmatic Breathing',
  warmup_lip_trill: 'Lip Trill Scale',
  warmup_sirens: 'Vocal Sirens',
  notes_practice: 'Notes Practice',
});

export function applyExerciseSelection(engine, exerciseId) {
  if (!Object.hasOwn(EXERCISE_NAMES, exerciseId)) {
    throw new Error(`Unsupported exercise: ${exerciseId || 'missing'}`);
  }

  const previousExercise = engine.currentExercise;
  const stoppedPlayback = engine.isPlaying;
  engine.stop();
  engine.setExercise(exerciseId);

  return {
    status: 'success',
    applied: previousExercise !== exerciseId || stoppedPlayback,
    exercise_id: exerciseId,
    exercise_name: EXERCISE_NAMES[exerciseId],
    playback: 'stopped',
  };
}

export function upsertCoveredTip(tips, nextTip) {
  const existingIndex = tips.findIndex((tip) => tip.tipType === nextTip.tipType);
  if (existingIndex === -1) return [...tips, nextTip];

  const updated = [...tips];
  updated[existingIndex] = nextTip;
  return updated;
}
