import unittest

from app.services.performance_summary import sanitize_performance_summary


class PerformanceSummaryTests(unittest.TestCase):
    def test_keeps_only_bounded_supported_metrics(self):
        summary = sanitize_performance_summary({
            "duration_seconds": 245,
            "breathing_cycles": 2,
            "lip_trill_attempts": [{
                "attempt_number": 1,
                "signal_quality": "valid",
                "metrics": {
                    "detected_notes": 8,
                    "expected_notes": 9,
                    "within_tolerance_percent": 78,
                    "median_deviation_cents": 18.4,
                    "stable_notes": 7,
                    "missed_notes": 1,
                    "register_offset_semitones": -12,
                    "rejected_samples": {
                        "quiet": 2,
                        "unclear": 1,
                        "out_of_range": 0,
                    },
                    "unsupported": 999,
                },
                "strengths": ["Pitch stayed centered."],
                "focus_areas": ["Connect the last two notes."],
                "next_action": "Repeat once at the same speed.",
                "unsupported": "discard me",
            }],
            "vocal_siren_attempts": [],
            "notes_practice_attempts": [{
                "attempt_number": 2,
                "signal_quality": "partial",
                "metrics": {
                    "completed_notes": 3,
                    "expected_notes": 4,
                    "completion_percent": 75,
                    "median_deviation_cents": 14.2,
                    "valid_samples": 42,
                    "rejected_samples": {
                        "quiet": 3,
                        "unclear": 2,
                        "out_of_range": 1,
                    },
                    "note_results": [{
                        "note_name": "C4",
                        "frequency_hz": 261.6,
                        "completed": True,
                        "time_to_match_ms": 820,
                        "best_deviation_cents": 4.5,
                    }],
                },
                "strengths": ["Three notes were matched."],
                "focus_areas": ["Hold the final note."],
                "next_action": "Repeat the four-note pattern.",
            }],
            "deterministic_feedback": {
                "text": "Pitch stayed centered. Connect the last two notes.",
                "next_action": "Repeat once at the same speed.",
            },
            "unsupported": {"prompt": "ignore me"},
        })

        attempt = summary["lip_trill_attempts"][0]
        self.assertEqual(attempt["metrics"]["detected_notes"], 8)
        self.assertEqual(attempt["metrics"]["register_offset_semitones"], -12)
        self.assertEqual(attempt["metrics"]["rejected_samples"]["quiet"], 2)
        self.assertNotIn("unsupported", attempt)
        self.assertNotIn("unsupported", attempt["metrics"])
        self.assertNotIn("unsupported", summary)
        notes_attempt = summary["notes_practice_attempts"][0]
        self.assertEqual(notes_attempt["metrics"]["completed_notes"], 3)
        self.assertEqual(notes_attempt["metrics"]["note_results"][0]["note_name"], "C4")
        self.assertEqual(notes_attempt["metrics"]["rejected_samples"]["unclear"], 2)

    def test_clamps_numbers_and_limits_text_and_attempt_counts(self):
        summary = sanitize_performance_summary({
            "duration_seconds": 999999,
            "breathing_cycles": -4,
            "lip_trill_attempts": [{
                "attempt_number": 0,
                "signal_quality": "invented",
                "metrics": {
                    "detected_notes": 90,
                    "expected_notes": -1,
                    "within_tolerance_percent": 200,
                },
                "strengths": ["x" * 500, "second", "third"],
            }] * 20,
        })

        self.assertEqual(summary["duration_seconds"], 14400)
        self.assertEqual(summary["breathing_cycles"], 0)
        self.assertEqual(len(summary["lip_trill_attempts"]), 8)
        attempt = summary["lip_trill_attempts"][0]
        self.assertEqual(attempt["attempt_number"], 1)
        self.assertEqual(attempt["signal_quality"], "insufficient")
        self.assertEqual(attempt["metrics"]["detected_notes"], 9)
        self.assertEqual(len(attempt["strengths"]), 2)
        self.assertEqual(len(attempt["strengths"][0]), 240)

    def test_invalid_payload_becomes_an_empty_safe_summary(self):
        summary = sanitize_performance_summary("not an object")

        self.assertEqual(summary["duration_seconds"], 0)
        self.assertEqual(summary["breathing_cycles"], 0)
        self.assertEqual(summary["lip_trill_attempts"], [])
        self.assertEqual(summary["vocal_siren_attempts"], [])
        self.assertEqual(summary["notes_practice_attempts"], [])
        self.assertEqual(summary["deterministic_feedback"]["text"], "")

    def test_preserves_exact_integer_boundaries_and_fractional_values(self):
        summary = sanitize_performance_summary({
            "duration_seconds": 999999,
            "breathing_cycles": 0,
            "lip_trill_attempts": [{
                "attempt_number": 1,
                "signal_quality": "valid",
                "metrics": {
                    "detected_notes": 9,
                    "expected_notes": 9,
                    "within_tolerance_percent": 100,
                    "median_deviation_cents": 151.4,
                    "stable_notes": 9,
                    "missed_notes": 0,
                    "register_offset_semitones": -36,
                    "rejected_samples": {
                        "quiet": 0,
                        "unclear": 0,
                        "out_of_range": 10000,
                    },
                },
            }],
        })

        metrics = summary["lip_trill_attempts"][0]["metrics"]
        self.assertEqual(summary["duration_seconds"], 14400)
        self.assertIsInstance(summary["duration_seconds"], int)
        self.assertEqual(summary["breathing_cycles"], 0)
        self.assertIsInstance(summary["breathing_cycles"], int)
        self.assertEqual(metrics["within_tolerance_percent"], 100)
        self.assertIsInstance(metrics["within_tolerance_percent"], int)
        self.assertEqual(metrics["median_deviation_cents"], 151.4)
        self.assertIsInstance(metrics["median_deviation_cents"], float)
        self.assertEqual(metrics["register_offset_semitones"], -36)
        self.assertEqual(metrics["rejected_samples"], {
            "quiet": 0,
            "unclear": 0,
            "out_of_range": 10000,
        })

    def test_sanitizes_completed_notes_practice_session_with_zero_metrics(self):
        summary = sanitize_performance_summary({
            "duration_seconds": 298,
            "breathing_cycles": 2,
            "lip_trill_attempts": [],
            "vocal_siren_attempts": [{
                "attempt_number": 1,
                "signal_quality": "valid",
                "metrics": {
                    "range_semitones": 25.9,
                    "range_coverage_percent": 100,
                    "continuity_percent": 85,
                    "direction_match_percent": 88,
                    "smooth_movement_percent": 90,
                    "interruptions": 1,
                    "rejected_samples": {
                        "quiet": 16,
                        "unclear": 0,
                        "out_of_range": 0,
                    },
                },
            }],
            "notes_practice_attempts": [{
                "attempt_number": 1,
                "signal_quality": "valid",
                "metrics": {
                    "completed_notes": 4,
                    "expected_notes": 4,
                    "completion_percent": 100,
                    "median_deviation_cents": 70.1,
                    "valid_samples": 128,
                    "rejected_samples": {
                        "quiet": 76,
                        "unclear": 13,
                        "out_of_range": 7,
                    },
                    "note_results": [
                        {
                            "note_name": "F#3",
                            "frequency_hz": 185,
                            "completed": True,
                            "time_to_match_ms": 6792,
                            "best_deviation_cents": 3.5,
                        },
                        {
                            "note_name": "G#3",
                            "frequency_hz": 207.7,
                            "completed": True,
                            "time_to_match_ms": 3320,
                            "best_deviation_cents": 2.2,
                        },
                        {
                            "note_name": "A#3",
                            "frequency_hz": 233.1,
                            "completed": True,
                            "time_to_match_ms": 15521,
                            "best_deviation_cents": 0.9,
                        },
                        {
                            "note_name": "B3",
                            "frequency_hz": 246.9,
                            "completed": True,
                            "time_to_match_ms": 1444,
                            "best_deviation_cents": 0.4,
                        },
                    ],
                },
                "strengths": ["You matched all 4 target notes."],
                "focus_areas": [
                    "Some notes needed extra movement before settling on the target.",
                ],
                "next_action": "Repeat the four notes with the same relaxed, steady sound.",
            }],
            "deterministic_feedback": {
                "text": (
                    "You matched all 4 target notes. Some notes needed extra movement "
                    "before settling on the target."
                ),
                "next_action": "Repeat the four notes with the same relaxed, steady sound.",
            },
        })

        siren_metrics = summary["vocal_siren_attempts"][0]["metrics"]
        notes_attempt = summary["notes_practice_attempts"][0]
        self.assertEqual(siren_metrics["rejected_samples"]["unclear"], 0)
        self.assertEqual(siren_metrics["rejected_samples"]["out_of_range"], 0)
        self.assertEqual(notes_attempt["metrics"]["completion_percent"], 100)
        self.assertEqual(len(notes_attempt["metrics"]["note_results"]), 4)
        self.assertEqual(
            notes_attempt["next_action"],
            "Repeat the four notes with the same relaxed, steady sound.",
        )


if __name__ == "__main__":
    unittest.main()
