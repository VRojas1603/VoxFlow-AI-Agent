function getAttemptCount(performance) {
  return performance.lipTrillAttempts.length + performance.sirenAttempts.length;
}

function buildFallbackFeedback(performance) {
  const latestAttempt = performance.lastAttempt;
  if (latestAttempt) {
    const strength = latestAttempt.strengths[0];
    const focus = latestAttempt.focusAreas[0];
    return {
      status: 'fallback',
      text: `${strength} ${focus} ${latestAttempt.nextAction}`,
      strengths: [...latestAttempt.strengths],
      focusAreas: [...latestAttempt.focusAreas],
      nextAction: latestAttempt.nextAction,
    };
  }

  if (performance.breathingCycles > 0) {
    const cycleLabel = performance.breathingCycles === 1 ? 'cycle' : 'cycles';
    return {
      status: 'fallback',
      text: `You completed ${performance.breathingCycles} guided breathing ${cycleLabel}. Add a lip trill or vocal siren attempt next time to receive pitch-based feedback.`,
      strengths: [`You completed ${performance.breathingCycles} full breathing ${cycleLabel}.`],
      focusAreas: ['No pitch-based exercise was completed during this session.'],
      nextAction: 'Complete one guided lip trill scale during the next session.',
    };
  }

  return {
    status: 'fallback',
    text: 'Your session activity was recorded, but no complete guided exercise was available for evaluation.',
    strengths: ['You started a vocal coaching session and explored the available exercises.'],
    focusAreas: ['Complete an entire guided exercise to receive measured feedback.'],
    nextAction: 'Start with one complete breathing cycle or lip trill scale next time.',
  };
}

export function buildSessionReport({
  durationFormatted,
  exercisesPracticed,
  tipsCovered,
  languageSwitches,
  keyShiftsUsed,
  speedChangesUsed,
  volumeChangesUsed,
  messageCount,
  performance,
  completedAt = new Date(),
}) {
  return {
    id: `session-${completedAt.getTime()}`,
    completedAt: completedAt.toISOString(),
    durationFormatted,
    exercisesPracticed: [...exercisesPracticed],
    breathingCycles: performance.breathingCycles,
    lipTrillAttempts: [...performance.lipTrillAttempts],
    sirenAttempts: [...performance.sirenAttempts],
    evaluatedAttempts: getAttemptCount(performance),
    tipsCovered: [...tipsCovered],
    languageSwitches,
    messageCount,
    playbackAdjustments: {
      keyShifts: keyShiftsUsed,
      speedChanges: speedChangesUsed,
      volumeChanges: volumeChangesUsed,
    },
    signalQuality: performance.lastAttempt?.signalQuality || 'insufficient',
    finalFeedback: buildFallbackFeedback(performance),
  };
}

function formatAttempt(attempt) {
  if (attempt.exerciseId === 'warmup_lip_trill') {
    return [
      `Attempt ${attempt.attemptNumber}: ${attempt.signalQuality}`,
      `  Detected notes: ${attempt.metrics.detectedNotes}/${attempt.metrics.expectedNotes}`,
      `  Pitch within ±30 cents: ${attempt.metrics.withinTolerancePercent}%`,
      `  Median deviation: ${attempt.metrics.medianDeviationCents} cents`,
      `  Stable notes: ${attempt.metrics.stableNotes}`,
      `  Focus: ${attempt.focusAreas[0]}`,
      `  Next action: ${attempt.nextAction}`,
    ].join('\n');
  }

  return [
    `Attempt ${attempt.attemptNumber}: ${attempt.signalQuality}`,
    `  Range covered: ${attempt.metrics.rangeSemitones} semitones`,
    `  Continuity: ${attempt.metrics.continuityPercent}%`,
    `  Direction match: ${attempt.metrics.directionMatchPercent}%`,
    `  Smooth movement: ${attempt.metrics.smoothMovementPercent}%`,
    `  Focus: ${attempt.focusAreas[0]}`,
    `  Next action: ${attempt.nextAction}`,
  ].join('\n');
}

export function serializeSessionReport(report) {
  const completedAt = new Date(report.completedAt).toLocaleString();
  const exercises = report.exercisesPracticed.length
    ? report.exercisesPracticed.map((exercise) => `• ${exercise}`).join('\n')
    : '• No completed exercises';
  const tips = report.tipsCovered.length
    ? report.tipsCovered.map((tip) => `• ${tip.title}: ${tip.explanation}`).join('\n')
    : '• No technique tips requested';
  const lipTrills = report.lipTrillAttempts.length
    ? report.lipTrillAttempts.map(formatAttempt).join('\n\n')
    : 'No completed lip trill attempts.';
  const sirens = report.sirenAttempts.length
    ? report.sirenAttempts.map(formatAttempt).join('\n\n')
    : 'No completed vocal siren attempts.';

  return `
=== VoxFlow Vocal Coaching Session Report ===
Date: ${completedAt}
Coach: Lyra (AssemblyAI Voice Agent)
Session Duration: ${report.durationFormatted}
Messages Exchanged: ${report.messageCount}
Bilingual Language Switches: ${report.languageSwitches}

-- Activities Recorded --
${exercises}
Breathing Cycles Completed: ${report.breathingCycles}
Evaluated Attempts: ${report.evaluatedAttempts}

-- Lip Trill Performance --
${lipTrills}

-- Vocal Siren Performance --
${sirens}

-- Vocal Techniques & Tips Covered --
${tips}

Key Pitch Shifts Tested: ${report.playbackAdjustments.keyShifts}
Playback Speed Changes: ${report.playbackAdjustments.speedChanges}
Accompaniment Volume Changes: ${report.playbackAdjustments.volumeChanges}

-- Session Feedback --
${report.finalFeedback.text}

Next Action:
${report.finalFeedback.nextAction}
=============================================
  `.trim();
}
