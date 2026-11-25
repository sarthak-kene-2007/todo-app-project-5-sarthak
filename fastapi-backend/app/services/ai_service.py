import os
import json
from dotenv import load_dotenv
from openai import OpenAI
from app.schemas.ai import ParsedTask

# Ensure environment variables are loaded
load_dotenv()

# Setup Groq Client
groq_client = OpenAI(
    api_key=os.getenv("XAI_API_KEY", ""),
    base_url="https://api.groq.com/openai/v1"
)

# Setup Gemini Client (using official OpenAI-compatible endpoint for AQ. keys)
gemini_client = OpenAI(
    api_key=os.getenv("GEMINI_API_KEY", ""),
    base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
)

SYSTEM_PROMPT = """
You are a task management parser.
Return ONLY valid JSON with this format:
{
    "title": "Clear concise task title",
    "description": null,
    "priority": "Low" or "Medium" or "High",
    "due_date": "YYYY-MM-DD or null",
    "due_time": "HH:MM:SS or null"
}
"""

def get_best_groq_model() -> str:
    """Dynamically finds the best text model available on your Groq account."""
    try:
        # Exclude audio, speech, and TTS models
        excluded = ["whisper", "guard", "canopy", "orpheus", "tts", "audio", "vision"]
        models = [
            m.id for m in groq_client.models.list().data 
            if not any(ex in m.id.lower() for ex in excluded)
        ]
        print("Available Groq text models on your account:", models)

        for preferred in [
            "openai/gpt-oss-20b",
            "openai/gpt-oss-120b",
            "qwen/qwen3.8-27b",
            "llama-3.3-70b-versatile",
            "llama-3.1-8b-instant",
            "llama3-70b-8192",
            "llama3-8b-8192",
            "mixtral-8x7b-32768",
            "gemma2-9b-it"
        ]:
            if preferred in models:
                return preferred
        return models[0] if models else "openai/gpt-oss-20b"
    except Exception as e:
        print("Could not fetch Groq model list, defaulting:", e)
        return "openai/gpt-oss-20b"

def parse_with_grok(prompt: str, context: str) -> ParsedTask:
    model_to_use = get_best_groq_model()
    response = groq_client.chat.completions.create(
        model=model_to_use,
        messages=[
            {"role": "system", "content": f"{SYSTEM_PROMPT}\n{context}"},
            {"role": "user", "content": prompt}
        ],
        temperature=0.1
    )
    clean_text = response.choices[0].message.content.strip().replace("```json", "").replace("```", "")
    data = json.loads(clean_text)
    data["ai_used"] = f"Groq ({model_to_use})"
    return ParsedTask(**data)

def parse_with_gemini(prompt: str, context: str) -> ParsedTask:
    response = gemini_client.chat.completions.create(
        model="gemini-1.5-flash",
        messages=[
            {"role": "system", "content": f"{SYSTEM_PROMPT}\n{context}"},
            {"role": "user", "content": prompt}
        ],
        temperature=0.1
    )
    clean_text = response.choices[0].message.content.strip().replace("```json", "").replace("```", "")
    data = json.loads(clean_text)
    data["ai_used"] = "Google Gemini"
    return ParsedTask(**data)

def extract_task(prompt: str, model: str, user_date: str, user_time: str, timezone: str) -> ParsedTask:
    context = f"Reference today: {user_date}, current time: {user_time}, timezone: {timezone}."
    if model == "grok":
        return parse_with_grok(prompt, context)
    else:
        return parse_with_gemini(prompt, context)