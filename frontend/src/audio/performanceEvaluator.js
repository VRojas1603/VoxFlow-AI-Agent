const ATTACK_GRACE_MS = 120;
const BEGINNER_TOLERANCE_CENTS = 30;
const STABLE_NOTE_MAD_CENTS = 20;
const MIN_VALID_FRAMES_PER_NOTE = 2;

export function createEmptySessionPerformance() {
  return {
    breathingCycles: 0,
    lipTrillAttempts: [],
    sirenAttempts: [],
    lastAttempt: null,
  };
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value, precision = 0) {
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function medianAbsoluteDeviation(values) {
  if (values.length === 0) return 0;
  const center = median(values);
  return median(values.map((value) => Math.abs(value - center)));
}

function getSignalQuality(validUnits, totalUnits) {
  if (totalUnits === 0 || validUnits <= 2) return 'insufficient';
  if (validUnits / totalUnits >= 0.7) return 'valid';
  return 'partial';
}

function buildLipTrillFeedback(metrics) {
  if (metrics.detectedNotes === 0) {
    return {
      strengths: ['The attempt was recorded, but there was not enough clear pitch information to evaluate it.'],
      focusAreas: ['No target note contained enough valid vocal samples.'],
      nextAction: 'Try again with headphones and keep the microphone close enough to capture the lip trill clearly.',
    };
  }

  let strength = `You produced clear pitch information on ${metrics.detectedNotes} of ${metrics.expectedNotes} notes.`;
  if (metrics.withinTolerancePercent >= 75) {
    strength = `${metrics.withinTolerancePercent}% of the detected pitch stayed within ±${BEGINNER_TOLERANCE_CENTS} cents of the target notes.`;
  } else if (metrics.stableNotes >= 6) {
    strength = `${metrics.stableNotes} notes were held with consistent pitch.`;
  }

  let focus = 'Keep the airflow continuous as the scale changes direction.';
  let nextAction = 'Repeat the scale once more at the current speed and keep each note connected.';
  if (metrics.missedNotes > 2) {
    focus = `${metrics.missedNotes} target notes did not contain enough clear vocal signal.`;
    nextAction = 'Repeat at a slower speed and sustain every note through its full duration.';
  } else if (metrics.octaveErrorNotes > 0) {
    focus = `${metrics.octaveErrorNotes} notes were detected near a different octave from the target.`;
    nextAction = 'Listen to the first reference note, match its octave, and then repeat the scale.';
  } else if (metrics.medianDeviationCents > BEGINNER_TOLERANCE_CENTS) {
    const direction = metrics.medianSignedDeviationCents < 0 ? 'below' : 'above';
    focus = `The detected pitch tended to sit ${direction} the target notes.`;
    nextAction = 'Repeat slowly and center each note before moving to the next one.';
  } else if (metrics.stableNotes < metrics.detectedNotes) {
    focus = 'Some detected notes moved around after reaching the target pitch.';
    nextAction = 'Use a steady stream of air and keep the lip vibration relaxed.';
  }

  return {
    strengths: [strength],
    focusAreas: [focus],
    nextAction,
  };
}

function evaluateLipTrill(attempt, attemptNumber) {
  const noteTargets = attempt.targets
    .filter((target) => target.targetType === 'note')
    .sort((left, right) => left.sequenceIndex - right.sequenceIndex);
  const errors = [];
  const signedErrors = [];
  let detectedNotes = 0;
  let stableNotes = 0;
  let octaveErrorNotes = 0;

  for (const target of noteTargets) {
    const samples = attempt.frames
      .filter((frame) => frame.target.sequenceIndex === target.sequenceIndex && frame.sample)
      .map((frame) => frame.sample);
    if (samples.length < MIN_VALID_FRAMES_PER_NOTE) continue;

    detectedNotes += 1;
    const noteErrors = samples.map((sample) => (sample.midiFloat - target.midiNote) * 100);
    signedErrors.push(...noteErrors);
    errors.push(...noteErrors.map(Math.abs));

    if (medianAbsoluteDeviation(noteErrors) <= STABLE_NOTE_MAD_CENTS) stableNotes += 1;
    if (Math.abs(median(noteErrors)) >= 900) octaveErrorNotes += 1;
  }

  const expectedNotes = noteTargets.length;
  const withinToleranceFrames = errors.filter(
    (error) => error <= BEGINNER_TOLERANCE_CENTS,
  ).length;
  const metrics = {
    expectedNotes,
    detectedNotes,
    missedNotes: Math.max(0, expectedNotes - detectedNotes),
    stableNotes,
    octaveErrorNotes,
    withinTolerancePercent: errors.length
      ? round((withinToleranceFrames / errors.length) * 100)
      : 0,
    medianDeviationCents: round(median(errors), 1),
    medianSignedDeviationCents: round(median(signedErrors), 1),
    validSamples: errors.length,
  };
  const signalQuality = getSignalQuality(detectedNotes, expectedNotes);

  return {
    attemptId: attempt.attemptId,
    exerciseId: attempt.exerciseId,
    attemptNumber,
    startedAtMs: attempt.startedAtMs,
    completedAtMs: attempt.completedAtMs,
    signalQuality,
    metrics,
    ...buildLipTrillFeedback(metrics),
  };
}

function expectedGlideMidi(target, capturedAtMs) {
  const elapsedMs = capturedAtMs - target.timelineStartedAtMs;
  const progress = clamp(elapsedMs / target.durationMs, 0, 1);
  return target.startMidi + (target.endMidi - target.startMidi) * progress;
}

function countInterruptions(frames) {
  let interruptions = 0;
  let invalidRun = 0;

  for (const frame of frames) {
    if (frame.sample) {
      if (invalidRun >= 3) interruptions += 1;
      invalidRun = 0;
    } else {
      invalidRun += 1;
    }
  }

  if (invalidRun >= 3) interruptions += 1;
  return interruptions;
}

function buildSirenFeedback(metrics) {
  if (metrics.validSamples === 0) {
    return {
      strengths: ['The siren attempt was recorded, but there was not enough clear pitch information to evaluate it.'],
      focusAreas: ['The app could not identify a continuous vocal signal during the sweep.'],
      nextAction: 'Try again with headphones and sustain a clear vowel through the upward and downward movement.',
    };
  }

  let strength = `You covered ${metrics.rangeSemitones} semitones during the siren.`;
  if (metrics.continuityPercent >= 75) {
    strength = `Your vocal signal remained continuous for ${metrics.continuityPercent}% of the measured siren.`;
  } else if (metrics.directionMatchPercent >= 80) {
    strength = `Your pitch followed the intended direction ${metrics.directionMatchPercent}% of the time.`;
  }

  let focus = 'Keep the change of pitch smooth around the top of the siren.';
  let nextAction = 'Repeat the full upward and downward sweep with one continuous sound.';
  if (metrics.completedDirections < 2) {
    focus = 'The app did not receive enough clear pitch information in both directions.';
    nextAction = 'Repeat the siren and sustain the sound through both the upward and downward sweeps.';
  } else if (metrics.interruptions > 0) {
    focus = `${metrics.interruptions} sustained interruption${metrics.interruptions === 1 ? '' : 's'} appeared in the vocal signal.`;
    nextAction = 'Use a lighter sound and keep the airflow moving through the entire sweep.';
  } else if (metrics.directionMatchPercent < 75) {
    focus = 'Parts of the vocal contour moved against the reference direction.';
    nextAction = 'Follow the reference slowly and make the turn only when the accompaniment changes direction.';
  } else if (metrics.smoothMovementPercent < 70) {
    focus = 'The pitch contour contained several abrupt changes.';
    nextAction = 'Reduce the speed and connect the low and high parts without stepping between notes.';
  }

  return {
    strengths: [strength],
    focusAreas: [focus],
    nextAction,
  };
}

function evaluateSiren(attempt, attemptNumber) {
  const glideTargets = attempt.targets
    .filter((target) => target.targetType === 'glide')
    .sort((left, right) => left.sequenceIndex - right.sequenceIndex);
  const orderedFrames = [...attempt.frames].sort(
    (left, right) => left.capturedAtMs - right.capturedAtMs,
  );
  const validFrames = orderedFrames.filter((frame) => frame.sample);
  const firstValidFrame = validFrames[0];
  const initialExpectedMidi = firstValidFrame
    ? expectedGlideMidi(firstValidFrame.target, firstValidFrame.capturedAtMs)
    : 0;
  const octaveOffset = firstValidFrame
    ? Math.round((firstValidFrame.sample.midiFloat - initialExpectedMidi) / 12) * 12
    : 0;
  const contourErrors = validFrames.map((frame) => {
    const alignedMidi = frame.sample.midiFloat - octaveOffset;
    return Math.abs(alignedMidi - expectedGlideMidi(frame.target, frame.capturedAtMs)) * 100;
  });
  const midiValues = validFrames.map((frame) => frame.sample.midiFloat);
  const rangeSemitones = midiValues.length
    ? Math.max(...midiValues) - Math.min(...midiValues)
    : 0;
  const targetRangeSemitones = glideTargets.length
    ? Math.max(...glideTargets.map((target) => Math.abs(target.endMidi - target.startMidi)))
    : 0;
  const completedDirections = glideTargets.filter((target) => (
    validFrames.filter((frame) => frame.target.sequenceIndex === target.sequenceIndex).length >= 5
  )).length;

  let directionComparisons = 0;
  let matchingDirections = 0;
  let smoothComparisons = 0;
  let smoothMovements = 0;
  for (let index = 1; index < validFrames.length; index += 1) {
    const previous = validFrames[index - 1];
    const current = validFrames[index];
    if (previous.target.sequenceIndex !== current.target.sequenceIndex) continue;
    if (current.capturedAtMs - previous.capturedAtMs > 160) continue;

    const actualDelta = current.sample.midiFloat - previous.sample.midiFloat;
    const expectedDelta = (
      (current.target.endMidi - current.target.startMidi)
      * (current.capturedAtMs - previous.capturedAtMs)
      / current.target.durationMs
    );
    directionComparisons += 1;
    if (expectedDelta >= 0 ? actualDelta >= -0.2 : actualDelta <= 0.2) {
      matchingDirections += 1;
    }
    smoothComparisons += 1;
    if (Math.abs(actualDelta - expectedDelta) <= 0.75) smoothMovements += 1;
  }

  const continuityPercent = orderedFrames.length
    ? round((validFrames.length / orderedFrames.length) * 100)
    : 0;
  const metrics = {
    completedDirections,
    rangeSemitones: round(rangeSemitones, 1),
    rangeCoveragePercent: targetRangeSemitones
      ? round(clamp((rangeSemitones / targetRangeSemitones) * 100, 0, 100))
      : 0,
    continuityPercent,
    directionMatchPercent: directionComparisons
      ? round((matchingDirections / directionComparisons) * 100)
      : 0,
    smoothMovementPercent: smoothComparisons
      ? round((smoothMovements / smoothComparisons) * 100)
      : 0,
    medianContourDeviationCents: round(median(contourErrors), 1),
    interruptions: countInterruptions(orderedFrames),
    validSamples: validFrames.length,
  };
  const signalQuality = completedDirections === 2 && continuityPercent >= 60
    ? 'valid'
    : validFrames.length >= 8
      ? 'partial'
      : 'insufficient';

  return {
    attemptId: attempt.attemptId,
    exerciseId: attempt.exerciseId,
    attemptNumber,
    startedAtMs: attempt.startedAtMs,
    completedAtMs: attempt.completedAtMs,
    signalQuality,
    metrics,
    ...buildSirenFeedback(metrics),
  };
}

export class SessionPerformanceTracker {
  constructor() {
    this.reset();
  }

  reset() {
    this.performance = createEmptySessionPerformance();
    this.activeAttempt = null;
    this.currentTarget = null;
  }

  handleTarget(target) {
    this.currentTarget = target;
    if (!target || !this.activeAttempt || target.attemptId !== this.activeAttempt.attemptId) return;
    this.activeAttempt.targets.push(target);
  }

  handleAnalysis(analysis) {
    if (!this.activeAttempt || !this.currentTarget) return;
    if (this.currentTarget.attemptId !== this.activeAttempt.attemptId) return;
    if (!['warmup_lip_trill', 'warmup_sirens'].includes(this.activeAttempt.exerciseId)) return;

    const capturedAtMs = analysis.sample?.capturedAtMs ?? analysis.capturedAtMs;
    if (!Number.isFinite(capturedAtMs)) return;
    const targetStart = this.currentTarget.timelineStartedAtMs + ATTACK_GRACE_MS;
    const targetEnd = this.currentTarget.timelineStartedAtMs + this.currentTarget.durationMs;
    if (capturedAtMs < targetStart || capturedAtMs > targetEnd) return;

    this.activeAttempt.frames.push({
      capturedAtMs,
      signalQuality: analysis.signalQuality,
      sample: analysis.sample,
      target: this.currentTarget,
    });
  }

  handleExerciseEvent(event) {
    if (event.type === 'attempt.started') {
      this.activeAttempt = {
        attemptId: event.attemptId,
        exerciseId: event.exerciseId,
        startedAtMs: event.startedAtMs,
        targets: [],
        frames: [],
      };
      this.currentTarget = null;
      return null;
    }

    if (event.type === 'attempt.cancelled') {
      if (this.activeAttempt?.attemptId === event.attemptId) {
        this.activeAttempt = null;
        this.currentTarget = null;
      }
      return null;
    }

    if (event.type !== 'attempt.completed') return null;

    if (event.exerciseId === 'warmup_breathing') {
      if (!this.activeAttempt || this.activeAttempt.attemptId !== event.attemptId) return null;
      this.performance = {
        ...this.performance,
        breathingCycles: this.performance.breathingCycles + 1,
      };
      this.activeAttempt = null;
      this.currentTarget = null;
      return {
        type: 'breathing.completed',
        breathingCycles: this.performance.breathingCycles,
      };
    }

    if (!this.activeAttempt || this.activeAttempt.attemptId !== event.attemptId) return null;
    this.activeAttempt.completedAtMs = event.completedAtMs;

    let summary = null;
    if (event.exerciseId === 'warmup_lip_trill') {
      summary = evaluateLipTrill(
        this.activeAttempt,
        this.performance.lipTrillAttempts.length + 1,
      );
      this.performance = {
        ...this.performance,
        lipTrillAttempts: [...this.performance.lipTrillAttempts, summary],
        lastAttempt: summary,
      };
    } else if (event.exerciseId === 'warmup_sirens') {
      summary = evaluateSiren(
        this.activeAttempt,
        this.performance.sirenAttempts.length + 1,
      );
      this.performance = {
        ...this.performance,
        sirenAttempts: [...this.performance.sirenAttempts, summary],
        lastAttempt: summary,
      };
    }

    this.activeAttempt = null;
    this.currentTarget = null;
    return summary;
  }

  getSnapshot() {
    return {
      ...this.performance,
      lipTrillAttempts: [...this.performance.lipTrillAttempts],
      sirenAttempts: [...this.performance.sirenAttempts],
    };
  }
}
