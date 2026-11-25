import NaturalLanguageInput from "./components/NaturalLanguageInput";
import { useState, useEffect, useCallback } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import LandingPage from "./components/LandingPage";
import TaskWorkspace from "./components/TaskWorkspace";
import TaskFormModal from "./components/TaskFormModal";
import DashboardOverview from "./components/DashboardOverview";
import KanbanBoard from "./components/KanbanBoard";
import TaskCalendar from "./components/TaskCalendar";
import AdminDashboard from "./components/AdminDashboard";
import AdminUserManagement from "./components/AdminUserManagement";
import AdminTaskOverview from "./components/AdminTaskOverview";
import AdminTaskAssignments from "./components/AdminTaskAssignments";
import UserAssignedTasks from "./components/UserAssignedTasks";
import NotificationToast from "./components/NotificationToast";
import SettingsView from "./components/SettingsView";
import AuthView from "./components/AuthView";
import { taskApi } from "./taskAPI";
import { teamApi } from "./teamAPI";
import { preferenceApi } from "./productivityAPI";

function getInitialRoute() {
  const path = window.location.pathname.toLowerCase();
  const hash = window.location.hash.toLowerCase();

  if (path === "/login" || hash === "#login" || hash === "#/login") {
    return "login";
  }
  if (path === "/register" || hash === "#register" || hash === "#/register") {
    return "register";
  }
  if (
    path === "/app" ||
    path === "/dashboard" ||
    path.startsWith("/app") ||
    path.startsWith("/dashboard") ||
    hash === "#app" ||
    hash === "#/app" ||
    hash.startsWith("#dashboard") ||
    hash.startsWith("#tasks") ||
    hash.startsWith("#kanban") ||
    hash.startsWith("#calendar") ||
    hash.startsWith("#completed") ||
    hash.startsWith("#settings") ||
    hash.startsWith("#admin")
  ) {
    return "app";
  }
  return "landing";
}

