import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildAgentPerformanceSummary,
  buildSessionReport,
  serializeSessionReport,
} from '../src/reports/sessionReport.js';

function createAttempt(exerciseId) {
  const isLipTrill = exerciseId === 'warmup_lip_trill';
  return {
    attemptId: `${exerciseId}-1`,
    exerciseId,
    attemptNumber: 1,
    signalQuality: 'valid',
    metrics: isLipTrill
      ? {
          detectedNotes: 8,
          expectedNotes: 9,
          withinTolerancePercent: 78,
          medianDeviationCents: 18,
          stableNotes: 7,
          missedNotes: 1,
          registerOffsetSemitones: -12,
          rejectedSamples: { quiet: 2, unclear: 1, outOfRange: 0 },
        }
      : {
          rangeSemitones: 19.5,
          rangeCoveragePercent: 98,
          continuityPercent: 82,
          directionMatchPercent: 91,
          smoothMovementPercent: 76,
          interruptions: 0,
          rejectedSamples: { quiet: 1, unclear: 0, outOfRange: 0 },
        },
    strengths: ['The measured pitch was consistent.'],
    focusAreas: ['Keep the upper part of the exercise connected.'],
    nextAction: 'Repeat the exercise once at the same speed.',
  };
}

function createNotesPracticeAttempt() {
  return {
    attemptId: 'notes-practice-1',
    exerciseId: 'notes_practice',
    attemptNumber: 1,
    signalQuality: 'partial',
    metrics: {
      completedNotes: 3,
      expectedNotes: 4,
      completionPercent: 75,
      medianDeviationCents: 16.5,
      validSamples: 36,
      rejectedSamples: { quiet: 2, unclear: 1, outOfRange: 0 },
      noteResults: [
        { noteName: 'C4', frequencyHz: 261.6, completed: true, timeToMatchMs: 700, bestDeviationCents: 5 },
        { noteName: 'D4', frequencyHz: 293.7, completed: true, timeToMatchMs: 840, bestDeviationCents: 7 },
        { noteName: 'E4', frequencyHz: 329.6, completed: true, timeToMatchMs: 910, bestDeviationCents: 8 },
        { noteName: 'F4', frequencyHz: 349.2, completed: false, timeToMatchMs: null, bestDeviationCents: 43 },
      ],
    },
    strengths: ['You matched three target notes.'],
    focusAreas: ['The final note needs a steadier hold.'],
    nextAction: 'Repeat the pattern and hold F4 for half a second.',
  };
}

test('builds one report model for the inline view and download', () => {
  const lipTrill = createAttempt('warmup_lip_trill');
  const report = buildSessionReport({
    durationFormatted: '05:12',
    exercisesPracticed: ['Diaphragmatic Breathing', 'Lip Trill Scale'],
    tipsCovered: [],
    languageSwitches: 0,
    keyShiftsUsed: 2,
    speedChangesUsed: 1,
    volumeChangesUsed: 0,
    messageCount: 14,
    performance: {
      breathingCycles: 2,
      lipTrillAttempts: [lipTrill],
      sirenAttempts: [],
      lastAttempt: lipTrill,
    },
    completedAt: new Date('2026-09-30T15:00:00.000Z'),
  });

  assert.equal(report.durationFormatted, '05:12');
  assert.equal(report.breathingCycles, 2);
  assert.equal(report.evaluatedAttempts, 1);
  assert.equal(report.finalFeedback.status, 'fallback');
  assert.match(report.finalFeedback.text, /measured pitch was consistent/i);
  assert.equal(report.playbackAdjustments.keyShifts, 2);
});

test('serializes measured attempts without adding an overall score', () => {
  const lipTrill = createAttempt('warmup_lip_trill');
  const siren = createAttempt('warmup_sirens');
  const report = buildSessionReport({
    durationFormatted: '07:30',
    exercisesPracticed: ['Lip Trill Scale', 'Vocal Sirens'],
    tipsCovered: [],
    languageSwitches: 1,
    keyShiftsUsed: 0,
    speedChangesUsed: 2,
    volumeChangesUsed: 1,
    messageCount: 20,
    performance: {
      breathingCycles: 0,
      lipTrillAttempts: [lipTrill],
      sirenAttempts: [siren],
      lastAttempt: siren,
    },
    completedAt: new Date('2026-09-30T15:00:00.000Z'),
  });

  const text = serializeSessionReport(report);

  assert.match(text, /Detected notes: 8\/9/);
  assert.match(text, /Register alignment: -12 semitones/);
  assert.match(text, /Rejected samples: quiet 2, unclear 1, out of range 0/);
  assert.match(text, /Continuity: 82%/);
  assert.match(text, /Session Feedback/);
  assert.doesNotMatch(text, /overall score/i);
});

