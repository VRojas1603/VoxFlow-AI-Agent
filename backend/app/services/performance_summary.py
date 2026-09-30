"""Validation helpers for browser-generated vocal performance summaries."""

from math import isfinite
from typing import Any


MAX_ATTEMPTS_PER_EXERCISE = 8
MAX_FEEDBACK_ITEMS = 2
MAX_FEEDBACK_LENGTH = 240


def _bounded_number(
    value: Any,
    minimum: float,
    maximum: float,
    *,
    precision: int = 1,
) -> int | float:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not isfinite(value):
        return minimum
    bounded = min(float(maximum), max(float(minimum), float(value)))
    rounded = round(bounded, precision)
    return int(rounded) if rounded == int(rounded) else rounded


def _bounded_text(value: Any) -> str:
    if not isinstance(value, str):
        return ""
    normalized = " ".join(value.split())
    return normalized[:MAX_FEEDBACK_LENGTH]


def _bounded_text_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [
        text
        for item in value[:MAX_FEEDBACK_ITEMS]
        if (text := _bounded_text(item))
    ]


def _sanitize_feedback(attempt: dict[str, Any]) -> dict[str, Any]:
    return {
        "strengths": _bounded_text_list(attempt.get("strengths")),
        "focus_areas": _bounded_text_list(attempt.get("focus_areas")),
        "next_action": _bounded_text(attempt.get("next_action")),
    }


def _sanitize_rejected_samples(value: Any) -> dict[str, int | float]:
    samples = value if isinstance(value, dict) else {}
    return {
        "quiet": _bounded_number(samples.get("quiet"), 0, 10000),
        "unclear": _bounded_number(samples.get("unclear"), 0, 10000),
        "out_of_range": _bounded_number(samples.get("out_of_range"), 0, 10000),
    }


def _sanitize_lip_trill_attempt(attempt: Any) -> dict[str, Any] | None:
    if not isinstance(attempt, dict):
        return None
    metrics = attempt.get("metrics")
    if not isinstance(metrics, dict):
        metrics = {}
    return {
        "attempt_number": _bounded_number(attempt.get("attempt_number"), 1, 100),
        "signal_quality": _sanitize_signal_quality(attempt.get("signal_quality")),
        "metrics": {
            "detected_notes": _bounded_number(metrics.get("detected_notes"), 0, 9),
            "expected_notes": _bounded_number(metrics.get("expected_notes"), 0, 9),
            "within_tolerance_percent": _bounded_number(
                metrics.get("within_tolerance_percent"), 0, 100,
            ),
            "median_deviation_cents": _bounded_number(
                metrics.get("median_deviation_cents"), 0, 1200,
            ),
            "stable_notes": _bounded_number(metrics.get("stable_notes"), 0, 9),
            "missed_notes": _bounded_number(metrics.get("missed_notes"), 0, 9),
            "register_offset_semitones": _bounded_number(
                metrics.get("register_offset_semitones"), -36, 36,
            ),
            "rejected_samples": _sanitize_rejected_samples(
                metrics.get("rejected_samples"),
            ),
        },
        **_sanitize_feedback(attempt),
    }


def _sanitize_siren_attempt(attempt: Any) -> dict[str, Any] | None:
    if not isinstance(attempt, dict):
        return None
    metrics = attempt.get("metrics")
    if not isinstance(metrics, dict):
        metrics = {}
    return {
        "attempt_number": _bounded_number(attempt.get("attempt_number"), 1, 100),
        "signal_quality": _sanitize_signal_quality(attempt.get("signal_quality")),
        "metrics": {
            "range_semitones": _bounded_number(metrics.get("range_semitones"), 0, 60),
            "range_coverage_percent": _bounded_number(
                metrics.get("range_coverage_percent"), 0, 100,
            ),
            "continuity_percent": _bounded_number(
                metrics.get("continuity_percent"), 0, 100,
            ),
            "direction_match_percent": _bounded_number(
                metrics.get("direction_match_percent"), 0, 100,
            ),
            "smooth_movement_percent": _bounded_number(
                metrics.get("smooth_movement_percent"), 0, 100,
            ),
            "interruptions": _bounded_number(metrics.get("interruptions"), 0, 100),
            "rejected_samples": _sanitize_rejected_samples(
                metrics.get("rejected_samples"),
            ),
        },
        **_sanitize_feedback(attempt),
    }


