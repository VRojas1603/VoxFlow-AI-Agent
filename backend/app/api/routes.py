from fastapi import APIRouter
from app.core.config import settings

router = APIRouter()


@router.get("/health")
def health_check():
    api_key_configured = bool(
        settings.ASSEMBLYAI_API_KEY 
        and settings.ASSEMBLYAI_API_KEY != "your_assemblyai_api_key_here"
    )
    return {
        "status": "online",
        "service": "AI Vocal Coach Backend",
        "environment": settings.ENVIRONMENT,
        "assemblyai_configured": api_key_configured
    }


@router.get("/exercises")
def get_exercises():
    return [
        {
            "id": "warmup_breathing",
            "name": "Diaphragmatic Breathing",
            "category": "Preparation",
            "duration": "2 min",
            "description": "Low 4-count inhalation with controlled, continuous 'S' sound exhalation."
        },
        {
            "id": "warmup_lip_trill",
            "name": "Lip Trill (Lip Bubbles)",
            "category": "Vocal Cords",
            "duration": "3 min",
            "description": "Relaxed lip vibration with 'brrr' sound across 3-tone and 5-tone scales."
        },
        {
            "id": "warmup_sirens",
            "name": "Vocal Sirens",
            "category": "Resonance & Range",
            "duration": "3 min",
            "description": "Smooth continuous glissando from lowest to highest pitch without breaks."
        },
        {
            "id": "notes_practice",
            "name": "Notes Practice",
            "category": "Pitch Control",
            "duration": "3 min",
            "description": "Match four target notes in sequence and hold each pitch steadily for half a second."
        }
    ]


@router.get("/tips")
def get_tips():
    return [
        {
            "tip_type": "diaphragm_breath",
            "title": "Diaphragmatic Breath",
            "explanation": "Expand lower ribs and abdomen on inhale. Keep shoulders and chest completely relaxed.",
            "icon": "lungs"
        },
        {
            "tip_type": "lip_trill",
            "title": "Lip Trill Technique",
            "explanation": "Place two fingers gently on your cheeks to relieve tension and blow air to vibrate lips evenly.",
            "icon": "smile"
        },
        {
            "tip_type": "head_voice",
            "title": "Head Voice & Resonance",
            "explanation": "Direct sound into facial resonators (the 'mask') by gently lifting your soft palate.",
            "icon": "sparkles"
        },
        {
            "tip_type": "posture",
            "title": "Alignment & Posture",
            "explanation": "Feet shoulder-width apart, chin parallel to the floor, and neck relaxed to free air flow.",
            "icon": "user-check"
        },
        {
            "tip_type": "vocal_siren",
            "title": "Vocal Sirens",
            "explanation": "Glide smoothly like a siren using the vowel 'OO' or 'OH' without cracking or pushing.",
            "icon": "activity"
        },
        {
            "tip_type": "notes_practice",
            "title": "Notes Practice",
            "explanation": "Match the highlighted target note and hold it steadily until it turns green, then continue to the next note.",
            "icon": "target"
        }
    ]
