"""Session prompt, greetings, tools, and supported AssemblyAI voices."""

DEFAULT_VOICE_EN = "eve"

VOICE_LANGUAGES = {
    "alba": "en",
    "eve": "en",
    "george": "en",
    "jane": "en",
    "jean": "en",
    "mary": "en",
    "michael": "en",
    "anna": "en",
    "charles": "en",
    "paul": "en",
    "vera": "en",
    "lola": "es",
}

GREETINGS = {
    "en": "Hello! I'm Lyra, your vocal coach today. Ready to warm up your voice or practice matching some notes?",
    "es": "¡Hola! Soy Lyra, tu coach vocal hoy. ¿Lista para calentar tu voz o practicar afinando algunas notas?",
}

SYSTEM_PROMPT_TEMPLATE = """You are 'Lyra', a professional, inspiring, and proactive vocal coach and singing pedagogy expert. Your mission is to prepare the user's voice for singing, prevent vocal strain/fatigue, and teach practical vocal techniques.

Core Language & Code-Switching Rules:
1. The default language is __DEFAULT_LANGUAGE__. Start the session and initial guidance in that language.
2. Bilingual & Code-Switching Mastery: You fluently understand both English and Spanish, as well as code-switching (Spanglish or mixed phrases).
3. Always reply naturally in the language the user is currently speaking. If the user changes between English and Spanish, follow that change immediately.
4. When the response language changes, invoke 'switch_language' with {"language": "en"} or {"language": "es"} in the same turn. This tool only updates the UI badge and session metric; never try to change the configured voice.
5. The voice selected before the session remains fixed. Continue in the requested language even when the selected voice has a foreign accent.
6. Spoken brevity: Keep your spoken answers to 1 or 2 dynamic, clear sentences per turn so the vocal practice remains fast-paced.
7. Proactive Leadership & Immediate Action:
   - Act as an energetic, proactive coach leading the session.
   - When the user asks to start or stop the accompaniment, start or stop Notes Practice, change speed, pitch, or volume, explain a technique, or switch exercises, IMMEDIATELY call the matching tool ('control_accompaniment', 'control_notes_practice', 'adjust_accompaniment', 'select_exercise', 'show_vocal_tip') in the EXACT SAME TURN.
   - NEVER ask redundant clarifying questions (such as "how much slower?"). Execute the tool immediately and state what you did in 1 short sentence.
   - For relative requests such as "raise it by 2" or "make it slower", call 'adjust_accompaniment' with operation 'increase' or 'decrease'. For target requests such as "set it to 0" or "back to 1x", use operation 'set'.
   - If the user gives no amount, use 1 semitone for pitch, 0.15 for speed, or 10 percentage points for volume.
   - Treat every request to make the accompaniment, track, scale, or music louder, quieter, softer, or to turn its volume up or down as an 'adjust_accompaniment' volume request. The app can control accompaniment volume, so never redirect the user to device volume controls.
   - Example: "increase the volume a little bit" means control 'volume', operation 'increase', value 10. "Turn it down" means control 'volume', operation 'decrease', value 10.
   - Notes Practice has no accompaniment. When it is selected, use 'control_notes_practice' to start or stop the silent measured attempt. Pitch changes transpose its four target notes; speed and volume do not apply.
8. Explicit visual guidance only:
   - Invoke 'show_vocal_tip' only when the user explicitly asks how to perform a technique, requests an explanation or instructions, or asks to see a guide.
   - Do NOT invoke 'show_vocal_tip' merely because an exercise was selected, introduced, or changed.
   - Resolve contextual phrases such as "this exercise", "the current exercise", "how do I do it?", and "how can I do this properly?" to the currently selected exercise.
9. Tool narration: When the user requests technique guidance, call 'show_vocal_tip' and speak its explanation aloud in the same turn. Never show a silent replacement tip.
10. Exercise transitions:
   - When the user only asks to move to another exercise, call 'select_exercise' without 'show_vocal_tip'. The selection stops the current accompaniment.
   - Confirm the newly selected exercise without announcing that playback was stopped unless the user explicitly asked to stop it.
   - If one request both selects an exercise and asks how to perform it, call 'select_exercise' and 'show_vocal_tip' in that same turn, then explain it aloud.
   - Examples that require a spoken tip: "How do I do a lip trill?", "Explain the current exercise", and "How can I do this properly?"
11. Non-Word Vocalizations & Singing Practice:
   - Treat isolated singing sounds, humming ("mm", "mhm"), lip trill vibrations ("brrr"), sustained vowels, and scale syllables ("dun dun", "la la") as measured vocal practice rather than text commands, including while the user matches targets in Notes Practice.
   - Do not reply to these isolated practice sounds, invoke tools for them, or invent immediate feedback. The app measures guided attempts locally and provides their results at session end.
12. Session closure:
   - When the user says goodbye or asks to end the session, invoke 'end_session' immediately without saying goodbye, summarizing performance, or continuing the lesson first.
   - After the tool returns, give the final measured coaching feedback exactly once. Use only the metrics and deterministic observations in the tool result.
   - Never invent posture, breath support, tension, tone quality, or pitch observations that are absent from the result.
   - If no evaluated attempt is available or signal quality is insufficient, say that clearly and use the provided deterministic next action.
   - End the final feedback with one warm, brief farewell. Do not invoke 'end_session' again.
13. Maintain a warm, encouraging, and supportive coaching tone throughout the session.
"""


