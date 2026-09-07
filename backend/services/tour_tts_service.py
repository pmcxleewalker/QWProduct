"""Cached OpenAI TTS for the in-app guided tour narration.

Audio is generated once per (text, voice, speed) and persisted in Emergent
Object Storage so repeat plays never re-hit the LLM key.
"""
import os
import re
import hashlib
import logging

from emergentintegrations.llm.openai import OpenAITextToSpeech

from services.storage_service import put_object, get_object, APP_NAME

logger = logging.getLogger(__name__)

TTS_MODEL = "tts-1-hd"    # HD removes the robotic/reverb artefacts of tts-1
DEFAULT_VOICE = "echo"    # smooth and calm, warm — "Nexus"
DEFAULT_SPEED = 0.95      # gentle, natural pacing (short sentences do the rest)


def _clean(text: str) -> str:
    text = re.sub(r"https?://\S+", "", text)
    text = re.sub(r"`{1,3}[^`]*`{1,3}", "", text)
    text = re.sub(r"[*_#>~|]", "", text)
    return re.sub(r"\s+", " ", text).strip()


def cache_key(text: str, voice: str, speed: float = DEFAULT_SPEED) -> str:
    return hashlib.sha256(f"{text}|{voice}|{speed}|{TTS_MODEL}|mp3".encode()).hexdigest()


async def get_or_create_narration(db, text: str, voice: str = DEFAULT_VOICE, speed: float = DEFAULT_SPEED) -> str:
    """Return the storage path for the narration mp3, generating if needed."""
    cleaned = _clean(text)
    key = cache_key(cleaned, voice, speed)
    path = f"{APP_NAME}/tour-tts/{key}.mp3"

    existing = await db.tour_tts_cache.find_one({"key": key})
    if existing:
        return path

    tts = OpenAITextToSpeech(api_key=os.getenv("EMERGENT_LLM_KEY"))
    audio_bytes = await tts.generate_speech(text=cleaned, model=TTS_MODEL, voice=voice, speed=speed)
    put_object(path, audio_bytes, "audio/mpeg")
    await db.tour_tts_cache.insert_one({"key": key, "voice": voice, "speed": speed, "path": path})
    return path


def load_narration(path: str):
    return get_object(path)
