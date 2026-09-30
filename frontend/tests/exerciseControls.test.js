import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyExerciseSelection,
  upsertCoveredTip,
} from '../src/audio/exerciseControls.js';

test('selecting an exercise stops playback before changing the engine', () => {
  const calls = [];
  const engine = {
    currentExercise: 'warmup_lip_trill',
    isPlaying: true,
    stop() {
      calls.push('stop');
      this.isPlaying = false;
    },
    setExercise(exerciseId) {
      calls.push(`select:${exerciseId}`);
      this.currentExercise = exerciseId;
    },
  };

  const result = applyExerciseSelection(engine, 'warmup_sirens');

  assert.deepEqual(calls, ['stop', 'select:warmup_sirens']);
  assert.equal(engine.isPlaying, false);
  assert.equal(result.playback, 'stopped');
  assert.equal(result.exercise_name, 'Vocal Sirens');
});

test('selecting the active exercise still stops playback safely', () => {
  let stopCalls = 0;
  const engine = {
    currentExercise: 'warmup_lip_trill',
    isPlaying: true,
    stop() {
      stopCalls += 1;
      this.isPlaying = false;
    },
    setExercise() {},
  };

  const result = applyExerciseSelection(engine, 'warmup_lip_trill');

  assert.equal(stopCalls, 1);
  assert.equal(result.applied, true);
});

test('rejects unknown exercises', () => {
  assert.throws(
    () => applyExerciseSelection({}, 'unknown'),
    /Unsupported exercise/,
  );
});

test('covered tips keep one latest entry per technique', () => {
  const first = {
    tipType: 'lip_trill',
    title: 'Lip Trill',
    explanation: 'First explanation',
  };
  const latest = {
    tipType: 'lip_trill',
    title: 'Lip Trill',
    explanation: 'Updated explanation',
  };

  const initial = upsertCoveredTip([], first);
  const updated = upsertCoveredTip(initial, latest);

  assert.equal(updated.length, 1);
  assert.equal(updated[0].explanation, 'Updated explanation');
});
