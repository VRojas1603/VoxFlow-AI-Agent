import assert from 'node:assert/strict';
import test from 'node:test';

import { ScaleEngine } from '../src/audio/scaleEngine.js';

function createAudioParam() {
  return {
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {},
  };
}

function createAudioNode() {
  return {
    frequency: createAudioParam(),
    gain: createAudioParam(),
    connect() {},
    addEventListener() {},
    start() {},
    stop() {},
  };
}

function attachFakeAudioContext(engine) {
  engine.audioCtx = {
    state: 'running',
    currentTime: 12.5,
    createOscillator: createAudioNode,
    createGain: createAudioNode,
    createBiquadFilter: createAudioNode,
  };
  engine.masterGain = createAudioNode();
}

test('stop cancels playback timers and active audio sources', () => {
  const engine = new ScaleEngine();
  let noteChange = 'not-cleared';
  let sourceStops = 0;
  const source = {
    stop() {
      sourceStops += 1;
    },
  };

  engine.isPlaying = true;
  engine.timerId = setTimeout(() => {}, 10_000);
  const scheduledTimeout = setTimeout(() => {}, 10_000);
  engine.scheduledTimeouts.add(scheduledTimeout);
  engine.activeSources.add(source);
  engine.onNoteChange((note) => {
    noteChange = note;
  });

  engine.stop();

  assert.equal(engine.isPlaying, false);
  assert.equal(engine.timerId, null);
  assert.equal(engine.scheduledTimeouts.size, 0);
  assert.equal(engine.activeSources.size, 0);
  assert.equal(sourceStops, 1);
  assert.equal(noteChange, null);
});

test('stop remains safe when an audio source already ended', () => {
  const engine = new ScaleEngine();
  engine.activeSources.add({
    stop() {
      throw new Error('already stopped');
    },
  });

  assert.doesNotThrow(() => engine.stop());
  assert.equal(engine.activeSources.size, 0);
});

test('emits synchronized note targets with attempt and sequence metadata', () => {
  const engine = new ScaleEngine();
  attachFakeAudioContext(engine);
  engine.currentExercise = 'warmup_lip_trill';
  engine.pitchShift = -2;
  let target = null;
  const unsubscribe = engine.onTargetChange((nextTarget) => {
    target = nextTarget;
  });

  engine.playSynthNote(60, 0.45, 0.75, {
    attemptId: 'lip-trill-1',
    sequenceIndex: 3,
    sequenceLength: 9,
  });

  assert.equal(target.eventType, 'target.started');
  assert.equal(target.targetType, 'note');
  assert.equal(target.exerciseId, 'warmup_lip_trill');
  assert.equal(target.attemptId, 'lip-trill-1');
  assert.equal(target.startedAt, 12.5);
  assert.ok(Number.isFinite(target.timelineStartedAtMs));
  assert.equal(target.durationMs, 450);
  assert.equal(target.sequenceIndex, 3);
  assert.equal(target.sequenceLength, 9);
  assert.equal(target.noteName, 'A#3');
  assert.equal(target.midiNote, 58);

  unsubscribe();
});

test('emits glide targets with direction and frequency boundaries', () => {
  const engine = new ScaleEngine();
  attachFakeAudioContext(engine);
  engine.currentExercise = 'warmup_sirens';
  let target = null;
  engine.onTargetChange((nextTarget) => {
    target = nextTarget;
  });

  engine.playGlissando(48, 72, 2.2, {
    attemptId: 'siren-1',
    sequenceIndex: 0,
    sequenceLength: 2,
  });

  assert.equal(target.targetType, 'glide');
  assert.equal(target.direction, 'up');
  assert.equal(target.startMidi, 48);
  assert.equal(target.endMidi, 72);
  assert.equal(target.durationMs, 2200);
  assert.ok(target.endFrequencyHz > target.startFrequencyHz);
});

test('ready cue does not emit targets or create exercise attempts', async () => {
  const engine = new ScaleEngine();
  attachFakeAudioContext(engine);
  let targetEvents = 0;
  let exerciseEvents = 0;
  engine.onTargetChange(() => {
    targetEvents += 1;
  });
  engine.onExerciseEvent(() => {
    exerciseEvents += 1;
  });

  await engine.playReadyCue();

  assert.equal(targetEvents, 0);
  assert.equal(exerciseEvents, 0);
  assert.equal(engine.attemptSequence, 0);
});

test('stops automatically after one complete guided lip trill attempt', () => {
  const engine = new ScaleEngine();
  attachFakeAudioContext(engine);
  engine.currentExercise = 'warmup_lip_trill';
  engine.isPlaying = true;
  engine.stepIndex = 8;
  engine.ensureAttemptId();
  const events = [];
  engine.onExerciseEvent((event) => events.push(event));
  const originalSetTimeout = globalThis.setTimeout;
  let scheduledCallback = null;
  let scheduledDelay = null;
  globalThis.setTimeout = (callback, delay) => {
    scheduledCallback = callback;
    scheduledDelay = delay;
    return 1;
  };

  try {
    engine.runLoopStep();
    assert.equal(scheduledDelay, 800);
    assert.equal(engine.isPlaying, true);

    scheduledCallback();

    assert.equal(engine.isPlaying, false);
    assert.ok(events.some((event) => event.type === 'attempt.completed'));
    assert.ok(events.some((event) => (
      event.type === 'playback.stopped' && event.reason === 'completed'
    )));
    assert.equal(events.some((event) => event.type === 'attempt.cancelled'), false);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    engine.stop();
  }
});