def get_system_prompt(language: str) -> str:
    """Build the prompt with the language selected before the session."""
    if language not in GREETINGS:
        raise ValueError(f"Unsupported language: {language}")
    language_name = "Spanish" if language == "es" else "English"
    return SYSTEM_PROMPT_TEMPLATE.replace("__DEFAULT_LANGUAGE__", language_name)


SYSTEM_PROMPT = get_system_prompt("en")
DEFAULT_GREETING = GREETINGS["en"]

VOICE_TOOLS = [
    {
        "type": "function",
        "name": "switch_language",
        "description": "Updates the interface language badge when the conversation changes between English and Spanish. It does not change the configured voice.",
        "response_instructions": {
            "success": "Continue naturally in the selected language without mentioning the interface update.",
            "error": "Continue in the user's current language without claiming the interface was updated.",
        },
        "parameters": {
            "type": "object",
            "properties": {
                "language": {
                    "type": "string",
                    "enum": ["en", "es"],
                    "description": "Current response language ('en' for English, 'es' for Spanish)",
                }
            },
            "required": ["language"],
        },
    },
    {
        "type": "function",
        "name": "show_vocal_tip",
        "description": "Displays an educational visual card when the user explicitly asks how to perform a technique, requests instructions, or asks for a guide. Resolve 'this', 'it', or 'the current exercise' from conversation context. Do not call this tool for exercise selection alone.",
        "response_instructions": {
            "success": "Explain the displayed technique aloud in one short sentence.",
            "error": "Explain the technique aloud without claiming that a visual guide was displayed.",
        },
        "parameters": {
            "type": "object",
            "properties": {
                "tip_type": {
                    "type": "string",
                    "enum": ["diaphragm_breath", "lip_trill", "head_voice", "posture", "vocal_siren", "notes_practice"],
                },
                "title": {"type": "string", "description": "Short title of the technique"},
                "explanation": {"type": "string", "description": "1-2 sentence explanation of how to execute the technique"},
            },
            "required": ["tip_type", "title", "explanation"],
        },
    },
    {
        "type": "function",
        "name": "control_accompaniment",
        "description": "Schedules or stops the accompaniment track. Every play request starts a three-second visual countdown for the active exercise. Call this whenever the user asks to play, start, pause, or stop the accompaniment, scale, track, or music.",
        "response_instructions": {
            "success": "If playback is scheduled, say only that it will start after the countdown. Keep the confirmation short enough to finish within three seconds. Otherwise, briefly confirm the actual playback state reported by the tool result.",
            "error": "Briefly say that the accompaniment action could not be applied.",
        },
        "parameters": {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["play", "stop"],
                    "description": "Use 'play' to start playback and 'stop' to stop or pause it.",
                }
            },
            "required": ["action"],
        },
    },
    {
        "type": "function",
        "name": "adjust_accompaniment",
        "description": "Adjusts pitch, speed, or volume for the accompaniment, track, scale, or music. Always use this tool for louder, quieter, softer, volume up, and volume down requests; the app directly controls accompaniment volume. Use increase/decrease for relative requests and set for an absolute target. Pitch values are semitones, speed values are playback factors, and volume values are percentages from 0 to 100.",
        "response_instructions": {
            "success": "Confirm the actual control and current value reported by the tool result in one short sentence.",
            "error": "Briefly say that the playback change could not be applied.",
        },
        "parameters": {
            "type": "object",
            "properties": {
                "control": {
                    "type": "string",
                    "enum": ["pitch", "speed", "volume"],
                    "description": "The accompaniment setting to change. Use volume for louder, quieter, softer, turn up, and turn down requests.",
                },
                "operation": {
                    "type": "string",
                    "enum": ["increase", "decrease", "set"],
                    "description": "Use increase/decrease for relative changes and set for an absolute target.",
                },
                "value": {
                    "type": "number",
                    "description": "Positive change amount or absolute target. Omit only for increase/decrease to use the default step: pitch 1, speed 0.15, volume 10.",
                    "examples": [2, 0.15, 1.15, 10, 40],
                },
            },
            "required": ["control", "operation"],
        },
    },
    {
        "type": "function",
        "name": "control_notes_practice",
        "description": "Starts or stops the silent Notes Practice measurement. Use only when Notes Practice is the active exercise. Starting schedules a three-second countdown; no accompaniment is played.",
        "response_instructions": {
            "success": "If practice is scheduled, say only that note matching will start after the countdown. Keep the confirmation under three seconds. If stopped, briefly confirm that measurement stopped.",
            "error": "Briefly say that Notes Practice could not be started or stopped.",
        },
        "parameters": {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["start", "stop"],
                    "description": "Use 'start' to begin measuring the four notes and 'stop' to finish the current attempt.",
                }
            },
            "required": ["action"],
        },
    },
    {
        "type": "function",
        "name": "select_exercise",
        "description": "Selects the active warm-up exercise, stops the current accompaniment, and clears any previous tip card. Do not show a new tip unless the user also asks for guidance.",
        "response_instructions": {
            "success": "Confirm only the selected exercise in one short sentence. Do not mention playback unless the user explicitly asked to stop it, and do not explain the technique unless the user requested guidance.",
            "error": "Briefly say that the exercise could not be selected.",
        },
        "parameters": {
            "type": "object",
            "properties": {
                "exercise_id": {
                    "type": "string",
                    "enum": ["warmup_breathing", "warmup_lip_trill", "warmup_sirens", "notes_practice"],
                }
            },
            "required": ["exercise_id"],
        },
    },
    {
        "type": "function",
        "name": "end_session",
        "description": "Collects the measured session report and then ends the vocal coaching session. Call it immediately when the user says goodbye or asks to stop. Do not speak before calling it.",
        "response_instructions": {
            "success": "Give final coaching feedback in the user's current language in no more than three short sentences. Use only performance_summary: state one measured strength, one measured focus area, and its next_action. If there are no evaluated attempts or signal quality is insufficient, say so without inventing an evaluation and use deterministic_feedback. Finish with a brief farewell. Do not call another tool.",
            "error": "Briefly say that measured results could not be loaded, give no invented evaluation, and end with a warm farewell.",
        },
        "execution_mode": "hold",
        "timeout_seconds": 20,
        "parameters": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
]


def get_session_update_payload(
    voice: str = DEFAULT_VOICE_EN,
    language: str | None = None,
) -> dict:
    """Build the initial session.update with an immutable voice and linked language."""
    if voice not in VOICE_LANGUAGES:
        raise ValueError(f"Unsupported voice: {voice}")

    linked_language = VOICE_LANGUAGES[voice]
    initial_language = language or linked_language
    if initial_language not in GREETINGS:
        raise ValueError(f"Unsupported language: {initial_language}")
    if initial_language != linked_language:
        raise ValueError(
            f"Voice '{voice}' must start in language '{linked_language}'"
        )

    return {
        "type": "session.update",
        "session": {
            "system_prompt": get_system_prompt(initial_language),
            "greeting": GREETINGS[initial_language],
            "tools": VOICE_TOOLS,
            "input": {
                "transcription_mode": "min_latency",
            },
            "output": {
                "voice": voice,
            },
        },
    }
