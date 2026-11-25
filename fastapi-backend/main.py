import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.auth import router as auth_router
from app.routes.tasks import router as task_router
from app.routes.categories import router as category_router
from app.routes.admin import router as admin_router
from app.routes.subtasks import router as subtask_router
from app.routes.tags import router as tag_router
from app.routes.reminders import router as reminder_router
from app.routes.notifications import router as notification_router
from app.routes.activity_logs import router as activity_log_router
from app.routes.preferences import router as preference_router
from app.routes.team_tasks import router as team_task_router
from app.routes.ai import router as ai_router
app = FastAPI(
    title="Planova Task Management API",
    description="Backend APIs for task management, subtasks, tags, reminders, notifications, and administration",
    version="2.0.0"
)

# Configure trusted origins for CORS
allowed_origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:5175",
]

# Allow production frontend domain explicitly configured via environment variable
cors_env = os.getenv("CORS_ORIGINS", "")
if cors_env.strip():
    for origin in cors_env.split(","):
        clean_origin = origin.strip().rstrip("/")
        if clean_origin and clean_origin not in allowed_origins:
            allowed_origins.append(clean_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$",  # Local loopback development only
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Authentication APIs
app.include_router(auth_router)

# Task and Category Core APIs
app.include_router(task_router)
app.include_router(category_router)

# Step 7 Smart Productivity APIs
app.include_router(subtask_router)
app.include_router(tag_router)
app.include_router(reminder_router)
app.include_router(notification_router)
app.include_router(activity_log_router)
app.include_router(preference_router)

# Administrative APIs
app.include_router(admin_router)

# Enterprise Team Collaboration & Task Assignments
app.include_router(team_task_router)
# AI Natural Language Task Parser
app.include_router(ai_router, prefix="/api/v1/ai", tags=["ai"])

@app.get("/", tags=["default"])
def home():
    return {
        "message": "Planova FastAPI Backend is running!",
        "version": "2.0.0",
    }


@app.get("/health", tags=["default"])
def health():
    return {
        "status": "healthy"
    }
