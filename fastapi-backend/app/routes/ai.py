from fastapi import APIRouter, HTTPException
from app.schemas.ai import NaturalLanguageInput, ParsedTask
from app.services.ai_service import extract_task

router = APIRouter()

@router.post("/parse-task", response_model=ParsedTask)
def parse_task_route(payload: NaturalLanguageInput):
    try:
        return extract_task(
            prompt=payload.prompt,
            model=payload.model,
            user_date=payload.user_date,
            user_time=payload.user_time,
            timezone=payload.timezone
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI parse error: {str(e)}")