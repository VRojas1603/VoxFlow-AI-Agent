/**
 * Real-time Vocal Pitch Detector using Autocorrelation with Parabolic Peak Interpolation.
 * Optimized for human vocal range (C2: 65 Hz to C6: 1046 Hz).
 */

const NOTE_STRINGS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function freqToNote(freq) {
  const midi = 69 + 12 * Math.log2(freq / 440);
  const roundedMidi = Math.round(midi);
  const cents = Math.round((midi - roundedMidi) * 100);
  const noteIndex = ((roundedMidi % 12) + 12) % 12;
  const octave = Math.floor(roundedMidi / 12) - 1;
  const noteName = `${NOTE_STRINGS[noteIndex]}${octave}`;

  return {
    midi: roundedMidi,
    noteName,
    cents, // -50 to +50 cents
    isSharp: cents > 10,
    isFlat: cents < -10,
    isInTune: Math.abs(cents) <= 10,
  };
}

/**
 * Autocorrelation algorithm to extract fundamental frequency f0 from time-domain audio buffer.
 */
export function autoCorrelate(buffer, sampleRate = 24000) {
  const SIZE = buffer.length;

  // 1. Calculate Root Mean Square (RMS) energy to filter out silence/background noise
  let sumOfSquares = 0;
  for (let i = 0; i < SIZE; i++) {
    const val = buffer[i];
    sumOfSquares += val * val;
  }
  const rms = Math.sqrt(sumOfSquares / SIZE);

  // If too quiet, ignore as silence
  if (rms < 0.02) {
    return null;
  }

  // 2. Trim low-level silence at boundaries
  let r1 = 0;
  let r2 = SIZE - 1;
  const threshold = 0.2;
  for (let i = 0; i < SIZE / 2; i++) {
    if (Math.abs(buffer[i]) < threshold) {
      r1 = i;
      break;
    }
  }
  for (let i = 1; i < SIZE / 2; i++) {
    if (Math.abs(buffer[SIZE - i]) < threshold) {
      r2 = SIZE - i;
      break;
    }
  }

  const trimmedBuffer = buffer.slice(r1, r2);
  const c = new Float32Array(trimmedBuffer.length);

  // 3. Autocorrelation over lags
  for (let i = 0; i < trimmedBuffer.length; i++) {
    for (let j = 0; j < trimmedBuffer.length - i; j++) {
      c[i] = c[i] + trimmedBuffer[j] * trimmedBuffer[j + i];
    }
  }

  // 4. Find the first dip
  let d = 0;
  while (c[d] > c[d + 1]) {
    d++;
  }

  // 5. Find the maximum correlation peak after the dip
  let maxval = -1;
  let maxpos = -1;
  for (let i = d; i < trimmedBuffer.length; i++) {
    if (c[i] > maxval) {
      maxval = c[i];
      maxpos = i;
    }
  }

  let T0 = maxpos;

  // 6. Parabolic peak interpolation for sub-sample precision
  if (T0 > 0 && T0 < trimmedBuffer.length - 1) {
    const x1 = c[T0 - 1];
    const x2 = c[T0];
    const x3 = c[T0 + 1];
    const a = (x1 + x3 - 2 * x2) / 2;
    const b = (x3 - x1) / 2;
    if (a) {
      T0 = T0 - b / (2 * a);
    }
  }

  const freq = sampleRate / T0;

  // Filter vocal range (approx 65 Hz to 1100 Hz)
  if (freq >= 65 && freq <= 1100) {
    const noteInfo = freqToNote(freq);
    return {
      freq: Math.round(freq * 10) / 10,
      rms: Math.round(rms * 100) / 100,
      ...noteInfo,
    };
  }

  return null;
}
