"""Configuration for System Prompt, Greeting, Tools, and Bilingual Code-Switching for AssemblyAI Voice Agent."""

SYSTEM_PROMPT = """You are 'Lyra', a professional, inspiring, and empathetic vocal coach and singing pedagogy expert. Your mission is to prepare the user's voice for singing, prevent vocal strain/fatigue, and teach practical vocal techniques.

Core Language & Code-Switching Rules:
1. Default Language is English. Start all sessions and initial guidance in English.
2. Bilingual & Code-Switching Mastery: You fluently understand both English and Spanish, as well as code-switching (Spanglish or mixed phrases).
3. If the user speaks in Spanish, asks in Spanish, or sings Spanish lyrics:
   - Reply immediately and naturally in fluent Spanish.
   - You MUST invoke the tool 'switch_language_voice' with {"language": "es", "voice": "lola"} so the voice output automatically switches to the Spanish voice 'lola'.
4. If the user speaks in English again:
   - Reply in English.
   - You MUST invoke the tool 'switch_language_voice' with {"language": "en", "voice": "eve"}.
5. Spoken brevity: Keep your spoken answers to 1 or 2 dynamic, clear sentences per turn so the vocal practice remains fast-paced.
6. Barge-in & interruptions: If the user interrupts you with questions on technique (diaphragmatic breathing, head voice, mixed voice, placement), answer immediately with clarity.
7. Visual guidance: When introducing or explaining a vocal technique, invoke the tool 'show_vocal_tip' to render the visual guide on screen.
8. Pitch & Key adjustments: If a phrase is too high or low for the user, offer to adjust the pitch using 'adjust_music_playback'.
9. Maintain a warm, encouraging, and supportive coaching tone throughout the session.
"""

DEFAULT_GREETING = "Hello! I'm Lyra, your vocal coach today. Ready to warm up your voice, or would you like to jump straight into practicing a song?"

DEFAULT_VOICE_EN = "eve"
DEFAULT_VOICE_ES = "lola"

VOICE_TOOLS = [
    {
        "type": "function",
        "name": "switch_language_voice",
        "description": "Switches the active voice and language between English ('eve') and Spanish ('lola') based on user speech.",
        "parameters": {
          "type": "object",
          "properties": {
            "language": {
              "type": "string",
              "enum": ["en", "es"],
              "description": "Language code ('en' for English, 'es' for Spanish)"
            },
            "voice": {
              "type": "string",
              "enum": ["eve", "lola", "alba"],
              "description": "Voice profile name ('eve' for English, 'lola' for Spanish)"
            }
          },
          "required": ["language", "voice"]
        }
    },
    {
        "type": "function",
        "name": "show_vocal_tip",
        "description": "Displays an educational visual card of vocal technique on the user's screen.",
        "parameters": {
          "type": "object",
          "properties": {
            "tip_type": {
              "type": "string",
              "enum": ["diaphragm_breath", "lip_trill", "head_voice", "posture", "vocal_siren"]
            },
            "title": { "type": "string", "description": "Short title of the technique" },
            "explanation": { "type": "string", "description": "1-2 sentence explanation of how to execute the technique" }
          },
          "required": ["tip_type", "title", "explanation"]
        }
    },
    {
        "type": "function",
        "name": "adjust_music_playback",
        "description": "Adjusts the tempo or key/pitch of the backing track.",
        "parameters": {
          "type": "object",
          "properties": {
            "pitch_shift": { 
                "type": "integer", 
                "description": "Number of semitones to transpose (-3 to +3)" 
            },
            "playback_speed": { 
                "type": "number", 
                "description": "Playback speed factor (e.g. 0.85 to 1.15)" 
            }
          }
        }
    },
    {
        "type": "function",
        "name": "select_exercise",
        "description": "Switches the active warm-up exercise on the user interface.",
        "parameters": {
          "type": "object",
          "properties": {
            "exercise_id": {
              "type": "string",
              "enum": ["warmup_breathing", "warmup_lip_trill", "warmup_sirens", "song_practice"]
            }
          },
          "required": ["exercise_id"]
        }
    }
]


def get_session_update_payload(voice: str = DEFAULT_VOICE_EN) -> dict:
    """Generates the JSON session.update payload to initialize or update the Voice Agent."""
    return {
        "type": "session.update",
        "session": {
            "system_prompt": SYSTEM_PROMPT,
            "greeting": DEFAULT_GREETING,
            "tools": VOICE_TOOLS,
            "output": {
                "voice": voice
            }
        }
    }
