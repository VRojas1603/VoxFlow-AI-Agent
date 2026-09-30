function getAttemptCount(performance) {
  return (
    performance.lipTrillAttempts.length
    + performance.sirenAttempts.length
    + (performance.notesPracticeAttempts?.length || 0)
  );
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
  finalFeedbackText = '',
  completedAt = new Date(),
}) {
  const fallbackFeedback = buildFallbackFeedback(performance);
  const agentFeedback = typeof finalFeedbackText === 'string'
    ? finalFeedbackText.trim()
    : '';
  return {
    id: `session-${completedAt.getTime()}`,
    completedAt: completedAt.toISOString(),
    durationFormatted,
    exercisesPracticed: [...exercisesPracticed],
    breathingCycles: performance.breathingCycles,
    lipTrillAttempts: [...performance.lipTrillAttempts],
    sirenAttempts: [...performance.sirenAttempts],
    notesPracticeAttempts: [...(performance.notesPracticeAttempts || [])],
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
    finalFeedback: agentFeedback
      ? { ...fallbackFeedback, status: 'agent', text: agentFeedback }
      : fallbackFeedback,
  };
}

function mapFeedback(attempt) {
  return {
    strengths: [...attempt.strengths],
    focus_areas: [...attempt.focusAreas],
    next_action: attempt.nextAction,
  };
}

function mapLipTrillAttempt(attempt) {
  return {
    attempt_number: attempt.attemptNumber,
    signal_quality: attempt.signalQuality,
    metrics: {
      detected_notes: attempt.metrics.detectedNotes,
      expected_notes: attempt.metrics.expectedNotes,
      within_tolerance_percent: attempt.metrics.withinTolerancePercent,
      median_deviation_cents: attempt.metrics.medianDeviationCents,
      stable_notes: attempt.metrics.stableNotes,
      missed_notes: attempt.metrics.missedNotes,
      register_offset_semitones: attempt.metrics.registerOffsetSemitones,
      rejected_samples: {
        quiet: attempt.metrics.rejectedSamples.quiet,
        unclear: attempt.metrics.rejectedSamples.unclear,
        out_of_range: attempt.metrics.rejectedSamples.outOfRange,
      },
    },
    ...mapFeedback(attempt),
  };
}

function mapSirenAttempt(attempt) {
  return {
    attempt_number: attempt.attemptNumber,
    signal_quality: attempt.signalQuality,
    metrics: {
      range_semitones: attempt.metrics.rangeSemitones,
      range_coverage_percent: attempt.metrics.rangeCoveragePercent,
      continuity_percent: attempt.metrics.continuityPercent,
      direction_match_percent: attempt.metrics.directionMatchPercent,
      smooth_movement_percent: attempt.metrics.smoothMovementPercent,
      interruptions: attempt.metrics.interruptions,
      rejected_samples: {
        quiet: attempt.metrics.rejectedSamples.quiet,
        unclear: attempt.metrics.rejectedSamples.unclear,
        out_of_range: attempt.metrics.rejectedSamples.outOfRange,
      },
    },
    ...mapFeedback(attempt),
  };
}

function mapNotesPracticeAttempt(attempt) {
  return {
    attempt_number: attempt.attemptNumber,
    signal_quality: attempt.signalQuality,
    metrics: {
      completed_notes: attempt.metrics.completedNotes,
      expected_notes: attempt.metrics.expectedNotes,
      completion_percent: attempt.metrics.completionPercent,
      median_deviation_cents: attempt.metrics.medianDeviationCents,
      valid_samples: attempt.metrics.validSamples,
      rejected_samples: {
        quiet: attempt.metrics.rejectedSamples.quiet,
        unclear: attempt.metrics.rejectedSamples.unclear,
        out_of_range: attempt.metrics.rejectedSamples.outOfRange,
      },
      note_results: attempt.metrics.noteResults.map((note) => ({
        note_name: note.noteName,
        frequency_hz: note.frequencyHz,
        completed: note.completed,
        time_to_match_ms: note.timeToMatchMs,
        best_deviation_cents: note.bestDeviationCents,
      })),
    },
    ...mapFeedback(attempt),
  };
}

export function buildAgentPerformanceSummary({ durationSeconds, performance }) {
  const fallbackFeedback = buildFallbackFeedback(performance);
  return {
    duration_seconds: durationSeconds,
    breathing_cycles: performance.breathingCycles,
    lip_trill_attempts: performance.lipTrillAttempts.map(mapLipTrillAttempt),
    vocal_siren_attempts: performance.sirenAttempts.map(mapSirenAttempt),
    notes_practice_attempts: (performance.notesPracticeAttempts || []).map(mapNotesPracticeAttempt),
    deterministic_feedback: {
      text: fallbackFeedback.text,
      next_action: fallbackFeedback.nextAction,
    },
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
      `  Register alignment: ${attempt.metrics.registerOffsetSemitones >= 0 ? '+' : ''}${attempt.metrics.registerOffsetSemitones} semitones`,
      `  Rejected samples: quiet ${attempt.metrics.rejectedSamples.quiet}, unclear ${attempt.metrics.rejectedSamples.unclear}, out of range ${attempt.metrics.rejectedSamples.outOfRange}`,
      `  Focus: ${attempt.focusAreas[0]}`,
      `  Next action: ${attempt.nextAction}`,
    ].join('\n');
  }

  if (attempt.exerciseId === 'warmup_sirens') return [
    `Attempt ${attempt.attemptNumber}: ${attempt.signalQuality}`,
    `  Range covered: ${attempt.metrics.rangeSemitones} semitones`,
    `  Continuity: ${attempt.metrics.continuityPercent}%`,
    `  Direction match: ${attempt.metrics.directionMatchPercent}%`,
    `  Smooth movement: ${attempt.metrics.smoothMovementPercent}%`,
    `  Rejected samples: quiet ${attempt.metrics.rejectedSamples.quiet}, unclear ${attempt.metrics.rejectedSamples.unclear}, out of range ${attempt.metrics.rejectedSamples.outOfRange}`,
    `  Focus: ${attempt.focusAreas[0]}`,
    `  Next action: ${attempt.nextAction}`,
  ].join('\n');

  const noteResults = attempt.metrics.noteResults
    .map((note) => [
      `  ${note.noteName} (${note.frequencyHz} Hz): ${note.completed ? 'Done' : 'Incomplete'}${note.timeToMatchMs === null ? '' : ` in ${note.timeToMatchMs} ms`}`,
      `    Best deviation: ${note.bestDeviationCents === null ? 'not available' : `${note.bestDeviationCents} cents`}`,
    ].join('\n'))
    .join('\n');
  return [
    `Attempt ${attempt.attemptNumber}: ${attempt.signalQuality}`,
    `  Completed notes: ${attempt.metrics.completedNotes}/${attempt.metrics.expectedNotes}`,
    `  Completion: ${attempt.metrics.completionPercent}%`,
    `  Median deviation: ${attempt.metrics.medianDeviationCents} cents`,
    noteResults,
    `  Rejected samples: quiet ${attempt.metrics.rejectedSamples.quiet}, unclear ${attempt.metrics.rejectedSamples.unclear}, out of range ${attempt.metrics.rejectedSamples.outOfRange}`,
    `  Strength: ${attempt.strengths[0]}`,
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
  const notesPractice = report.notesPracticeAttempts.length
    ? report.notesPracticeAttempts.map(formatAttempt).join('\n\n')
    : 'No completed notes practice attempts.';

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

-- Notes Practice Performance --
${notesPractice}

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
