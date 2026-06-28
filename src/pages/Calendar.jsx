import { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { collection, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { getWorkDaysOfWeek, generateMockMeetings, autoScheduleSubtasks, fetchGoogleCalendarEvents } from "../utils/scheduler";
import { optimizeScheduleWithGemini } from "../services/gemini";
import WeeklyCalendarGrid from "../components/WeeklyCalendarGrid";
import { useToast } from "../context/ToastContext";

export default function Calendar() {
  const { addToast } = useToast();
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Phase 4 States
  const [viewMode, setViewMode] = useState("month"); // "month" | "week"
  const [useMockMeetings, setUseMockMeetings] = useState(true);
  const [googleAccessToken, setGoogleAccessToken] = useState(
    localStorage.getItem("deadlineiq_google_oauth_token") || ""
  );
  const [googleEvents, setGoogleEvents] = useState([]);
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(false);
  const [optimizing, setOptimizing] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    const tasksRef = collection(db, "users", user.uid, "tasks");
    const unsub = onSnapshot(tasksRef, (snapshot) => {
      const loaded = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setTasks(loaded);
    });
    return () => unsub();
  }, [user]);

  // Fetch Google Calendar events when token or currentDate changes
  useEffect(() => {
    if (!googleAccessToken) return;

    const loadGoogleEvents = async () => {
      setIsLoadingCalendar(true);
      try {
        const workDays = getWorkDaysOfWeek(currentDate);
        const timeMin = new Date(workDays[0]);
        timeMin.setHours(0, 0, 0, 0);
        const timeMax = new Date(workDays[4]);
        timeMax.setHours(23, 59, 59, 999);

        const events = await fetchGoogleCalendarEvents(
          googleAccessToken,
          timeMin.toISOString(),
          timeMax.toISOString()
        );
        setGoogleEvents(events);
        setUseMockMeetings(false); // Auto disable mock mode if we have real events
      } catch (err) {
        console.error("Failed to load Google Calendar events:", err);
        addToast("Google Calendar session expired. Please reconnect.", { type: "error" });
        // Clear expired token
        setGoogleAccessToken("");
        localStorage.removeItem("deadlineiq_google_oauth_token");
        setUseMockMeetings(true);
      } finally {
        setIsLoadingCalendar(false);
      }
    };

    loadGoogleEvents();
  }, [googleAccessToken, currentDate, addToast]);

  const handleConnectGoogleCalendar = async () => {
    const provider = new GoogleAuthProvider();
    provider.addScope("https://www.googleapis.com/auth/calendar.readonly");

    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken;

      if (token) {
        setGoogleAccessToken(token);
        localStorage.setItem("deadlineiq_google_oauth_token", token);
        addToast("Successfully connected Google Calendar!", { type: "success" });
      } else {
        throw new Error("No access token returned");
      }
    } catch (err) {
      console.error("OAuth Connection Failed:", err);
      addToast("Failed to connect Google Calendar.", { type: "error" });
    }
  };

  const handleDisconnectGoogleCalendar = () => {
    setGoogleAccessToken("");
    localStorage.removeItem("deadlineiq_google_oauth_token");
    setGoogleEvents([]);
    setUseMockMeetings(true);
    addToast("Disconnected Google Calendar.", { type: "info" });
  };

  // Compile active meetings & run auto scheduler
  const meetings = useMockMeetings 
    ? generateMockMeetings(currentDate) 
    : googleEvents;

  const scheduledEvents = autoScheduleSubtasks(tasks, meetings, currentDate);

  const handleAIOptimizeSchedule = async () => {
    if (!user) return;
    const activeUncompletedTasks = tasks.filter(t => t.status !== "completed");
    const subtaskCount = activeUncompletedTasks.reduce((sum, t) => sum + (t.subtasks ? t.subtasks.filter(s => !s.completed).length : 0), 0);
    if (subtaskCount === 0) {
      addToast("No active subtasks found to optimize. Create some tasks first!", { type: "info" });
      return;
    }
    setOptimizing(true);
    try {
      let profile = {
        primaryPattern: "Fear of Failure",
        triggerCategories: ["Writing", "Presentations"],
        explanation: "Prefers morning focus for high impact tasks."
      };
      const cachedPattern = localStorage.getItem(`deadlineiq_pattern_${user.uid}`);
      if (cachedPattern) {
        try {
          profile = JSON.parse(cachedPattern);
        } catch {
          console.warn("Cached pattern parse failed");
        }
      }

      const workDays = getWorkDaysOfWeek(currentDate);
      const data = await optimizeScheduleWithGemini(tasks, meetings, profile, workDays);

      const updatePromises = data.optimizedSlots.map(async (slot) => {
        const task = tasks.find(t => t.id === slot.taskId);
        if (task && task.subtasks) {
          const updatedSubtasks = [...task.subtasks];
          if (updatedSubtasks[slot.subtaskIdx]) {
            updatedSubtasks[slot.subtaskIdx] = {
              ...updatedSubtasks[slot.subtaskIdx],
              scheduledStart: slot.scheduledStart,
              scheduledEnd: slot.scheduledEnd,
              optimizationReason: slot.reason
            };
            const taskRef = doc(db, "users", user.uid, "tasks", task.id);
            await updateDoc(taskRef, { subtasks: updatedSubtasks });
          }
        }
      });

      await Promise.all(updatePromises);
      addToast("Weekly schedule optimized by AI! 🧠✨", { type: "success" });
    } catch (err) {
      console.error("Failed to optimize schedule:", err);
      addToast(err.message || "Failed to optimize schedule", { type: "error" });
    } finally {
      setOptimizing(false);
    }
  };

  // Month Calendar math
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const prevMonthTotalDays = new Date(year, month, 0).getDate();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const handlePrevPeriod = () => {
    if (viewMode === "month") {
      setCurrentDate(new Date(year, month - 1, 1));
    } else {
      // Go back 1 week
      const prevWeek = new Date(currentDate);
      prevWeek.setDate(currentDate.getDate() - 7);
      setCurrentDate(prevWeek);
    }
  };

  const handleNextPeriod = () => {
    if (viewMode === "month") {
      setCurrentDate(new Date(year, month + 1, 1));
    } else {
      // Go forward 1 week
      const nextWeek = new Date(currentDate);
      nextWeek.setDate(currentDate.getDate() + 7);
      setCurrentDate(nextWeek);
    }
  };

  // Generate Month Calendar Days Grid
  const monthCells = [];

  // Previous month trailing days
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    monthCells.push({
      dayNum: prevMonthTotalDays - i,
      isCurrentMonth: false,
      date: new Date(year, month - 1, prevMonthTotalDays - i)
    });
  }

  // Current month days
  for (let i = 1; i <= totalDays; i++) {
    monthCells.push({
      dayNum: i,
      isCurrentMonth: true,
      date: new Date(year, month, i)
    });
  }

  // Next month leading days (pad grid to 42 cells)
  const remainingCells = 42 - monthCells.length;
  for (let i = 1; i <= remainingCells; i++) {
    monthCells.push({
      dayNum: i,
      isCurrentMonth: false,
      date: new Date(year, month + 1, i)
    });
  }

  // Helper to match tasks to date (for Month View)
  const getTasksForDate = (date) => {
    return tasks.filter((task) => {
      if (!task.deadline) return false;
      const deadlineDate = task.deadline.toDate ? task.deadline.toDate() : new Date(task.deadline);
      return (
        deadlineDate.getDate() === date.getDate() &&
        deadlineDate.getMonth() === date.getMonth() &&
        deadlineDate.getFullYear() === date.getFullYear()
      );
    });
  };

  const getPriorityColor = (priority) => {
    if (priority === "high") return "bg-rose-500";
    if (priority === "medium") return "bg-amber-500";
    return "bg-emerald-500";
  };

  return (
    <div className="flex-1 flex flex-col">
      <div className="mb-8 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
            Task Calendar & Intelligence
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Map deadlines and auto-schedule subtasks into open calendar slots.
          </p>
        </div>

        {/* Action controls block */}
        <div className="flex-1 flex flex-wrap items-center justify-between gap-4 bg-slate-900/30 border border-slate-800/80 p-3 rounded-2xl backdrop-blur-xl">
          {/* Left section: Navigations & View Toggles */}
          <div className="flex flex-wrap items-center gap-3">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-950 border border-slate-850 rounded-xl p-1">
              <button
                onClick={() => setViewMode("month")}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                  viewMode === "month" ? "bg-white/[0.04] text-indigo-400" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Month
              </button>
              <button
                onClick={() => setViewMode("week")}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                  viewMode === "week" ? "bg-white/[0.04] text-indigo-400" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Week
              </button>
            </div>

            {/* Navigation Selector */}
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-850 rounded-xl p-1">
              <button
                onClick={handlePrevPeriod}
                className="p-1.5 hover:bg-slate-850 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-xs font-bold text-slate-200 px-2 min-w-[130px] text-center select-none">
                {viewMode === "month" ? (
                  `${monthNames[month]} ${year}`
                ) : (
                  `Week of ${getWorkDaysOfWeek(currentDate)[0].toLocaleDateString([], { month: "short", day: "numeric" })}`
                )}
              </span>
              <button
                onClick={handleNextPeriod}
                className="p-1.5 hover:bg-slate-850 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Right section: Sync & AI Optimization Actions */}
          <div className="flex items-center gap-2.5">
            {/* Google Calendar Link */}
            {googleAccessToken ? (
              <button
                onClick={handleDisconnectGoogleCalendar}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/20 text-rose-455 transition cursor-pointer"
              >
                Disconnect Sync
              </button>
            ) : (
              <button
                onClick={handleConnectGoogleCalendar}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-850 text-slate-350 transition flex items-center gap-1.5 cursor-pointer"
              >
                Connect Google Calendar
              </button>
            )}

            {/* AI Optimizer */}
            <button
              onClick={handleAIOptimizeSchedule}
              disabled={optimizing}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-indigo-500 to-purple-650 hover:scale-[1.02] active:scale-[0.98] text-white shadow-lg shadow-indigo-500/10 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
            >
              {optimizing ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Optimizing...
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Optimize Schedule
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {isLoadingCalendar && (
        <div className="mb-4 text-center py-2 bg-indigo-950/20 border border-indigo-500/20 rounded-xl text-xs text-indigo-400 font-semibold flex items-center justify-center gap-2 animate-pulse">
          <svg className="animate-spin h-4 w-4 text-indigo-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Fetching Google Calendar synchronization...
        </div>
      )}

      {/* Render selected view */}
      {viewMode === "month" ? (
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 sm:p-5 flex-1 flex flex-col">
          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-2 mb-3 text-center">
            {daysOfWeek.map((day) => (
              <div key={day} className="text-xs font-bold text-slate-500 uppercase tracking-widest py-1">
                {day}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5 flex-1 min-h-[420px]">
            {monthCells.map((cell, idx) => {
              const dateTasks = getTasksForDate(cell.date);
              const isToday = new Date().toDateString() === cell.date.toDateString();

              return (
                <div
                  key={idx}
                  className={`p-3 flex flex-col justify-between min-h-[64px] sm:min-h-[96px] transition-all duration-300 rounded-2xl select-none ${
                    cell.isCurrentMonth
                      ? "bg-white/[0.015] hover:bg-white/[0.035] hover:scale-[1.01]"
                      : "bg-white/[0.005] opacity-20"
                  } ${
                    isToday
                      ? "bg-indigo-500/10 shadow-[0_0_20px_rgba(99,102,241,0.15)] ring-1 ring-indigo-500/25"
                      : ""
                  }`}
                >
                  <span
                    className={`text-xs font-bold self-start ${
                      isToday ? "text-indigo-400" : cell.isCurrentMonth ? "text-slate-350" : "text-slate-650"
                    }`}
                  >
                    {cell.dayNum}
                  </span>

                  <div className="mt-2 space-y-1 overflow-y-hidden max-h-[48px] sm:max-h-[64px]">
                    {dateTasks.slice(0, 3).map((task) => (
                      <div
                        key={task.id}
                        title={task.title}
                        className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded-lg text-[9px] font-semibold text-slate-100 truncate ${
                          task.status === "completed"
                            ? "bg-white/[0.01] line-through opacity-40"
                            : "bg-white/[0.03] border border-white/[0.04]"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${getPriorityColor(task.priority)} shrink-0`} />
                        <span className="truncate">{task.title}</span>
                      </div>
                    ))}
                    {dateTasks.length > 3 && (
                      <div className="text-[8px] font-bold text-slate-500 pl-1 uppercase tracking-wider">
                        +{dateTasks.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <WeeklyCalendarGrid referenceDate={currentDate} events={scheduledEvents} />
      )}
    </div>
  );
}