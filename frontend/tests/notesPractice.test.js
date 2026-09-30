import assert from 'node:assert/strict';
import test from 'node:test';

import {
  NotesPracticeTracker,
  createNotesPracticeTargets,
} from '../src/audio/notesPractice.js';

function sample(midiFloat, capturedAtMs) {
  return {
    signalQuality: 'valid',
    sample: {
      midiFloat,
      frequencyHz: 440 * Math.pow(2, (midiFloat - 69) / 12),
      capturedAtMs,
    },
  };
}

function holdTarget(tracker, midiNote, startAtMs) {
  for (let offset = 0; offset <= 520; offset += 40) {
    tracker.handleAnalysis(sample(midiNote, startAtMs + offset));
  }
}

test('starts with four lower notes between approximately 185 and 247 Hz', () => {
  const targets = createNotesPracticeTargets(0);

  assert.deepEqual(
    targets.map((target) => target.noteName),
    ['F#3', 'G#3', 'A#3', 'B3'],
  );
  assert.deepEqual(
    targets.map((target) => target.frequencyHz),
    [185, 207.7, 233.1, 246.9],
  );
});

test('transposes all four lower targets with the key control', () => {
  assert.deepEqual(
    createNotesPracticeTargets(-2).map((target) => target.noteName),
    ['E3', 'F#3', 'G#3', 'A3'],
  );
});

test('completes notes sequentially after holding within tolerance', () => {
  const summaries = [];
  const tracker = new NotesPracticeTracker({
    onAttemptComplete: (summary) => summaries.push(summary),
  });
  tracker.start(0, 1000);

  holdTarget(tracker, 56, 1000);
  assert.equal(tracker.getSnapshot().activeIndex, 0);

  holdTarget(tracker, 54, 2000);
  assert.equal(tracker.getSnapshot().targets[0].status, 'done');
  assert.equal(tracker.getSnapshot().activeIndex, 1);

  holdTarget(tracker, 56, 3000);
  holdTarget(tracker, 58, 4000);
  holdTarget(tracker, 59, 5000);

  assert.equal(tracker.getSnapshot().status, 'completed');
  assert.equal(summaries.length, 1);
  assert.equal(summaries[0].metrics.completedNotes, 4);
  assert.equal(summaries[0].metrics.completionPercent, 100);
});

test('resets hold progress after a gap longer than 120 ms', () => {
  const tracker = new NotesPracticeTracker();
  tracker.start(0, 1000);
  tracker.handleAnalysis(sample(54, 1000));
  tracker.handleAnalysis(sample(54, 1080));
  tracker.handleAnalysis(sample(54, 1280));

  assert.equal(tracker.getSnapshot().targets[0].holdProgress, 0);
});

test('records partial attempts and discards empty attempts', () => {
  const summaries = [];
  const tracker = new NotesPracticeTracker({
    onAttemptComplete: (summary) => summaries.push(summary),
  });
  tracker.start(0, 1000);
  assert.equal(tracker.stop(1200).recorded, false);

  tracker.start(0, 2000);
  holdTarget(tracker, 54, 2000);
  const result = tracker.stop(3000);

  assert.equal(result.recorded, true);
  assert.equal(result.summary.signalQuality, 'partial');
  assert.equal(result.summary.metrics.completedNotes, 1);
  assert.equal(summaries.length, 1);
});
