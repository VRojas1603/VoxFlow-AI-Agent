import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ACCOMPANIMENT_START_PHASES,
  AccompanimentStartCoordinator,
} from '../src/audio/accompanimentStartCoordinator.js';

class FakeScheduler {
  constructor() {
    this.now = 0;
    this.nextId = 1;
    this.tasks = new Map();
  }

  setTimeout(callback, delay) {
    const id = this.nextId++;
    this.tasks.set(id, { callback, dueAt: this.now + delay });
    return id;
  }

  clearTimeout(id) {
    this.tasks.delete(id);
  }

  advance(milliseconds) {
    const targetTime = this.now + milliseconds;
    while (true) {
      const nextTask = Array.from(this.tasks.entries())
        .filter(([, task]) => task.dueAt <= targetTime)
        .sort((left, right) => left[1].dueAt - right[1].dueAt)[0];
      if (!nextTask) break;

      const [id, task] = nextTask;
      this.tasks.delete(id);
      this.now = task.dueAt;
      task.callback();
    }
    this.now = targetTime;
  }
}

function createCoordinator(overrides = {}) {
  const events = [];
  const scheduler = new FakeScheduler();
  const coordinator = new AccompanimentStartCoordinator({
    countdownSeconds: 3,
    tickIntervalMs: 1000,
    voiceWaitTimeoutMs: 15000,
    postCueDelayMs: 250,
    setTimer: scheduler.setTimeout.bind(scheduler),
    clearTimer: scheduler.clearTimeout.bind(scheduler),
    startPlayback: (exerciseId) => events.push(`start:${exerciseId}`),
    playReadyCue: () => events.push('cue'),
    onStateChange: (state) => events.push(`state:${state.phase}:${state.secondsRemaining}`),
    onTimeout: () => events.push('timeout'),
    ...overrides,
  });
  return { coordinator, events, scheduler };
}

test('default browser timers retain their required global receiver', () => {
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  let scheduledTimer = null;
  let clearedTimer = null;

  globalThis.setTimeout = function browserSetTimeout(callback, delay) {
    assert.equal(this, globalThis);
    scheduledTimer = { callback, delay };
    return 42;
  };
  globalThis.clearTimeout = function browserClearTimeout(timerId) {
    assert.equal(this, globalThis);
    clearedTimer = timerId;
  };

  try {
    const coordinator = new AccompanimentStartCoordinator({
      startPlayback: () => {},
      playReadyCue: () => {},
    });

    coordinator.requestStart({
      source: 'manual',
      exerciseId: 'warmup_breathing',
    });

    assert.equal(scheduledTimer?.delay, 1000);
    coordinator.cancel();
    assert.equal(clearedTimer, 42);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
});

test('manual playback starts only after the full countdown', () => {
  const { coordinator, events, scheduler } = createCoordinator();

  coordinator.requestStart({ source: 'manual', exerciseId: 'warmup_breathing' });
  assert.equal(coordinator.getSnapshot().secondsRemaining, 3);
  assert.equal(events.includes('start:warmup_breathing'), false);

  scheduler.advance(2999);
  assert.equal(events.includes('start:warmup_breathing'), false);
  scheduler.advance(1);

  assert.equal(coordinator.getSnapshot().phase, ACCOMPANIMENT_START_PHASES.PLAYING);
  assert.equal(events.includes('start:warmup_breathing'), true);
  assert.equal(events.includes('cue'), false);
  coordinator.cancel();
});

test('voice playback waits for the countdown when Lyra finishes early', () => {
  const { coordinator, events, scheduler } = createCoordinator();

  coordinator.requestStart({ source: 'voice', exerciseId: 'warmup_lip_trill' });
  coordinator.notifyVoiceStarted();
  coordinator.notifyVoiceReady();
  assert.equal(events.includes('start:warmup_lip_trill'), false);

  scheduler.advance(3000);

  assert.equal(events.includes('start:warmup_lip_trill'), true);
  assert.equal(events.includes('cue'), false);
  coordinator.cancel();
});

test('voice playback uses the ready cue when Lyra exceeds the countdown', async () => {
  const { coordinator, events, scheduler } = createCoordinator();

  coordinator.requestStart({ source: 'voice', exerciseId: 'warmup_sirens' });
  scheduler.advance(3000);
  assert.equal(
    coordinator.getSnapshot().phase,
    ACCOMPANIMENT_START_PHASES.WAITING_FOR_VOICE,
  );

  coordinator.notifyVoiceStarted();
  coordinator.notifyVoiceReady();
  await new Promise((resolve) => setImmediate(resolve));
  scheduler.advance(250);

  assert.deepEqual(
    events.filter((event) => event === 'cue' || event.startsWith('start:')),
    ['cue', 'start:warmup_sirens'],
  );
  coordinator.cancel();
});

test('the tool-call reply completion is ignored before the spoken confirmation starts', () => {
  const { coordinator, events, scheduler } = createCoordinator();

  coordinator.requestStart({ source: 'voice', exerciseId: 'warmup_lip_trill' });
  assert.equal(coordinator.notifyVoiceReady(), false);
  scheduler.advance(3000);

  assert.equal(
    coordinator.getSnapshot().phase,
    ACCOMPANIMENT_START_PHASES.WAITING_FOR_VOICE,
  );
  assert.equal(events.some((event) => event.startsWith('start:')), false);
  coordinator.cancel();
});

test('cancelling a pending start prevents playback', () => {
  const { coordinator, events, scheduler } = createCoordinator();

  coordinator.requestStart({ source: 'manual', exerciseId: 'song_practice' });
  assert.equal(coordinator.cancel(), true);
  scheduler.advance(3000);

  assert.equal(events.some((event) => event.startsWith('start:')), false);
  assert.equal(coordinator.getSnapshot().phase, ACCOMPANIMENT_START_PHASES.IDLE);
});

test('duplicate starts are rejected while a countdown is active', () => {
  const { coordinator } = createCoordinator();

  const first = coordinator.requestStart({ source: 'manual', exerciseId: 'song_practice' });
  const duplicate = coordinator.requestStart({ source: 'voice', exerciseId: 'song_practice' });

  assert.equal(first.accepted, true);
  assert.equal(duplicate.accepted, false);
  assert.equal(duplicate.phase, ACCOMPANIMENT_START_PHASES.COUNTDOWN);
  coordinator.cancel();
});

test('a missing voice completion cancels the scheduled start', () => {
  const { coordinator, events, scheduler } = createCoordinator();

  coordinator.requestStart({ source: 'voice', exerciseId: 'warmup_breathing' });
  scheduler.advance(18000);

  assert.equal(coordinator.getSnapshot().phase, ACCOMPANIMENT_START_PHASES.IDLE);
  assert.equal(events.includes('timeout'), true);
  assert.equal(events.some((event) => event.startsWith('start:')), false);
});
