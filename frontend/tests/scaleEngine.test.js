import assert from 'node:assert/strict';
import test from 'node:test';

import { ScaleEngine } from '../src/audio/scaleEngine.js';

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
