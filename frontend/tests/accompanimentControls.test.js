import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_ACCOMPANIMENT_STATE,
  applyAccompanimentAdjustment,
  resetAccompanimentEngine,
} from '../src/audio/accompanimentControls.js';

test('applies relative pitch changes to the current key', () => {
  const lowered = applyAccompanimentAdjustment(DEFAULT_ACCOMPANIMENT_STATE, {
    control: 'pitch',
    operation: 'decrease',
    value: 2,
  });
  const restored = applyAccompanimentAdjustment(lowered.state, {
    control: 'pitch',
    operation: 'increase',
    value: 2,
  });

  assert.equal(lowered.currentValue, -2);
  assert.equal(restored.currentValue, 0);
});

test('supports relative and absolute speed changes', () => {
  const slower = applyAccompanimentAdjustment(DEFAULT_ACCOMPANIMENT_STATE, {
    control: 'speed',
    operation: 'set',
    value: 0.85,
  });
  const increased = applyAccompanimentAdjustment(slower.state, {
    control: 'speed',
    operation: 'increase',
  });
  const explicit = applyAccompanimentAdjustment(increased.state, {
    control: 'speed',
    operation: 'set',
    value: 1.15,
  });

  assert.equal(increased.currentValue, 1);
  assert.equal(explicit.currentValue, 1.15);
});

test('adjusts volume in percentage points', () => {
  const result = applyAccompanimentAdjustment(DEFAULT_ACCOMPANIMENT_STATE, {
    control: 'volume',
    operation: 'increase',
  });

  assert.equal(result.previousValue, 40);
  assert.equal(result.currentValue, 50);
  assert.equal(result.state.volume, 0.5);
});

test('clamps controls and reports no-op changes', () => {
  const atLimit = { pitchShift: 6, speed: 2, volume: 1 };
  const pitch = applyAccompanimentAdjustment(atLimit, {
    control: 'pitch',
    operation: 'increase',
    value: 2,
  });
  const speed = applyAccompanimentAdjustment(atLimit, {
    control: 'speed',
    operation: 'increase',
    value: 0.5,
  });
  const volume = applyAccompanimentAdjustment(atLimit, {
    control: 'volume',
    operation: 'increase',
    value: 10,
  });

  assert.equal(pitch.changed, false);
  assert.equal(speed.changed, false);
  assert.equal(volume.changed, false);
});

test('rejects invalid operations and values', () => {
  assert.throws(
    () => applyAccompanimentAdjustment(DEFAULT_ACCOMPANIMENT_STATE, {
      control: 'pitch',
      operation: 'set',
      value: 1.5,
    }),
    /whole semitones/,
  );
  assert.throws(
    () => applyAccompanimentAdjustment(DEFAULT_ACCOMPANIMENT_STATE, {
      control: 'speed',
      operation: 'set',
    }),
    /requires a numeric value/,
  );
});

test('resets every accompaniment setting before a new session', () => {
  const calls = [];
  const engine = {
    stop: () => calls.push(['stop']),
    setExercise: (value) => calls.push(['exercise', value]),
    setPitchShift: (value) => calls.push(['pitch', value]),
    setSpeed: (value) => calls.push(['speed', value]),
    setVolume: (value) => calls.push(['volume', value]),
  };

  const state = resetAccompanimentEngine(engine);

  assert.deepEqual(state, DEFAULT_ACCOMPANIMENT_STATE);
  assert.deepEqual(calls, [
    ['stop'],
    ['exercise', 'warmup_breathing'],
    ['pitch', 0],
    ['speed', 1],
    ['volume', 0.4],
  ]);
});
