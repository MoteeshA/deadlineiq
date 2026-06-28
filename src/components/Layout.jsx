import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase";
import { collection, addDoc, doc, updateDoc, serverTimestamp, onSnapshot } from "firebase/firestore";
import AIAgentSidebar from "./AIAgentSidebar";
import AISpeaker from "./AISpeaker";
import { useToast } from "../context/ToastContext";

export default function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [mouseCoords, setMouseCoords] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMouseCoords({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const [notifications, setNotifications] = useState([
    {
      id: "notif-1",
      icon: "•",
      title: "Peak Window Active",
      text: "Peak Focus Window (9-11 AM) is active. Dynamic prioritization enabled.",
      time: "Just now",
      unread: true,
    },
    {
      id: "notif-2",
      icon: "!",
      title: "Sync Block Shifted",
      text: "Lunch Break ended. Subtask scheduling slots automatically shifted.",
      time: "20m ago",
      unread: true,
    },
    {
      id: "notif-3",
      icon: "!",
      title: "Emergency Lock Active",
      text: "High-priority deadline breach due in < 2 hours. Planner locked.",
      time: "1h ago",
      unread: false,
    },
  ]);

  const { addToast } = useToast();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    const handleToggle = () => {
      setIsSidebarOpen((prev) => !prev);
    };
    window.addEventListener("toggle-ai-sidebar", handleToggle);
    return () => window.removeEventListener("toggle-ai-sidebar", handleToggle);
  }, []);

  // Sync tasks in Layout for the global AI agent sidebar
  useEffect(() => {
    if (!user) return;
    const tasksRef = collection(db, "users", user.uid, "tasks");
    const unsub = onSnapshot(tasksRef, (snapshot) => {
      setTasks(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
    });
    return () => unsub();
  }, [user]);

  const executeAgentAction = async (action) => {
    if (!user || !action || action.type === "NONE") return;
    try {
      const { type, payload } = action;

      if (type === "ADD_TASK") {
        await addDoc(collection(db, "users", user.uid, "tasks"), {
          title: payload.title,
          priority: payload.priority || "medium",
          estimatedHours: payload.estimatedHours || 2,
          type: "General",
          status: "today",
          createdAt: serverTimestamp(),
          deferralCount: 0,
          deferralHistory: [],
          subtasks: [
            { title: "Research & Outline", durationHours: Math.max(0.5, Math.round((payload.estimatedHours || 2) * 0.3 * 10) / 10), completed: false },
            { title: "Implementation Draft", durationHours: Math.max(0.5, Math.round((payload.estimatedHours || 2) * 0.5 * 10) / 10), completed: false },
            { title: "Review & Refine", durationHours: Math.max(0.5, Math.round((payload.estimatedHours || 2) * 0.2 * 10) / 10), completed: false }
          ]
        });
        addToast(`AI Agent created task: "${payload.title}"`, { type: "success" });
      }

      else if (type === "DEFER_TASK") {
        const taskRef = doc(db, "users", user.uid, "tasks", payload.taskId);
        const originalTask = tasks.find(t => t.id === payload.taskId);
        const oldDeadline = originalTask?.deadline?.toDate ? originalTask.deadline.toDate() : new Date(originalTask?.deadline || new Date());
        
        await updateDoc(taskRef, {
          deadline: new Date(payload.newDeadline),
          deferralCount: (originalTask?.deferralCount || 0) + 1,
          deferralHistory: [
            ...(originalTask?.deferralHistory || []),
            {
              timestamp: new Date(),
              oldDeadline: oldDeadline,
              newDeadline: new Date(payload.newDeadline),
              reason: "Rescheduled via AI Agent Coach Dialogue"
            }
          ]
        });
        addToast(`AI Agent rescheduled task.`, { type: "success" });
      }

      else if (type === "COMPLETE_TASK") {
        const taskRef = doc(db, "users", user.uid, "tasks", payload.taskId);
        await updateDoc(taskRef, { status: "completed" });
        addToast(`AI Agent completed task! 🎉`, { type: "success" });
      }
    } catch (err) {
      console.error("AI Agent automation failed:", err);
      addToast("AI Agent automation failed.", { type: "error" });
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.querySelector("main")?.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const renderNotificationBell = (alignClass = "left-0") => {
    const unreadCount = notifications.filter(n => n.unread).length;

    return (
      <div className="relative">
        <button
          onClick={() => setShowNotifications(!showNotifications)}
          className="p-2 text-slate-400 hover:text-slate-250 hover:bg-white/5 rounded-xl transition relative shrink-0"
          aria-label="Notifications"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-slate-900 animate-pulse" />
          )}
        </button>

        {showNotifications && (
          <div className={`absolute ${alignClass} mt-2.5 w-80 bg-slate-950/95 border border-slate-800/90 backdrop-blur-xl rounded-2xl shadow-2xl p-3 z-50 animate-zoom-in`}>
            <div className="flex items-center justify-between border-b border-slate-850/60 pb-2 mb-2 px-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 select-none">
                AI Agent Activity Alerts
              </span>
              {unreadCount > 0 && (
                <button
                  onClick={() => setNotifications(notifications.map(n => ({ ...n, unread: false })))}
                  className="text-[9px] font-bold text-indigo-400 hover:text-indigo-300 transition"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="space-y-1.5 max-h-64 overflow-y-auto scrollbar-none">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => {
                    setNotifications(notifications.map(item => item.id === n.id ? { ...item, unread: false } : item));
                    setShowNotifications(false);
                  }}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer flex gap-3 text-left ${
                    n.unread
                      ? "bg-indigo-950/15 border-indigo-500/20 hover:bg-indigo-950/25"
                      : "bg-slate-900/30 border-slate-850/50 hover:bg-slate-900/50"
                  }`}
                >
                  <span className="text-sm shrink-0 mt-0.5 select-none">{n.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <h5 className={`text-[11px] font-bold truncate leading-none ${n.unread ? "text-slate-100" : "text-slate-350"}`}>
                        {n.title}
                      </h5>
                      <span className="text-[8px] font-semibold text-slate-500 shrink-0">
                        {n.time}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-normal mt-1.5 font-medium">
                      {n.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const navItems = [
    {
      name: "Dashboard",
      path: "/dashboard",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" />
        </svg>
      ),
    },
    {
      name: "Tasks",
      path: "/tasks",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
    {
      name: "Calendar",
      path: "/calendar",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 3V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      name: "Insights",
      path: "/insights",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      name: "Habits",
      path: "/habits",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
    {
      name: "Add Extension",
      path: "/extension",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
        </svg>
      ),
    },
    {
      name: "Settings",
      path: "/settings",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="h-screen bg-[#03030a] text-white flex flex-col md:flex-row relative overflow-hidden">
      {/* Moving aurora backgrounds & cursor spotlights */}
      <div className="aurora-bg">
        <div className="aurora-mesh" />
      </div>
      <div 
        className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-300"
        style={{
          background: `radial-gradient(600px circle at ${mouseCoords.x}px ${mouseCoords.y}px, rgba(99, 102, 241, 0.05), transparent 80%)`
        }}
      />

      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex md:w-64 bg-white/[0.025] border border-violet-300/12 backdrop-blur-[28px] h-[calc(100vh-3rem)] m-6 mr-0 p-5 flex-col justify-between shrink-0 select-none shadow-[0_30px_90px_rgba(0,0,0,0.6)] rounded-[28px] relative z-20">
        <div>
          {/* Logo */}
          <div className="flex items-center gap-3.5 px-2 mb-8 mt-2">
            <div className="w-8 h-8 rounded-2xl bg-violet-500/20 border border-violet-300/20 shadow-[0_0_26px_rgba(139,92,246,0.36)] flex items-center justify-center shrink-0">
              <div className="w-2.5 h-2.5 rounded-full bg-violet-300 shadow-[0_0_12px_rgba(167,139,250,0.9)] animate-pulse" />
            </div>
            <span className="text-sm font-black bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300 bg-clip-text text-transparent tracking-widest uppercase font-mono select-none">
              DeadlineIQ
            </span>
          </div>

          {/* Nav Items */}
          <nav className="flex flex-col gap-2.5 max-h-[calc(100vh-16rem)] overflow-y-auto scrollbar-none">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`flex items-center gap-4 px-3.5 py-3 rounded-2xl text-sm font-medium transition-all duration-250 group relative ${
                    isActive
                      ? "bg-violet-500/18 text-violet-100 shadow-[0_0_32px_rgba(139,92,246,0.22)] font-bold border border-violet-300/16"
                      : "text-slate-400 hover:text-slate-100 hover:bg-white/[0.015]"
                  }`}
                >
                  <span className={`shrink-0 transition-transform duration-200 group-hover:scale-110 ${isActive ? "text-indigo-400" : "text-slate-500 group-hover:text-slate-300"}`}>
                    {item.icon}
                  </span>
                  <span className="whitespace-nowrap text-xs font-bold font-mono tracking-wider ml-1">
                    {item.name}
                  </span>
                </Link>
              );
            })}

            {/* Product Reveal */}
            <Link
              to="/"
              onClick={async (e) => {
                e.preventDefault();
                await handleLogout();
              }}
              className="flex items-center gap-4 px-3.5 py-3 rounded-2xl text-sm font-medium transition-all duration-250 group text-slate-450 hover:text-slate-150 hover:bg-white/[0.015] cursor-pointer"
            >
              <span className="shrink-0 text-slate-500 group-hover:text-slate-350 transition-transform duration-200 group-hover:scale-110">
                🚀
              </span>
              <span className="whitespace-nowrap text-xs font-bold font-mono tracking-wider ml-1">
                Product Reveal
              </span>
            </Link>
          </nav>
        </div>

        {/* User profile & Logout */}
        {user && (
          <div className="border-t border-white/5 pt-4 flex flex-col gap-3">
            <div className="flex items-center gap-3 px-2">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || "Avatar"}
                  className="w-8 h-8 rounded-full border border-white/10 object-cover shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-650 flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-lg">
                  {user.displayName ? user.displayName.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase() || "U"}
                </div>
              )}
              <div className="overflow-hidden min-w-0">
                <p className="text-xs font-bold text-slate-200 truncate">
                  {user.displayName || user.email?.split("@")[0] || "User"}
                </p>
                <p className="text-[10px] text-slate-500 truncate font-mono">{user.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center justify-start gap-3.5 w-full px-3.5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider bg-white/[0.02] hover:bg-rose-950/20 hover:text-rose-400 border border-white/5 hover:border-rose-500/10 text-slate-400 transition-all duration-200 cursor-pointer"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="font-mono">Sign Out</span>
            </button>
          </div>
        )}
      </aside>

      {/* Mobile Top Header */}
      <header className="md:hidden flex items-center justify-between px-6 py-4 bg-slate-950/30 border-b border-white/5 backdrop-blur-md sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.8)]" />
          <span className="text-lg font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            DeadlineIQ
          </span>
        </div>
        {user && (
          <div className="flex items-center gap-3">
            {renderNotificationBell("right-0")}
            <button
              onClick={handleLogout}
              className="text-slate-400 hover:text-rose-400 transition p-1 cursor-pointer"
              aria-label="Logout"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 pb-24 md:pb-0 overflow-y-auto z-20 relative bg-[radial-gradient(circle_at_70%_20%,rgba(124,58,237,0.14),transparent_28%)]">
        <div className="p-4 sm:p-6 md:p-6 max-w-[1500px] w-full mx-auto flex-1 flex flex-col">
          {location.pathname === "/dashboard" && (
            <div className="mb-5 rounded-[28px] border border-violet-300/18 bg-[#0b0820]/95 px-6 py-5 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-md">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-300/80 font-mono">
                DeadlineIQ Workspace
              </div>
              <h1 className="mt-2 text-3xl font-black tracking-normal text-white">
                Dashboard
              </h1>
            </div>
          )}
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-4 left-4 right-4 z-40 bg-slate-950/90 border border-white/10 backdrop-blur-xl rounded-2xl shadow-2xl py-2 px-4 flex justify-around items-center">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.name}
              to={item.path}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl transition ${
                isActive ? "text-indigo-400 scale-105" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <span>{item.icon}</span>
              <span className="text-[10px] font-medium">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Floating AI Coach Button */}
      {user && (
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="fixed bottom-24 right-6 md:bottom-8 md:right-8 z-40 w-14 h-14 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-purple-500/25 flex items-center justify-center border border-white/10 cursor-pointer group"
          title="Chat with AI Productivity Coach"
        >
          <svg className="w-6 h-6 text-white group-hover:animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-pink-500 border-2 border-slate-950"></span>
          </span>
        </button>
      )}

      {/* Speaking Orb Speaker */}
      <AISpeaker user={user} tasks={tasks} />

      {/* Global AI Agent Sidebar */}
      <AIAgentSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        user={user}
        tasks={tasks}
        onExecuteAction={executeAgentAction}
      />
    </div>
  );
}
