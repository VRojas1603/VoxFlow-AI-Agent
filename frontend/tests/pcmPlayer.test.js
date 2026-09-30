import assert from 'node:assert/strict';
import test from 'node:test';

import { StreamingPCMPlayer } from '../src/audio/pcmPlayer.js';

test('waitForIdle resolves immediately when no voice audio is queued', async () => {
  const player = new StreamingPCMPlayer();

  const result = await player.waitForIdle();

  assert.deepEqual(result, { timedOut: false });
});

test('waitForIdle resolves after the queued voice audio finishes', async () => {
  const player = new StreamingPCMPlayer();
  player.activeSources.push({});

  const idlePromise = player.waitForIdle(100);
  player.activeSources = [];
  player.resolveIdleWaiters();

  assert.deepEqual(await idlePromise, { timedOut: false });
  assert.equal(player.idleWaiters.size, 0);
});

test('waitForIdle reports a timeout when playback never drains', async () => {
  const player = new StreamingPCMPlayer();
  player.activeSources.push({});

  const result = await player.waitForIdle(5);

  assert.deepEqual(result, { timedOut: true });
  assert.equal(player.idleWaiters.size, 0);
});
