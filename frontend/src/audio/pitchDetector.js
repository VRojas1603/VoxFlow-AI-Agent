import { PitchDetector } from 'pitchy';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const DEFAULT_PITCH_TRACKING_CONFIG = Object.freeze({
  inputLength: 2048,
  minimumFrequencyHz: 65,
  maximumFrequencyHz: 1100,
  minimumClarity: 0.85,
  minimumRms: 0.015,
  clarityThreshold: 0.9,
  noiseFloorMultiplier: 2.5,
  medianWindowSize: 1,
  octaveJumpGuard: false,
});

export const LIP_TRILL_PITCH_TRACKING_CONFIG = Object.freeze({
  ...DEFAULT_PITCH_TRACKING_CONFIG,
  inputLength: 4096,
  minimumClarity: 0.65,
  minimumRms: 0.008,
  clarityThreshold: 0.8,
  noiseFloorMultiplier: 1.75,
  medianWindowSize: 3,
  octaveJumpGuard: true,
});

export const PITCH_TRACKING_PROFILES = Object.freeze({
  default: DEFAULT_PITCH_TRACKING_CONFIG,
  lip_trill: LIP_TRILL_PITCH_TRACKING_CONFIG,
});

export function getPitchTrackingConfig(profile = 'default') {
  return PITCH_TRACKING_PROFILES[profile] || DEFAULT_PITCH_TRACKING_CONFIG;
}

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
  detector.clarityThreshold = config.clarityThreshold;

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
          audioTime: options.audioTime ?? null,
          capturedAtMs: options.capturedAtMs ?? null,
          rms,
          clarity: 0,
        };
      }

      const [frequencyHz, clarity] = detector.findPitch(buffer, sampleRate);

      if (!Number.isFinite(frequencyHz) || frequencyHz <= 0 || clarity < config.minimumClarity) {
        return {
          sample: null,
          signalQuality: 'unclear',
          audioTime: options.audioTime ?? null,
          capturedAtMs: options.capturedAtMs ?? null,
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
          audioTime: options.audioTime ?? null,
          capturedAtMs: options.capturedAtMs ?? null,
          rms,
          clarity,
        };
      }

      const pitch = frequencyToPitch(frequencyHz);
      return {
        signalQuality: 'valid',
        audioTime: options.audioTime ?? null,
        capturedAtMs: options.capturedAtMs ?? null,
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

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function midiToFrequency(midiFloat) {
  return 440 * (2 ** ((midiFloat - 69) / 12));
}

export function createPitchSampleStabilizer({
  medianWindowSize = 1,
  octaveJumpGuard = false,
} = {}) {
  let recentMidiValues = [];
  let previousMidi = null;

  return {
    reset() {
      recentMidiValues = [];
      previousMidi = null;
    },

    stabilize(sample) {
      let candidateMidi = sample.midiFloat;
      if (octaveJumpGuard && Number.isFinite(previousMidi)) {
        const candidates = [candidateMidi, candidateMidi - 12, candidateMidi + 12];
        const closest = candidates.reduce((best, candidate) => (
          Math.abs(candidate - previousMidi) < Math.abs(best - previousMidi)
            ? candidate
            : best
        ));
        if (
          Math.abs(candidateMidi - previousMidi) >= 7
          && Math.abs(closest - previousMidi) <= 4
        ) {
          candidateMidi = closest;
        }
      }

      recentMidiValues.push(candidateMidi);
      if (recentMidiValues.length > medianWindowSize) recentMidiValues.shift();
      const stabilizedMidi = median(recentMidiValues);
      const frequencyHz = midiToFrequency(stabilizedMidi);
      previousMidi = stabilizedMidi;

      return {
        ...sample,
        frequencyHz,
        freq: Math.round(frequencyHz * 10) / 10,
        ...frequencyToPitch(frequencyHz),
      };
    },
  };
}
