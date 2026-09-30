import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_PITCH_TRACKING_CONFIG,
  createPitchAnalyzer,
  frequencyToPitch,
} from '../src/audio/pitchDetector.js';

function createSineWave(frequencyHz, sampleRate, length, amplitude = 0.4) {
  return Float32Array.from(
    { length },
    (_, index) => amplitude * Math.sin((2 * Math.PI * frequencyHz * index) / sampleRate),
  );
}

test('detects a clear A4 signal with frequency and clarity metadata', () => {
  const sampleRate = 24000;
  const analyzer = createPitchAnalyzer();
  const buffer = createSineWave(
    440,
    sampleRate,
    DEFAULT_PITCH_TRACKING_CONFIG.inputLength,
  );

  const result = analyzer.analyze(buffer, sampleRate, {
    audioTime: 12.5,
    capturedAtMs: 4200,
  });

  assert.equal(result.signalQuality, 'valid');
  assert.ok(result.sample);
  assert.ok(Math.abs(result.sample.frequencyHz - 440) < 1);
  assert.equal(result.sample.noteName, 'A4');
  assert.equal(result.sample.midi, 69);
  assert.equal(result.sample.audioTime, 12.5);
  assert.equal(result.sample.capturedAtMs, 4200);
  assert.ok(result.sample.clarity >= DEFAULT_PITCH_TRACKING_CONFIG.minimumClarity);
});

test('rejects silence before running pitch classification', () => {
  const analyzer = createPitchAnalyzer();
  const buffer = new Float32Array(DEFAULT_PITCH_TRACKING_CONFIG.inputLength);

  const result = analyzer.analyze(buffer, 24000);

  assert.equal(result.signalQuality, 'quiet');
  assert.equal(result.sample, null);
  assert.equal(result.rms, 0);
});

test('converts frequency to precise MIDI and cents information', () => {
  const pitch = frequencyToPitch(445);

  assert.equal(pitch.noteName, 'A4');
  assert.equal(pitch.midi, 69);
  assert.ok(pitch.cents > 0);
  assert.equal(pitch.isSharp, true);
});

test('requires the configured Float32Array input length', () => {
  const analyzer = createPitchAnalyzer();

  assert.throws(
    () => analyzer.analyze(new Float32Array(1024), 24000),
    /2048 samples/,
  );
});
