import { PitchDetector } from 'pitchy';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const DEFAULT_PITCH_TRACKING_CONFIG = Object.freeze({
  inputLength: 2048,
  minimumFrequencyHz: 65,
  maximumFrequencyHz: 1100,
  minimumClarity: 0.85,
  minimumRms: 0.015,
});

export function calculateRms(buffer) {
  if (!buffer?.length) return 0;

  let sumOfSquares = 0;
  for (let index = 0; index < buffer.length; index += 1) {
    sumOfSquares += buffer[index] * buffer[index];
  }

  return Math.sqrt(sumOfSquares / buffer.length);
}

export function frequencyToPitch(frequencyHz) {
  const midiFloat = 69 + 12 * Math.log2(frequencyHz / 440);
  const midi = Math.round(midiFloat);
  const cents = Math.round((midiFloat - midi) * 100);
  const noteIndex = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;

  return {
    midi,
    midiFloat,
    noteName: `${NOTE_NAMES[noteIndex]}${octave}`,
    cents,
    isSharp: cents > 10,
    isFlat: cents < -10,
    isInTune: Math.abs(cents) <= 10,
  };
}

// Backward-compatible export for existing imports and external callers.
export const freqToNote = frequencyToPitch;

export function createPitchAnalyzer(overrides = {}) {
  const config = {
    ...DEFAULT_PITCH_TRACKING_CONFIG,
    ...overrides,
  };
  const detector = PitchDetector.forFloat32Array(config.inputLength);

  return {
    inputLength: config.inputLength,

    analyze(buffer, sampleRate = 24000, options = {}) {
      if (!(buffer instanceof Float32Array) || buffer.length !== config.inputLength) {
        throw new TypeError(`Pitch analysis requires a Float32Array of ${config.inputLength} samples.`);
      }

      const rms = calculateRms(buffer);
      const minimumRms = Math.max(config.minimumRms, options.minimumRms || 0);

      if (rms < minimumRms) {
        return {
          sample: null,
          signalQuality: 'quiet',
          rms,
          clarity: 0,
        };
      }

      const [frequencyHz, clarity] = detector.findPitch(buffer, sampleRate);

      if (!Number.isFinite(frequencyHz) || frequencyHz <= 0 || clarity < config.minimumClarity) {
        return {
          sample: null,
          signalQuality: 'unclear',
          rms,
          clarity: Number.isFinite(clarity) ? clarity : 0,
        };
      }

      if (
        frequencyHz < config.minimumFrequencyHz
        || frequencyHz > config.maximumFrequencyHz
      ) {
        return {
          sample: null,
          signalQuality: 'out_of_range',
          rms,
          clarity,
        };
      }

      const pitch = frequencyToPitch(frequencyHz);
      return {
        signalQuality: 'valid',
        rms,
        clarity,
        sample: {
          audioTime: options.audioTime ?? null,
          capturedAtMs: options.capturedAtMs ?? null,
          frequencyHz,
          freq: Math.round(frequencyHz * 10) / 10,
          rms,
          clarity,
          signalQuality: 'valid',
          ...pitch,
        },
      };
    },
  };
}
