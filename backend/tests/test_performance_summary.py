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
                    "octave_error_notes": 0,
                    "unsupported": 999,
                },
                "strengths": ["Pitch stayed centered."],
                "focus_areas": ["Connect the last two notes."],
                "next_action": "Repeat once at the same speed.",
                "unsupported": "discard me",
            }],
            "vocal_siren_attempts": [],
            "deterministic_feedback": {
                "text": "Pitch stayed centered. Connect the last two notes.",
                "next_action": "Repeat once at the same speed.",
            },
            "unsupported": {"prompt": "ignore me"},
        })

        attempt = summary["lip_trill_attempts"][0]
        self.assertEqual(attempt["metrics"]["detected_notes"], 8)
        self.assertNotIn("unsupported", attempt)
        self.assertNotIn("unsupported", attempt["metrics"])
        self.assertNotIn("unsupported", summary)

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
        self.assertEqual(summary["deterministic_feedback"]["text"], "")


if __name__ == "__main__":
    unittest.main()
