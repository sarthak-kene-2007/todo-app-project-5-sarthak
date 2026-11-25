import os
import json
import google.generativeai as genai
from openai import OpenAI
from app.schemas.ai import ParsedTask

# 1. Setup Gemini
genai.configure(api_key=os.getenv("GEMINI_API_KEY", ""))

# 2. Setup Grok (uses xAI's OpenAI-compatible API)
xai_client = OpenAI(
    api_key=os.getenv("XAI_API_KEY", ""),
    base_url="https://api.groq.com/openai/v1"
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

def parse_with_gemini(prompt: str, context: str) -> ParsedTask:
    model = genai.GenerativeModel(
        model_name="gemini-1.5-flash",
        generation_config={"response_mime_type": "application/json"}
    )
    full_text = f"{SYSTEM_PROMPT}\n{context}\nUser task: {prompt}"
    response = model.generate_content(full_text)
    data = json.loads(response.text)
    data["ai_used"] = "Google Gemini"
    return ParsedTask(**data)

def parse_with_grok(prompt: str, context: str) -> ParsedTask:
    response = xai_client.chat.completions.create(
        model="grok-beta",
        messages=[
            {"role": "system", "content": f"{SYSTEM_PROMPT}\n{context}"},
            {"role": "user", "content": prompt}
        ],
        temperature=0.1
    )
    clean_text = response.choices[0].message.content.strip().replace("```json", "").replace("```", "")
    data = json.loads(clean_text)
    data["ai_used"] = "xAI Grok"
    return ParsedTask(**data)

def extract_task(prompt: str, model: str, user_date: str, user_time: str, timezone: str) -> ParsedTask:
    context = f"Reference today: {user_date}, current time: {user_time}, timezone: {timezone}."
    
    if model == "grok":
        return parse_with_grok(prompt, context)
    else:
        return parse_with_gemini(prompt, context)