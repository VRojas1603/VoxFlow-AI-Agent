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
    "en": "Hello! I'm Lyra, your vocal coach today. Ready to warm up your voice, or would you like to jump straight into practicing a song?",
    "es": "¡Hola! Soy Lyra, tu coach vocal hoy. ¿Listo para calentar tu voz o prefieres practicar directamente una canción?",
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
   - When the user asks to start or stop the accompaniment, change speed, adjust pitch, explain a technique, or switch exercises, IMMEDIATELY call the matching tool ('control_accompaniment', 'adjust_music_playback', 'select_exercise', 'show_vocal_tip') in the EXACT SAME TURN using sensible default values (e.g., playback_speed=0.85 or pitch_shift=-2).
   - NEVER ask redundant clarifying questions (such as "how much slower?"). Execute the tool immediately and state what you did in 1 short sentence.
8. Visual guidance: When introducing or explaining a vocal technique (lip trills, breathing, head voice), invoke the tool 'show_vocal_tip' to render the visual guide on screen.
9. Tool narration: Whenever you explain a vocal technique, ALWAYS call 'show_vocal_tip' and speak the explanation aloud in that same turn. After any tool call, confirm what changed in one short sentence.
10. Example: User: "How do I do a lip trill?" -> call 'show_vocal_tip' with the visual instructions, then explain aloud how to perform it.
11. Non-Word Vocalizations & Singing Practice:
   - Treat singing sounds, lip trill vibrations ("brrr"), and scale syllables ("dun dun", "la la") as vocal warm-up practice rather than text commands. Give encouraging feedback on pitch and breath support.
12. Session closure: When the user says goodbye or asks to end the session, say one brief farewell and invoke 'end_session' in the same turn. Do not continue coaching afterward.
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
        "description": "Displays an educational visual card of vocal technique on the user's screen.",
        "response_instructions": {
            "success": "Explain the displayed technique aloud in one short sentence.",
            "error": "Explain the technique aloud without claiming that a visual guide was displayed.",
        },
        "parameters": {
            "type": "object",
            "properties": {
                "tip_type": {
                    "type": "string",
                    "enum": ["diaphragm_breath", "lip_trill", "head_voice", "posture", "vocal_siren"],
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
        "description": "Starts or stops the accompaniment track. Call this whenever the user asks to play, start, pause, or stop the accompaniment, scale, track, or music.",
        "response_instructions": {
            "success": "Briefly confirm the actual playback state reported by the tool result.",
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
        "name": "adjust_music_playback",
        "description": "Adjusts the tempo or key/pitch of the backing track.",
        "response_instructions": {
            "success": "Confirm the playback change in one short sentence.",
            "error": "Briefly say that the playback change could not be applied.",
        },
        "parameters": {
            "type": "object",
            "properties": {
                "pitch_shift": {
                    "type": "integer",
                    "description": "Number of semitones to transpose (-3 to +3)",
                },
                "playback_speed": {
                    "type": "number",
                    "description": "Playback speed factor (e.g. 0.85 to 1.15)",
                },
            },
        },
    },
    {
        "type": "function",
        "name": "select_exercise",
        "description": "Switches the active warm-up exercise on the user interface.",
        "response_instructions": {
            "success": "Confirm the selected exercise in one short sentence.",
            "error": "Briefly say that the exercise could not be selected.",
        },
        "parameters": {
            "type": "object",
            "properties": {
                "exercise_id": {
                    "type": "string",
                    "enum": ["warmup_breathing", "warmup_lip_trill", "warmup_sirens", "song_practice"],
                }
            },
            "required": ["exercise_id"],
        },
    },
    {
        "type": "function",
        "name": "end_session",
        "description": "Ends the current vocal coaching session after the user says goodbye or asks to stop.",
        "response_instructions": {
            "success": "Say one brief farewell before ending the session.",
            "error": "Say one brief farewell and ask the user to end the session manually.",
        },
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
