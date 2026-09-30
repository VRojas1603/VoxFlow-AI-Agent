/**
 * Web Audio Scale & Accompaniment Synthesis Engine for VoxFlow.
 * Generates acoustic piano-style warm-up scales, metronome pulses, and chord progressions.
 */

// Frequency lookup helper for MIDI notes (A4 = 440 Hz, MIDI 69)
export function midiToFreq(midiNote) {
  return 440 * Math.pow(2, (midiNote - 69) / 12);
}

// Convert MIDI number to Note Name (e.g. 60 -> "C4", 62 -> "D4")
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export function midiToNoteName(midiNote) {
  const noteIndex = (midiNote % 12 + 12) % 12;
  const octave = Math.floor(midiNote / 12) - 1;
  return `${NOTE_NAMES[noteIndex]}${octave}`;
}

export class ScaleEngine {
  constructor() {
    this.audioCtx = null;
    this.masterGain = null;
    this.isPlaying = false;
    this.currentExercise = 'warmup_breathing';
    this.pitchShift = 0; // in semitones (-3 to +3)
    this.speed = 1.0; // 0.8 to 1.2
    this.volume = 0.4;
    this.timerId = null;
    this.stepIndex = 0;
    this.baseKeyOffset = 0; // For automatic ascension in lip trills
    this.onNoteChangeCallback = null;
    this.activeSources = new Set();
    this.scheduledTimeouts = new Set();
  }

