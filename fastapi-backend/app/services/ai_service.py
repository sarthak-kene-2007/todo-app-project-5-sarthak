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
import urllib.request
import urllib.error

def get_gemini_model_and_version(api_key: str):
    """Automatically queries Google's ModelService to find the exact available Gemini model."""
    for api_ver in ["v1beta", "v1"]:
        try:
            url = f"https://generativelanguage.googleapis.com/{api_ver}/models?key={api_key}"
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                models = [
                    m["name"].replace("models/", "")
                    for m in data.get("models", [])
                    if "generateContent" in m.get("supportedGenerationMethods", [])
                ]
                print(f"Available Gemini models on your key ({api_ver}):", models)
                for preferred in [
                    "gemini-3.8-flash",
                    "gemini-2.0-flash",
                    "gemini-1.5-flash",
                    "gemini-pro"
                ]:
                    if preferred in models:
                        return preferred, api_ver
                if models:
                    # Filter out retired models like gemini-2.5-flash
                    active = [m for m in models if "2.5" not in m]
                    return (active[0] if active else "gemini-3.8-flash"), api_ver
        except Exception as e:
            print(f"ListModels error for {api_ver}:", e)
    return "gemini-3.8-flash", "v1beta"

def parse_with_gemini(prompt: str, context: str) -> ParsedTask:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    
    # Priority cascade: try newer flash, then stable flash, then lighter 8b
    candidate_models = [
        ("gemini-3.8-flash", "v1beta"),
        ("gemini-2.0-flash", "v1beta"),
        ("gemini-1.5-flash-8b", "v1beta"),
        ("gemini-1.5-pro", "v1beta"),
    ]
    
    for model_name, api_ver in candidate_models:
        url = f"https://generativelanguage.googleapis.com/{api_ver}/models/{model_name}:generateContent?key={api_key}"
        payload = {
            "contents": [{
                "parts": [{
                    "text": f"{SYSTEM_PROMPT}\n{context}\nUser task: {prompt}"
                }]
            }],
            "generationConfig": {
                "responseMimeType": "application/json"
            }
        }
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        try:
            with urllib.request.urlopen(req) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                content_text = data["candidates"][0]["content"]["parts"][0]["text"]
                task_dict = json.loads(content_text)
                task_dict["ai_used"] = f"Google Gemini ({model_name})"
                return ParsedTask(**task_dict)
        except urllib.error.HTTPError as e:
            error_body = e.read().decode("utf-8")
            print(f"Gemini {model_name} returned {e.code} (High demand/error), trying next model in cascade...")
            continue
        except Exception as e:
            print(f"Connection error on {model_name}:", e)
            continue

    # Seamless Fallback: If all Google Gemini servers are experiencing 503 load, fulfill via Groq
    print("All Gemini models temporarily overloaded (503). Fulfilling task via Groq fallback...")
    fallback_task = parse_with_grok(prompt, context)
    fallback_task.ai_used = "Groq (Gemini High-Demand Fallback)"
    return fallback_task
def extract_task(prompt: str, model: str, user_date: str, user_time: str, timezone: str) -> ParsedTask:
    context = f"Reference today: {user_date}, current time: {user_time}, timezone: {timezone}."
    if model == "grok":
        return parse_with_grok(prompt, context)
    else:
        return parse_with_gemini(prompt, context)