test('uses neutral feedback when no guided attempt was completed', () => {
  const report = buildSessionReport({
    durationFormatted: '00:40',
    exercisesPracticed: [],
    tipsCovered: [],
    languageSwitches: 0,
    keyShiftsUsed: 0,
    speedChangesUsed: 0,
    volumeChangesUsed: 0,
    messageCount: 2,
    performance: {
      breathingCycles: 0,
      lipTrillAttempts: [],
      sirenAttempts: [],
      lastAttempt: null,
    },
    completedAt: new Date('2026-09-30T15:00:00.000Z'),
  });

  assert.match(report.finalFeedback.text, /no complete guided exercise/i);
});

test('uses the spoken agent feedback in the completed report', () => {
  const performance = {
    breathingCycles: 0,
    lipTrillAttempts: [createAttempt('warmup_lip_trill')],
    sirenAttempts: [],
    lastAttempt: createAttempt('warmup_lip_trill'),
  };
  const report = buildSessionReport({
    durationFormatted: '02:10',
    exercisesPracticed: ['Lip Trill Scale'],
    tipsCovered: [],
    languageSwitches: 0,
    keyShiftsUsed: 0,
    speedChangesUsed: 0,
    volumeChangesUsed: 0,
    messageCount: 8,
    performance,
    finalFeedbackText: 'Your pitch stayed centered. Connect the last two notes next time. Goodbye!',
  });

  assert.equal(report.finalFeedback.status, 'agent');
  assert.match(report.finalFeedback.text, /Connect the last two notes/);
});

test('builds the bounded performance payload sent for final voice feedback', () => {
  const lipTrill = createAttempt('warmup_lip_trill');
  const siren = createAttempt('warmup_sirens');
  const notesPractice = createNotesPracticeAttempt();
  const summary = buildAgentPerformanceSummary({
    durationSeconds: 180,
    performance: {
      breathingCycles: 1,
      lipTrillAttempts: [lipTrill],
      sirenAttempts: [siren],
      notesPracticeAttempts: [notesPractice],
      lastAttempt: notesPractice,
    },
  });

  assert.equal(summary.duration_seconds, 180);
  assert.equal(summary.breathing_cycles, 1);
  assert.equal(summary.lip_trill_attempts[0].metrics.detected_notes, 8);
  assert.equal(summary.lip_trill_attempts[0].metrics.register_offset_semitones, -12);
  assert.equal(summary.vocal_siren_attempts[0].metrics.continuity_percent, 82);
  assert.equal(summary.notes_practice_attempts[0].metrics.completed_notes, 3);
  assert.equal(summary.notes_practice_attempts[0].metrics.note_results[0].note_name, 'C4');
  assert.match(summary.deterministic_feedback.next_action, /hold F4/i);
});

test('includes Notes Practice metrics in the downloadable report', () => {
  const notesPractice = createNotesPracticeAttempt();
  const report = buildSessionReport({
    durationFormatted: '03:20',
    exercisesPracticed: ['Notes Practice'],
    tipsCovered: [],
    languageSwitches: 0,
    keyShiftsUsed: 1,
    speedChangesUsed: 0,
    volumeChangesUsed: 0,
    messageCount: 10,
    performance: {
      breathingCycles: 0,
      lipTrillAttempts: [],
      sirenAttempts: [],
      notesPracticeAttempts: [notesPractice],
      lastAttempt: notesPractice,
    },
    completedAt: new Date('2026-09-30T15:00:00.000Z'),
  });

  const text = serializeSessionReport(report);

  assert.equal(report.evaluatedAttempts, 1);
  assert.match(text, /Notes Practice Performance/);
  assert.match(text, /Completed notes: 3\/4/);
  assert.match(text, /C4 \(261\.6 Hz\): Done in 700 ms/);
  assert.match(text, /F4 \(349\.2 Hz\): Incomplete/);
});