  init() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContextClass();
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.audioCtx.currentTime);
      this.masterGain.connect(this.audioCtx.destination);
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.audioCtx) {
      this.masterGain.gain.setValueAtTime(this.volume, this.audioCtx.currentTime);
    }
  }

  setPitchShift(shift) {
    this.pitchShift = shift;
  }

  setSpeed(speedFactor) {
    this.speed = Math.max(0.5, Math.min(2.0, speedFactor));
  }

  setExercise(exerciseId) {
    const changed = this.currentExercise !== exerciseId;
    this.currentExercise = exerciseId;
    this.stepIndex = 0;
    this.baseKeyOffset = 0;
    if (changed && this.isPlaying) {
      this.stop();
      this.start(exerciseId);
    }
  }

  onNoteChange(cb) {
    this.onNoteChangeCallback = cb;
  }

  trackSource(source) {
    this.activeSources.add(source);
    source.addEventListener('ended', () => {
      this.activeSources.delete(source);
    }, { once: true });
    return source;
  }

  /**
   * Synthesize a single acoustic note with a warm, natural piano-like ADSR envelope.
   */
  playSynthNote(midiNote, durationSec, velocity = 0.8) {
    if (!this.audioCtx || this.audioCtx.state === 'suspended') {
      this.init();
    }
    const freq = midiToFreq(midiNote + this.pitchShift);
    const now = this.audioCtx.currentTime;

    // Dual-oscillator for warmth (fundamental + soft octave harmonic)
    const osc1 = this.audioCtx.createOscillator();
    const osc2 = this.audioCtx.createOscillator();
    const noteGain = this.audioCtx.createGain();

    osc1.type = 'triangle'; // Rich fundamental
    osc1.frequency.setValueAtTime(freq, now);

    osc2.type = 'sine'; // Warm harmonic
    osc2.frequency.setValueAtTime(freq * 2, now);

    // ADSR Envelope: Fast attack, natural decay
    noteGain.gain.setValueAtTime(0, now);
    noteGain.gain.linearRampToValueAtTime(velocity * 0.7, now + 0.03); // Attack
    noteGain.gain.exponentialRampToValueAtTime(velocity * 0.4, now + 0.15); // Decay
    noteGain.gain.exponentialRampToValueAtTime(0.001, now + durationSec); // Release

    osc1.connect(noteGain);
    osc2.connect(noteGain);
    noteGain.connect(this.masterGain);

    this.trackSource(osc1);
    this.trackSource(osc2);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + durationSec + 0.05);
    osc2.stop(now + durationSec + 0.05);

    if (this.onNoteChangeCallback) {
      const noteName = midiToNoteName(midiNote + this.pitchShift);
      this.onNoteChangeCallback({
        noteName,
        freq: Math.round(freq * 10) / 10,
        midiNote: midiNote + this.pitchShift,
      });
    }
  }

  /**
   * Play continuous glissando sweep for Vocal Sirens exercise with lowpass smoothing.
   */
  playGlissando(startMidi, endMidi, durationSec) {
    if (!this.audioCtx) this.init();
    const startFreq = midiToFreq(startMidi + this.pitchShift);
    const endFreq = midiToFreq(endMidi + this.pitchShift);
    const now = this.audioCtx.currentTime;

    const osc = this.audioCtx.createOscillator();
    const filter = this.audioCtx.createBiquadFilter();
    const gain = this.audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + durationSec);

    // Warm Low-Pass Filter at 650 Hz to eliminate piercing high harmonics
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(650, now);

    // Gentle, comfortable volume gain envelope (0.15 peak)
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.15);
    gain.gain.setValueAtTime(0.15, now + durationSec - 0.15);
    gain.gain.linearRampToValueAtTime(0.001, now + durationSec);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    this.trackSource(osc);

    osc.start(now);
    osc.stop(now + durationSec + 0.05);

    if (this.onNoteChangeCallback) {
      this.onNoteChangeCallback({
        noteName: `${midiToNoteName(startMidi + this.pitchShift)} ~ ${midiToNoteName(endMidi + this.pitchShift)}`,
        freq: Math.round(startFreq),
        midiNote: startMidi + this.pitchShift,
      });
    }
  }

  /**
   * Play metronome woodblock click.
   */
  playMetronomeClick(isHigh = false) {
    if (!this.audioCtx) this.init();
    const now = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(isHigh ? 880 : 440, now);

    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.masterGain);

    this.trackSource(osc);

    osc.start(now);
    osc.stop(now + 0.09);
  }

  /**
   * Start the active exercise loop.
   */
  start(exerciseId = this.currentExercise) {
    this.init();
    this.stop();
    this.isPlaying = true;
    this.currentExercise = exerciseId;
    this.stepIndex = 0;
    this.baseKeyOffset = 0;

    this.runLoopStep();
  }

  runLoopStep() {
    if (!this.isPlaying) return;

    let stepDelayMs = 500;

    switch (this.currentExercise) {
      case 'warmup_breathing': {
        // 4 counts inhale, 4 counts hold, 8 counts exhale (Total 16 beats)
        const beatInMeasure = this.stepIndex % 16;
        const isDownbeat = beatInMeasure === 0 || beatInMeasure === 4 || beatInMeasure === 8;
        this.playMetronomeClick(isDownbeat);

        let phaseText = 'Inhale (4s)';
        if (beatInMeasure >= 4 && beatInMeasure < 8) phaseText = 'Hold Breath (4s)';
        if (beatInMeasure >= 8) phaseText = 'Exhale "S" (8s)';

        if (this.onNoteChangeCallback) {
          this.onNoteChangeCallback({
            noteName: `${phaseText} • Beat ${beatInMeasure + 1}/16`,
            freq: 60 * this.speed,
            midiNote: 48,
          });
        }

        stepDelayMs = 1000 / this.speed;
        this.stepIndex = (this.stepIndex + 1) % 16;
        break;
      }

      case 'warmup_lip_trill': {
        // 5-Note scale: 1 - 2 - 3 - 4 - 5 - 4 - 3 - 2 - 1 (C4 = 60)
        // Intervals: [0, 2, 4, 5, 7, 5, 4, 2, 0]
        const scaleIntervals = [0, 2, 4, 5, 7, 5, 4, 2, 0];
        const rootMidi = 60 + this.baseKeyOffset; // Starts at C4
        const noteOffset = scaleIntervals[this.stepIndex];

        const noteDuration = (0.45 / this.speed);
        this.playSynthNote(rootMidi + noteOffset, noteDuration, 0.75);

        this.stepIndex++;
        if (this.stepIndex >= scaleIntervals.length) {
          // Completed one scale repetition; transpose up by 1 semitone
          this.stepIndex = 0;
          this.baseKeyOffset = (this.baseKeyOffset + 1) % 7; // Ascend up to +7 semitones then reset
          stepDelayMs = (800 / this.speed); // Brief breath pause between keys
        } else {
          stepDelayMs = (400 / this.speed);
        }
        break;
      }

      case 'warmup_sirens': {
        // Continuous glissando siren sweep from A2 (45) to A4 (69) and back down
        const isUp = this.stepIndex % 2 === 0;
        const duration = 2.2 / this.speed;

        if (isUp) {
          this.playGlissando(48, 72, duration); // C3 to C5
        } else {
          this.playGlissando(72, 48, duration); // C5 to C3
        }

        this.stepIndex = (this.stepIndex + 1) % 2;
        stepDelayMs = (duration + 0.3) * 1000;
        break;
      }

      case 'song_practice': {
        // Pop Chord Progression: C (60,64,67) -> G (55,59,62) -> Am (57,60,64) -> F (53,57,60)
        const chords = [
          [60, 64, 67], // C Major
          [55, 59, 62], // G Major
          [57, 60, 64], // A Minor
          [53, 57, 60], // F Major
        ];
        const chordIndex = Math.floor(this.stepIndex / 4) % chords.length;
        const chordNotes = chords[chordIndex];

        // Play arpeggiated piano strum
        chordNotes.forEach((midi, i) => {
          const timeoutId = setTimeout(() => {
            this.scheduledTimeouts.delete(timeoutId);
            if (this.isPlaying) {
              this.playSynthNote(midi, 1.2 / this.speed, 0.6);
            }
          }, i * 60);
          this.scheduledTimeouts.add(timeoutId);
        });

        const chordNames = ['C Major', 'G Major', 'A Minor', 'F Major'];
        if (this.onNoteChangeCallback) {
          this.onNoteChangeCallback({
            noteName: `${chordNames[chordIndex]} (Chord Progression)`,
            freq: Math.round(midiToFreq(chordNotes[0] + this.pitchShift)),
            midiNote: chordNotes[0] + this.pitchShift,
          });
        }

        this.stepIndex = (this.stepIndex + 1) % (chords.length * 4);
        stepDelayMs = (1000 / this.speed);
        break;
      }

      default:
        stepDelayMs = 500;
    }

    this.timerId = setTimeout(() => {
      this.runLoopStep();
    }, stepDelayMs);
  }

  /**
   * Stop playback and cancel scheduled timer.
   */
  stop() {
    this.isPlaying = false;
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    for (const timeoutId of this.scheduledTimeouts) {
      clearTimeout(timeoutId);
    }
    this.scheduledTimeouts.clear();
    for (const source of this.activeSources) {
      try {
        source.stop();
      } catch {
        // The source may have already stopped naturally.
      }
    }
    this.activeSources.clear();
    if (this.onNoteChangeCallback) {
      this.onNoteChangeCallback(null);
    }
  }
}

// Export singleton instance
export const scaleEngine = new ScaleEngine();
