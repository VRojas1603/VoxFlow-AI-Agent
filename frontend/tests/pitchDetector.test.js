import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_PITCH_TRACKING_CONFIG,
  LIP_TRILL_PITCH_TRACKING_CONFIG,
  createPitchAnalyzer,
  createPitchSampleStabilizer,
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

test('detects an amplitude-modulated lip trill signal with the lip trill profile', () => {
  assert.equal(LIP_TRILL_PITCH_TRACKING_CONFIG.inputLength, 4096);
  assert.equal(LIP_TRILL_PITCH_TRACKING_CONFIG.clarityThreshold, 0.8);
  assert.equal(LIP_TRILL_PITCH_TRACKING_CONFIG.minimumClarity, 0.65);
  assert.equal(LIP_TRILL_PITCH_TRACKING_CONFIG.minimumRms, 0.008);
  assert.equal(LIP_TRILL_PITCH_TRACKING_CONFIG.noiseFloorMultiplier, 1.75);
  const sampleRate = 24000;
  const analyzer = createPitchAnalyzer(LIP_TRILL_PITCH_TRACKING_CONFIG);
  const buffer = new Float32Array(LIP_TRILL_PITCH_TRACKING_CONFIG.inputLength);
  for (let index = 0; index < buffer.length; index += 1) {
    const time = index / sampleRate;
    const lipModulation = 0.35 + 0.65 * ((Math.sin(2 * Math.PI * 24 * time) + 1) / 2);
    buffer[index] = 0.16 * lipModulation * Math.sin(2 * Math.PI * 220 * time);
  }

  const result = analyzer.analyze(buffer, sampleRate);

  assert.equal(result.signalQuality, 'valid');
  assert.ok(Math.abs(result.sample.frequencyHz - 220) < 4);
  assert.ok(result.sample.clarity >= LIP_TRILL_PITCH_TRACKING_CONFIG.minimumClarity);
});

test('lip trill stabilization removes isolated octave jumps and resets per target', () => {
  const stabilizer = createPitchSampleStabilizer({
    medianWindowSize: 3,
    octaveJumpGuard: true,
  });
  const sample = (midiFloat) => ({ midiFloat, frequencyHz: 440, clarity: 0.9, rms: 0.1 });

  stabilizer.stabilize(sample(60));
  stabilizer.stabilize(sample(60.2));
  const guarded = stabilizer.stabilize(sample(72.1));
  assert.ok(Math.abs(guarded.midiFloat - 60.1) < 0.2);

  stabilizer.reset();
  const nextTarget = stabilizer.stabilize(sample(72));
  assert.equal(nextTarget.midiFloat, 72);
});
