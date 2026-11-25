import type { Task, CreateTaskRequest, UpdateTaskRequest, Category } from "./types/task";
import { getStoredToken } from "./authAPI";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

// Optional fallback mock tasks strictly for offline reference or isolated unit tests
export const DEMO_TASKS: Task[] = [
  {
    id: 1,
    user_id: 1,
    category_id: 1,
    title: "Prepare quarterly budget presentation",
    description: "Consolidate revenue projections and expense reports for the executive team.",
    status: "Pending",
    priority: "Low",
    due_date: "2026-11-28",
    created_at: "2026-11-18T10:00:00Z",
    updated_at: "2026-11-18T12:00:00Z",
  },
  {
    id: 2,
    user_id: 1,
    category_id: 2,
    title: "Finalize client contract proposal",
    description: "Review deliverable scope, timelines, and terms with team leads.",
    status: "Pending",
    priority: "Medium",
    due_date: "2026-11-25",
    created_at: "2026-11-19T14:30:00Z",
    updated_at: "2026-11-20T08:00:00Z",
  },
  {
    id: 3,
    user_id: 1,
    category_id: 2,
    title: "Build frontend Task Display components",
    description: "Create TaskWorkspace, TaskList, TaskCard, and filter toolbar.",
    status: "InProgress",
    priority: "High",
    due_date: "2026-11-22",
    created_at: "2026-11-20T09:00:00Z",
    updated_at: "2026-11-20T09:00:00Z",
  },
  {
    id: 4,
    user_id: 1,
    category_id: 3,
    title: "Set up project repository & folder structure",
    description: "Initialize Git repository, README, and project directory structure.",
    status: "Completed",
    priority: "High",
    due_date: "2026-11-20",
    created_at: "2026-11-20T11:00:00Z",
    updated_at: "2026-11-20T11:00:00Z",
  },
];

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> || {}),
  };

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error("Authentication required or session expired. Please log in.");
    }

    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") {
        message = body.detail;
      } else if (Array.isArray(body.detail) && body.detail.length > 0) {
        message = body.detail.map((d: { msg?: string }) => d.msg ?? "").filter(Boolean).join(", ");
      }
    } catch {
      if (res.statusText) message = res.statusText;
    }
    throw new Error(message);
  }

  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const taskApi = {
  getAll: async (): Promise<Task[]> => {
    return await request<Task[]>("/api/tasks/");
  },

  getById: async (id: number): Promise<Task> => {
    return await request<Task>(`/api/tasks/${id}`);
  },

  create: async (data: CreateTaskRequest): Promise<Task> => {
    return await request<Task>("/api/tasks/", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  update: async (id: number, data: UpdateTaskRequest): Promise<Task> => {
    return await request<Task>(`/api/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  remove: async (id: number): Promise<void> => {
    await request<void>(`/api/tasks/${id}`, { method: "DELETE" });
  },
};

export const categoryApi = {
  getAll: async (): Promise<Category[]> => {
    return await request<Category[]>("/api/categories/");
  },
  create: async (name: string): Promise<Category> => {
    return await request<Category>("/api/categories/", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  },
};
export async function parseNaturalLanguageTask(prompt: string, model: "gemini" | "grok") {
  const now = new Date();
  const user_date = now.toISOString().split("T")[0];
  const user_time = now.toTimeString().split(" ")[0];
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return await request<CreateTaskRequest>("/api/v1/ai/parse-task", {
    method: "POST",
    body: JSON.stringify({
      prompt,
      model,
      user_date,
      user_time,
      timezone,
    }),
  });
}