function AuthenticatedApp({ onNavigateHome }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const isAdmin = user?.role === "Admin";

  const [activeTab, setActiveTab] = useState(() => (isAdmin ? "admin-dashboard" : "dashboard"));
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [initialDueDate, setInitialDueDate] = useState(null);
  const [initialStatus, setInitialStatus] = useState("Pending");
  const [refreshKey, setRefreshKey] = useState(0);

  // Apply saved theme immediately on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem("planova_theme") || "light";
    if (savedTheme === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.setAttribute("data-theme", prefersDark ? "dark" : "light");
    } else {
      document.documentElement.setAttribute("data-theme", savedTheme);
    }
  }, []);

  // Fetch preferences from FastAPI when authenticated and sync theme & default view
  useEffect(() => {
    if (isAuthenticated) {
      preferenceApi
        .get()
        .then((pref) => {
          if (pref?.theme) {
            localStorage.setItem("planova_theme", pref.theme);
            if (pref.theme === "system") {
              const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
              document.documentElement.setAttribute("data-theme", prefersDark ? "dark" : "light");
            } else {
              document.documentElement.setAttribute("data-theme", pref.theme);
            }
          }
          if (!isAdmin && pref?.default_task_view) {
            setActiveTab((prev) => (prev === "dashboard" ? pref.default_task_view : prev));
          }
        })
        .catch(() => {});
    }
  }, [isAuthenticated, isAdmin]);

  // Set default tab when user object first loads
  useEffect(() => {
    if (user?.role === "Admin" && activeTab === "dashboard") {
      setActiveTab("admin-dashboard");
    }
  }, [user?.role]);

  // Security fallback: Non-admin users cannot stay on administrative tabs
  useEffect(() => {
    if (user && user.role !== "Admin" && activeTab.startsWith("admin-")) {
      setActiveTab("dashboard");
    }
  }, [user, activeTab]);

  // Dashboard tasks data state (fetched from real FastAPI backend)
  const [dashTasks, setDashTasks] = useState([]);
  const [dashAssignments, setDashAssignments] = useState([]);
  const [dashLoading, setDashLoading] = useState(true);
  const [dashError, setDashError] = useState("");

  const loadDashboardTasks = useCallback(async () => {
    if (!isAuthenticated) return;
    setDashLoading(true);
    setDashError("");
    try {
      const [data, assignments] = await Promise.all([
        taskApi.getAll(),
        teamApi.getMyAssignedTasks().catch(() => []),
      ]);
      setDashTasks(data);
      setDashAssignments(assignments);
    } catch (err) {
      setDashError(err instanceof Error ? err.message : "Failed to load dashboard tasks");
    } finally {
      setDashLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      loadDashboardTasks();
    }
  }, [isAuthenticated, loadDashboardTasks, refreshKey]);

  // If restoring or validating session
  if (isLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg, #f8fafc)",
          gap: "16px",
        }}
      >
        <div
          style={{
            width: "42px",
            height: "42px",
            border: "3px solid #e2e8f0",
            borderTopColor: "#4f46e5",
            borderRadius: "50%",
            animation: "auth-spin 0.8s linear infinite",
          }}
        />
        <p style={{ color: "#64748b", fontWeight: 600, fontSize: "0.95rem" }}>
          Validating Planova session...
        </p>
        <style>{`@keyframes auth-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Open Add Task form
  const handleAdd = (options = {}) => {
    setEditingTask(null);
    setInitialDueDate(options?.dueDate || null);
    setInitialStatus(options?.status || "Pending");
    setFormOpen(true);
  };

  // Open Edit Task form
  const handleEdit = (task) => {
    setEditingTask(task);
    setInitialDueDate(null);
    setInitialStatus(task.status);
    setFormOpen(true);
  };

  // Open task directly from notification bell click
  const handleNotificationClick = async (taskId) => {
    if (!taskId) return;
    try {
      const task = await taskApi.getById(taskId);
      if (task) {
        handleEdit(task);
      }
    } catch {
      setActiveTab("tasks");
    }
  };

  // Close the form
  const handleClose = () => {
    setFormOpen(false);
    setEditingTask(null);
    setInitialDueDate(null);
    setInitialStatus("Pending");
  };

  // Refresh data after saving
  const handleSaved = () => {
    setRefreshKey((previous) => previous + 1);
  };

  // Quick status toggle directly from the Dashboard
  const handleDashboardStatusChange = async (task, newStatus) => {
    try {
      const updated = await taskApi.update(task.id, { status: newStatus });
      setDashTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
      setRefreshKey((prev) => prev + 1);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update task status");
    }
  };

  return (
    <Layout
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      onAddTask={() => handleAdd()}
      onNotificationClick={handleNotificationClick}
      onNavigateHome={onNavigateHome}
    >
      {/* ================= ADMIN VIEWS (Protected) ================= */}

      {/* Admin Tab 1: System Admin Dashboard */}
      {activeTab === "admin-dashboard" && isAdmin && (
        <AdminDashboard
          onNavigateUsers={() => setActiveTab("admin-users")}
          onNavigateTasks={() => setActiveTab("admin-tasks")}
          onNavigateAssignments={() => setActiveTab("admin-assignments")}
          onNavigatePersonal={() => setActiveTab("dashboard")}
        />
      )}

      {/* Admin Tab 2: User Accounts Administration */}
      {activeTab === "admin-users" && isAdmin && (
        <AdminUserManagement />
      )}

      {/* Admin Tab 3: System-Wide Tasks Overview */}
      {activeTab === "admin-tasks" && isAdmin && (
        <AdminTaskOverview />
      )}

      {/* Admin Tab 4: Team Task Assignments */}
      {activeTab === "admin-assignments" && isAdmin && (
        <AdminTaskAssignments />
      )}

      {/* ================= PERSONAL WORKSPACE VIEWS ================= */}

      {/* Tab 1: Real User Dashboard & Analytics */}
      {activeTab === "dashboard" && (
        <DashboardOverview
          tasks={dashTasks}
          assignedTasks={dashAssignments}
          loading={dashLoading}
          error={dashError}
          onAddTask={() => handleAdd()}
          onEditTask={handleEdit}
          onStatusChange={handleDashboardStatusChange}
          onViewAll={() => setActiveTab("tasks")}
          onViewCompleted={() => setActiveTab("completed")}
          onViewAssignedTasks={() => setActiveTab("assigned-to-me")}
          onRetry={loadDashboardTasks}
        />
      )}

      {/* Tab 2: My Tasks Board (Ishwari's TaskWorkspace) */}
      {activeTab === "tasks" && (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1.5rem",
              flexWrap: "wrap",
              gap: "16px",
              background: "var(--surface, #ffffff)",
              padding: "20px 24px",
              borderRadius: "14px",
              border: "1px solid var(--border, #e2e8f0)",
              boxShadow: "0 1px 3px rgba(16, 24, 40, 0.05)",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <h2 style={{ fontSize: "1.5rem", fontWeight: "800", color: "var(--text, #0f172a)", margin: 0 }}>
                  My Tasks
                </h2>
                <span className="badge badge-group">All Tasks</span>
              </div>
              <p style={{ color: "var(--muted, #64748b)", fontSize: "0.925rem", margin: 0 }}>
                Manage, organize, search, and filter all your tasks with real-time updates.
              </p>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => handleAdd()}
              style={{ padding: "10px 20px" }}
            >
              <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" style={{ width: "18px", height: "18px" }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span>New Task</span>
            </button>
          </div>
                    {/* Natural Language Task Input with AI Selection */}
          <NaturalLanguageInput
            onTaskCreated={() => {
              setRefreshKey((prev) => prev + 1);
              loadDashboardTasks();
            }}
          />

          

          <TaskWorkspace
            key={`all-${refreshKey}`}
            onEdit={handleEdit}
            onAddTask={() => handleAdd()}
            initialStatusFilter="All"
          />
        </>
      )}

      {/* Tab 3: Kanban Board */}
      {activeTab === "kanban" && (
        <KanbanBoard
          key={`kanban-${refreshKey}`}
          onEdit={handleEdit}
          onAddTaskWithStatus={(status) => handleAdd({ status })}
        />
      )}

      {/* Tab 4: Calendar View */}
      {activeTab === "calendar" && (
        <TaskCalendar
          key={`calendar-${refreshKey}`}
          onEdit={handleEdit}
          onAddTaskOnDate={(dateStr) => handleAdd({ dueDate: dateStr })}
          onViewAssignment={() => setActiveTab("assigned-to-me")}
        />
      )}

      {/* Tab 5: Completed Tasks View */}
      {activeTab === "completed" && (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1.5rem",
              flexWrap: "wrap",
              gap: "16px",
              background: "var(--surface, #ffffff)",
              padding: "20px 24px",
              borderRadius: "14px",
              border: "1px solid var(--border, #e2e8f0)",
              boxShadow: "0 1px 3px rgba(16, 24, 40, 0.05)",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <h2 style={{ fontSize: "1.5rem", fontWeight: "800", color: "var(--text, #0f172a)", margin: 0 }}>
                  Completed Tasks
                </h2>
                <span className="badge badge-group" style={{ background: "#ecfdf5", color: "#065f46" }}>
                  Completed
                </span>
              </div>
              <p style={{ color: "var(--muted, #64748b)", fontSize: "0.925rem", margin: 0 }}>
                All completed milestones. You can search, filter, or reopen any task at any time.
              </p>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => handleAdd()}
              style={{ padding: "10px 20px" }}
            >
              <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" style={{ width: "18px", height: "18px" }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span>New Task</span>
            </button>
          </div>

          <TaskWorkspace
            key={`completed-${refreshKey}`}
            onEdit={handleEdit}
            onAddTask={() => handleAdd()}
            initialStatusFilter="Completed"
          />
        </>
      )}

      {/* Tab: Assigned to Me (Enterprise Team Collaboration) */}
      {activeTab === "assigned-to-me" && (
        <UserAssignedTasks onTasksChanged={handleSaved} />
      )}

      {/* Tab 6: Settings & Preferences (Step 7) */}
      {activeTab === "settings" && (
        <SettingsView />
      )}

      {/* Real-time Notification Popups */}
      <NotificationToast
        onNavigateToTask={(taskId, assignmentId) => {
          if (assignmentId) {
            setActiveTab("assigned-to-me");
          } else if (taskId) {
            handleNotificationClick(taskId);
          }
        }}
      />

      {/* Add / Edit Task Modal (Sanyukta & Step 7 Smart Features) */}
      <TaskFormModal
        open={formOpen}
        mode={editingTask !== null ? "edit" : "add"}
        task={editingTask}
        initialDueDate={initialDueDate}
        initialStatus={initialStatus}
        onClose={handleClose}
        onSaved={handleSaved}
      />
    </Layout>
  );
}

function MainRouter() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [route, setRoute] = useState(getInitialRoute);

  const navigate = (newRoute, urlPath) => {
    try {
      window.history.pushState(null, "", urlPath);
    } catch {
      window.location.hash = urlPath.replace("/", "");
    }
    setRoute(newRoute);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Sync route on popstate / hashchange
  useEffect(() => {
    const handleUrlChange = () => {
      setRoute(getInitialRoute());
    };
    window.addEventListener("popstate", handleUrlChange);
    window.addEventListener("hashchange", handleUrlChange);
    return () => {
      window.removeEventListener("popstate", handleUrlChange);
      window.removeEventListener("hashchange", handleUrlChange);
    };
  }, []);

  // If user is already authenticated and visits login/register, redirect to app
  useEffect(() => {
    if (isAuthenticated && (route === "login" || route === "register")) {
      navigate("app", "/app");
    }
  }, [isAuthenticated, route]);

  // Loading state while restoring session
  if (isLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg, #f8fafc)",
          gap: "16px",
        }}
      >
        <div
          style={{
            width: "42px",
            height: "42px",
            border: "3px solid #e2e8f0",
            borderTopColor: "#4f46e5",
            borderRadius: "50%",
            animation: "auth-spin 0.8s linear infinite",
          }}
        />
        <p style={{ color: "#64748b", fontWeight: 600, fontSize: "0.95rem" }}>
          Validating Planova session...
        </p>
        <style>{`@keyframes auth-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Route 1: Public Landing Page
  if (route === "landing") {
    return (
      <LandingPage
        onNavigateLogin={() => navigate("login", "/login")}
        onNavigateRegister={() => navigate("register", "/register")}
        onNavigateApp={() => navigate("app", "/app")}
        isAuthenticated={isAuthenticated}
        userRole={user?.role}
      />
    );
  }

  // Route 2: Sign In Page
  if (route === "login") {
    return (
      <AuthView
        initialMode="login"
        onBackToHome={() => navigate("landing", "/")}
        onSuccess={() => navigate("app", "/app")}
        onModeChange={(m) => navigate(m, m === "login" ? "/login" : "/register")}
      />
    );
  }

  // Route 3: Registration Page
  if (route === "register") {
    return (
      <AuthView
        initialMode="register"
        onBackToHome={() => navigate("landing", "/")}
        onSuccess={() => navigate("app", "/app")}
        onModeChange={(m) => navigate(m, m === "login" ? "/login" : "/register")}
      />
    );
  }

  // Route 4: Protected Workspace Application
  if (route === "app") {
    // If not authenticated, redirect to login
    if (!isAuthenticated) {
      return (
        <AuthView
          initialMode="login"
          onBackToHome={() => navigate("landing", "/")}
          onSuccess={() => navigate("app", "/app")}
          onModeChange={(m) => navigate(m, m === "login" ? "/login" : "/register")}
        />
      );
    }
    return <AuthenticatedApp onNavigateHome={() => navigate("landing", "/")} />;
  }

  // Fallback
  return (
    <LandingPage
      onNavigateLogin={() => navigate("login", "/login")}
      onNavigateRegister={() => navigate("register", "/register")}
      onNavigateApp={() => navigate("app", "/app")}
      isAuthenticated={isAuthenticated}
      userRole={user?.role}
    />
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainRouter />
    </AuthProvider>
  );
}
