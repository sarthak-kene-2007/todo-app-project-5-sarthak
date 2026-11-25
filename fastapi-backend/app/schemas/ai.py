from pydantic import BaseModel
from typing import Literal

class NaturalLanguageInput(BaseModel):
    prompt: str
    model: Literal["gemini", "grok"] = "gemini"  # User's choice
    user_date: str       # e.g. "2026-11-25"
    user_time: str       # e.g. "14:30:00"
    timezone: str = "UTC"

class ParsedTask(BaseModel):
    title: str
    description: str | None = None
    priority: Literal["Low", "Medium", "High"] = "Medium"
    due_date: str | None = None
    due_time: str | None = None
    ai_used: str | None = None
    