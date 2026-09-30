const PROTECTED_EXERCISES = new Set([
  'warmup_lip_trill',
  'warmup_sirens',
  'notes_practice',
]);

export function shouldPauseAgentAudio({ phase, exerciseId }) {
  if (phase === 'countdown' || phase === 'waiting_for_voice') return true;
  return phase === 'playing' && PROTECTED_EXERCISES.has(exerciseId);
}

export function isProtectedGuidedExercise(exerciseId) {
  return PROTECTED_EXERCISES.has(exerciseId);
}
