import { midiToFreq, midiToNoteName } from './scaleEngine.js';

export const NOTES_PRACTICE_EXERCISE_ID = 'notes_practice';
export const NOTES_PRACTICE_BASE_MIDI = Object.freeze([54, 56, 58, 59]);
export const NOTES_PRACTICE_TOLERANCE_CENTS = 30;
export const NOTES_PRACTICE_HOLD_MS = 500;
export const NOTES_PRACTICE_MAX_GAP_MS = 120;

function round(value, precision = 0) {
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function createRejectedSamples() {
  return { quiet: 0, unclear: 0, outOfRange: 0 };
}

export function createNotesPracticeTargets(pitchShift = 0) {
  return NOTES_PRACTICE_BASE_MIDI.map((baseMidi, index) => {
    const midiNote = baseMidi + pitchShift;
    return {
      index,
      midiNote,
      noteName: midiToNoteName(midiNote),
      frequencyHz: round(midiToFreq(midiNote), 1),
      status: index === 0 ? 'ready' : 'waiting',
      detectedFrequencyHz: null,
      deviationCents: null,
      holdProgress: 0,
      timeToMatchMs: null,
      bestDeviationCents: null,
      activatedAtMs: null,
      completedAtMs: null,
    };
  });
}

export function createNotesPracticeState(pitchShift = 0) {
  return {
    status: 'idle',
    pitchShift,
    attemptId: null,
    startedAtMs: null,
    completedAtMs: null,
    activeIndex: 0,
    targets: createNotesPracticeTargets(pitchShift),
    rejectedSamples: createRejectedSamples(),
    validSamples: 0,
  };
}

function buildFeedback(metrics) {
  if (metrics.completedNotes === metrics.expectedNotes) {
    return {
      strengths: [`You matched all ${metrics.expectedNotes} target notes.`],
      focusAreas: metrics.medianDeviationCents <= 15
        ? ['Your completed notes stayed close to the center of each target.']
        : ['Some notes needed extra movement before settling on the target.'],
      nextAction: 'Repeat the four notes with the same relaxed, steady sound.',
    };
  }

  return {
    strengths: [`You matched ${metrics.completedNotes} of ${metrics.expectedNotes} target notes.`],
    focusAreas: ['The remaining notes were not held inside the target range long enough.'],
    nextAction: 'Try the incomplete notes again and hold each pitch steadily for half a second.',
  };
}

export class NotesPracticeTracker {
  constructor({ onStateChange = () => {}, onAttemptComplete = () => {} } = {}) {
    this.onStateChange = onStateChange;
    this.onAttemptComplete = onAttemptComplete;
    this.attemptSequence = 0;
    this.state = createNotesPracticeState();
    this.lastQualifiedAtMs = null;
    this.qualifiedDurationMs = 0;
    this.deviationSamples = [];
  }

  getSnapshot() {
    return {
      ...this.state,
      targets: this.state.targets.map((target) => ({ ...target })),
      rejectedSamples: { ...this.state.rejectedSamples },
    };
  }

  isActive() {
    return this.state.status === 'active';
  }

  configure(pitchShift = 0) {
    if (this.isActive()) return false;
    this.state = createNotesPracticeState(pitchShift);
    this.resetHold();
    this.emitState();
    return true;
  }

  start(pitchShift = this.state.pitchShift, startedAtMs = performance.now()) {
    if (this.isActive()) return false;
    this.attemptSequence += 1;
    const targets = createNotesPracticeTargets(pitchShift);
    targets[0] = {
      ...targets[0],
      status: 'listening',
      activatedAtMs: startedAtMs,
    };
    this.state = {
      ...createNotesPracticeState(pitchShift),
      status: 'active',
      attemptId: `${NOTES_PRACTICE_EXERCISE_ID}-${this.attemptSequence}`,
      startedAtMs,
      targets,
    };
    this.deviationSamples = [];
    this.resetHold();
    this.emitState();
    return true;
  }

  handleAnalysis(analysis) {
    if (!this.isActive()) return null;
    const capturedAtMs = analysis.sample?.capturedAtMs ?? analysis.capturedAtMs;
    if (!Number.isFinite(capturedAtMs)) return null;

    if (!analysis.sample) {
      this.countRejectedSample(analysis.signalQuality);
      if (
        this.lastQualifiedAtMs !== null
        && capturedAtMs - this.lastQualifiedAtMs > NOTES_PRACTICE_MAX_GAP_MS
      ) {
        this.resetHold();
        this.updateActiveTarget({ holdProgress: 0 });
      }
      return this.getSnapshot();
    }

    const target = this.state.targets[this.state.activeIndex];
    if (!target) return null;
    const deviationCents = (analysis.sample.midiFloat - target.midiNote) * 100;
    const absoluteDeviation = Math.abs(deviationCents);
    this.deviationSamples.push(absoluteDeviation);

    if (absoluteDeviation <= NOTES_PRACTICE_TOLERANCE_CENTS) {
      if (
        this.lastQualifiedAtMs !== null
        && capturedAtMs - this.lastQualifiedAtMs <= NOTES_PRACTICE_MAX_GAP_MS
      ) {
        this.qualifiedDurationMs += capturedAtMs - this.lastQualifiedAtMs;
      } else {
        this.qualifiedDurationMs = 0;
      }
      this.lastQualifiedAtMs = capturedAtMs;
    } else {
      this.resetHold();
    }

    const bestDeviationCents = target.bestDeviationCents === null
      ? absoluteDeviation
      : Math.min(target.bestDeviationCents, absoluteDeviation);
    this.state = {
      ...this.state,
      validSamples: this.state.validSamples + 1,
    };
    this.updateActiveTarget({
      detectedFrequencyHz: round(analysis.sample.frequencyHz, 1),
      deviationCents: round(deviationCents, 1),
      holdProgress: Math.min(1, this.qualifiedDurationMs / NOTES_PRACTICE_HOLD_MS),
      bestDeviationCents: round(bestDeviationCents, 1),
    });

    if (this.qualifiedDurationMs >= NOTES_PRACTICE_HOLD_MS) {
      return this.completeActiveTarget(capturedAtMs);
    }
    return this.getSnapshot();
  }

  stop(completedAtMs = performance.now()) {
    if (!this.isActive()) return { recorded: false, summary: null };
    const completedNotes = this.state.targets.filter((target) => target.status === 'done').length;
    if (completedNotes === 0) {
      this.state = {
        ...createNotesPracticeState(this.state.pitchShift),
        status: 'cancelled',
      };
      this.resetHold();
      this.emitState();
      return { recorded: false, summary: null };
    }

    this.state = { ...this.state, status: 'partial', completedAtMs };
    const summary = this.buildSummary();
    this.resetHold();
    this.emitState();
    this.onAttemptComplete(summary);
    return { recorded: true, summary };
  }

  cancel() {
    const wasActive = this.isActive();
    this.state = createNotesPracticeState(this.state.pitchShift);
    this.resetHold();
    this.emitState();
    return wasActive;
  }

  completeActiveTarget(capturedAtMs) {
    const activeIndex = this.state.activeIndex;
    const targets = this.state.targets.map((target, index) => {
      if (index === activeIndex) {
        return {
          ...target,
          status: 'done',
          holdProgress: 1,
          timeToMatchMs: Math.max(0, Math.round(capturedAtMs - target.activatedAtMs)),
          completedAtMs: capturedAtMs,
        };
      }
      if (index === activeIndex + 1) {
        return { ...target, status: 'listening', activatedAtMs: capturedAtMs };
      }
      return target;
    });

    this.resetHold();
    if (activeIndex === targets.length - 1) {
      this.state = {
        ...this.state,
        status: 'completed',
        completedAtMs: capturedAtMs,
        activeIndex: targets.length,
        targets,
      };
      const summary = this.buildSummary();
      this.emitState();
      this.onAttemptComplete(summary);
      return { completed: true, summary, state: this.getSnapshot() };
    }

    this.state = { ...this.state, activeIndex: activeIndex + 1, targets };
    this.emitState();
    return { completed: false, state: this.getSnapshot() };
  }

  buildSummary() {
    const noteResults = this.state.targets.map((target) => ({
      noteName: target.noteName,
      frequencyHz: target.frequencyHz,
      completed: target.status === 'done',
      timeToMatchMs: target.timeToMatchMs,
      bestDeviationCents: target.bestDeviationCents,
    }));
    const completedNotes = noteResults.filter((target) => target.completed).length;
    const metrics = {
      completedNotes,
      expectedNotes: noteResults.length,
      completionPercent: round((completedNotes / noteResults.length) * 100),
      medianDeviationCents: round(median(this.deviationSamples), 1),
      validSamples: this.state.validSamples,
      rejectedSamples: { ...this.state.rejectedSamples },
      noteResults,
    };
    const signalQuality = completedNotes === noteResults.length
      ? 'valid'
      : completedNotes > 0
        ? 'partial'
        : 'insufficient';

    return {
      attemptId: this.state.attemptId,
      exerciseId: NOTES_PRACTICE_EXERCISE_ID,
      startedAtMs: this.state.startedAtMs,
      completedAtMs: this.state.completedAtMs,
      signalQuality,
      metrics,
      ...buildFeedback(metrics),
    };
  }

  countRejectedSample(signalQuality) {
    const key = signalQuality === 'out_of_range'
      ? 'outOfRange'
      : signalQuality === 'unclear'
        ? 'unclear'
        : 'quiet';
    this.state = {
      ...this.state,
      rejectedSamples: {
        ...this.state.rejectedSamples,
        [key]: this.state.rejectedSamples[key] + 1,
      },
    };
  }

  updateActiveTarget(update) {
    const targets = this.state.targets.map((target, index) => (
      index === this.state.activeIndex ? { ...target, ...update } : target
    ));
    this.state = { ...this.state, targets };
    this.emitState();
  }

  resetHold() {
    this.lastQualifiedAtMs = null;
    this.qualifiedDurationMs = 0;
  }

  emitState() {
    this.onStateChange(this.getSnapshot());
  }
}