def _sanitize_notes_practice_attempt(attempt: Any) -> dict[str, Any] | None:
    if not isinstance(attempt, dict):
        return None
    metrics = attempt.get("metrics")
    if not isinstance(metrics, dict):
        metrics = {}
    raw_notes = metrics.get("note_results")
    if not isinstance(raw_notes, list):
        raw_notes = []
    note_results = []
    for note in raw_notes[:4]:
        if not isinstance(note, dict):
            continue
        note_results.append({
            "note_name": _bounded_text(note.get("note_name"))[:8],
            "frequency_hz": _bounded_number(note.get("frequency_hz"), 20, 5000),
            "completed": bool(note.get("completed")),
            "time_to_match_ms": _bounded_number(note.get("time_to_match_ms"), 0, 60000),
            "best_deviation_cents": _bounded_number(
                note.get("best_deviation_cents"), 0, 2400,
            ),
        })
    return {
        "attempt_number": _bounded_number(attempt.get("attempt_number"), 1, 100),
        "signal_quality": _sanitize_signal_quality(attempt.get("signal_quality")),
        "metrics": {
            "completed_notes": _bounded_number(metrics.get("completed_notes"), 0, 4),
            "expected_notes": _bounded_number(metrics.get("expected_notes"), 0, 4),
            "completion_percent": _bounded_number(
                metrics.get("completion_percent"), 0, 100,
            ),
            "median_deviation_cents": _bounded_number(
                metrics.get("median_deviation_cents"), 0, 2400,
            ),
            "valid_samples": _bounded_number(metrics.get("valid_samples"), 0, 10000),
            "rejected_samples": _sanitize_rejected_samples(
                metrics.get("rejected_samples"),
            ),
            "note_results": note_results,
        },
        **_sanitize_feedback(attempt),
    }


def _sanitize_signal_quality(value: Any) -> str:
    return value if value in {"valid", "partial", "insufficient"} else "insufficient"


def _sanitize_attempts(value: Any, sanitizer) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    attempts = []
    for candidate in value[:MAX_ATTEMPTS_PER_EXERCISE]:
        if attempt := sanitizer(candidate):
            attempts.append(attempt)
    return attempts


def sanitize_performance_summary(value: Any) -> dict[str, Any]:
    """Return the fixed, bounded subset that Lyra may use for final feedback."""
    summary = value if isinstance(value, dict) else {}
    deterministic_feedback = summary.get("deterministic_feedback")
    if not isinstance(deterministic_feedback, dict):
        deterministic_feedback = {}

    return {
        "duration_seconds": _bounded_number(summary.get("duration_seconds"), 0, 14400),
        "breathing_cycles": _bounded_number(summary.get("breathing_cycles"), 0, 100),
        "lip_trill_attempts": _sanitize_attempts(
            summary.get("lip_trill_attempts"),
            _sanitize_lip_trill_attempt,
        ),
        "vocal_siren_attempts": _sanitize_attempts(
            summary.get("vocal_siren_attempts"),
            _sanitize_siren_attempt,
        ),
        "notes_practice_attempts": _sanitize_attempts(
            summary.get("notes_practice_attempts"),
            _sanitize_notes_practice_attempt,
        ),
        "deterministic_feedback": {
            "text": _bounded_text(deterministic_feedback.get("text")),
            "next_action": _bounded_text(deterministic_feedback.get("next_action")),
        },
    }
