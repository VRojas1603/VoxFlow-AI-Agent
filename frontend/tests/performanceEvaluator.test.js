import assert from 'node:assert/strict';
import test from 'node:test';

import { SessionPerformanceTracker } from '../src/audio/performanceEvaluator.js';

function createValidAnalysis(target, capturedAtMs, midiFloat) {
  return {
    signalQuality: 'valid',
    capturedAtMs,
    sample: {
      capturedAtMs,
      midiFloat,
      frequencyHz: 440 * (2 ** ((midiFloat - 69) / 12)),
      clarity: 0.98,
      rms: 0.2,
    },
    target,
  };
}

function startAttempt(tracker, exerciseId, attemptId, startedAtMs = 1000) {
  tracker.handleExerciseEvent({
    type: 'attempt.started',
    exerciseId,
    attemptId,
    startedAtMs,
  });
}

test('counts only completed breathing cycles', () => {
  const tracker = new SessionPerformanceTracker();

  startAttempt(tracker, 'warmup_breathing', 'breathing-1');
  tracker.handleExerciseEvent({
    type: 'attempt.cancelled',
    exerciseId: 'warmup_breathing',
    attemptId: 'breathing-1',
  });
  startAttempt(tracker, 'warmup_breathing', 'breathing-2');
  tracker.handleExerciseEvent({
    type: 'attempt.completed',
    exerciseId: 'warmup_breathing',
    attemptId: 'breathing-2',
    completedAtMs: 17000,
  });
  tracker.handleExerciseEvent({
    type: 'attempt.completed',
    exerciseId: 'warmup_breathing',
    attemptId: 'breathing-2',
    completedAtMs: 17000,
  });

  assert.equal(tracker.getSnapshot().breathingCycles, 1);
});

test('evaluates a complete lip trill against all nine target notes', () => {
  const tracker = new SessionPerformanceTracker();
  const attemptId = 'lip-trill-1';
  startAttempt(tracker, 'warmup_lip_trill', attemptId);

  for (let sequenceIndex = 0; sequenceIndex < 9; sequenceIndex += 1) {
    const target = {
      targetType: 'note',
      exerciseId: 'warmup_lip_trill',
      attemptId,
      sequenceIndex,
      sequenceLength: 9,
      midiNote: 60 + sequenceIndex,
      timelineStartedAtMs: 1000 + sequenceIndex * 500,
      durationMs: 450,
    };
    tracker.handleTarget(target);
    for (const offsetMs of [160, 240, 320, 400]) {
      tracker.handleAnalysis(createValidAnalysis(
        target,
        target.timelineStartedAtMs + offsetMs,
        target.midiNote + 0.05,
      ));
    }
  }

  const summary = tracker.handleExerciseEvent({
    type: 'attempt.completed',
    exerciseId: 'warmup_lip_trill',
    attemptId,
    completedAtMs: 6000,
  });

  assert.equal(summary.signalQuality, 'valid');
  assert.equal(summary.metrics.expectedNotes, 9);
  assert.equal(summary.metrics.detectedNotes, 9);
  assert.equal(summary.metrics.missedNotes, 0);
  assert.equal(summary.metrics.stableNotes, 9);
  assert.equal(summary.metrics.withinTolerancePercent, 100);
  assert.equal(summary.metrics.medianDeviationCents, 5);
  assert.equal(tracker.getSnapshot().lipTrillAttempts.length, 1);
});

test('marks a lip trill as insufficient when too few notes contain valid pitch', () => {
  const tracker = new SessionPerformanceTracker();
  const attemptId = 'lip-trill-2';
  startAttempt(tracker, 'warmup_lip_trill', attemptId);

  for (let sequenceIndex = 0; sequenceIndex < 9; sequenceIndex += 1) {
    const target = {
      targetType: 'note',
      exerciseId: 'warmup_lip_trill',
      attemptId,
      sequenceIndex,
      sequenceLength: 9,
      midiNote: 60,
      timelineStartedAtMs: 1000 + sequenceIndex * 500,
      durationMs: 450,
    };
    tracker.handleTarget(target);
    tracker.handleAnalysis({
      signalQuality: 'quiet',
      sample: null,
      capturedAtMs: target.timelineStartedAtMs + 200,
    });
  }

  const summary = tracker.handleExerciseEvent({
    type: 'attempt.completed',
    exerciseId: 'warmup_lip_trill',
    attemptId,
    completedAtMs: 6000,
  });

  assert.equal(summary.signalQuality, 'insufficient');
  assert.equal(summary.metrics.detectedNotes, 0);
  assert.equal(summary.metrics.missedNotes, 9);
});

test('evaluates an octave-aligned siren across both directions', () => {
  const tracker = new SessionPerformanceTracker();
  const attemptId = 'siren-1';
  startAttempt(tracker, 'warmup_sirens', attemptId);

  const targets = [
    {
      targetType: 'glide',
      exerciseId: 'warmup_sirens',
      attemptId,
      sequenceIndex: 0,
      sequenceLength: 2,
      startMidi: 48,
      endMidi: 72,
      timelineStartedAtMs: 1000,
      durationMs: 2200,
    },
    {
      targetType: 'glide',
      exerciseId: 'warmup_sirens',
      attemptId,
      sequenceIndex: 1,
      sequenceLength: 2,
      startMidi: 72,
      endMidi: 48,
      timelineStartedAtMs: 3500,
      durationMs: 2200,
    },
  ];

  for (const target of targets) {
    tracker.handleTarget(target);
    for (let offsetMs = 160; offsetMs <= 2080; offsetMs += 120) {
      const progress = offsetMs / target.durationMs;
      const expectedMidi = target.startMidi + (target.endMidi - target.startMidi) * progress;
      tracker.handleAnalysis(createValidAnalysis(
        target,
        target.timelineStartedAtMs + offsetMs,
        expectedMidi + 12,
      ));
    }
  }

  const summary = tracker.handleExerciseEvent({
    type: 'attempt.completed',
    exerciseId: 'warmup_sirens',
    attemptId,
    completedAtMs: 6000,
  });

  assert.equal(summary.signalQuality, 'valid');
  assert.equal(summary.metrics.completedDirections, 2);
  assert.equal(summary.metrics.continuityPercent, 100);
  assert.equal(summary.metrics.directionMatchPercent, 100);
  assert.equal(summary.metrics.medianContourDeviationCents, 0);
  assert.equal(tracker.getSnapshot().sirenAttempts.length, 1);
});
