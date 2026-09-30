import assert from 'node:assert/strict';
import test from 'node:test';

import { shouldPauseAgentAudio } from '../src/audio/guidedCapture.js';

test('pauses agent audio forwarding during every exercise countdown', () => {
  for (const exerciseId of [
    'warmup_breathing',
    'warmup_lip_trill',
    'warmup_sirens',
    'notes_practice',
  ]) {
    assert.equal(shouldPauseAgentAudio({ phase: 'countdown', exerciseId }), true);
    assert.equal(shouldPauseAgentAudio({ phase: 'waiting_for_voice', exerciseId }), true);
  }
});

test('keeps agent audio paused only for active guided pitch attempts', () => {
  assert.equal(shouldPauseAgentAudio({ phase: 'playing', exerciseId: 'warmup_lip_trill' }), true);
  assert.equal(shouldPauseAgentAudio({ phase: 'playing', exerciseId: 'warmup_sirens' }), true);
  assert.equal(shouldPauseAgentAudio({ phase: 'playing', exerciseId: 'warmup_breathing' }), false);
  assert.equal(shouldPauseAgentAudio({ phase: 'playing', exerciseId: 'notes_practice' }), true);
  assert.equal(shouldPauseAgentAudio({ phase: 'idle', exerciseId: 'warmup_lip_trill' }), false);
});
