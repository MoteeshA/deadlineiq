import { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  deleteDoc,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useToast } from "../context/ToastContext";
import TaskCard from "../components/TaskCard";
import TaskModal from "../components/TaskModal";
import AITaskInput from "../components/AITaskInput";
import InterventionCard from "../components/InterventionCard";
import TriageMode from "../components/TriageMode";
import { logAvoidanceEvent } from "../services/forensics";
import EmergencyBanner from "../components/EmergencyBanner";
import { generateMockMeetings, fetchGoogleCalendarEvents } from "../utils/scheduler";
import { trainLocalModel, predictProcrastinationRisk } from "../utils/localML";
import { checkAndTriggerEmail } from "../services/email";
import { Activity, CheckCircle2, Clock3, Pause, Play, Plus, RotateCcw, ShieldAlert, Timer, Volume2 } from "lucide-react";


export default function Dashboard() {
  const { addToast } = useToast();
  const [user, setUser] = useState(null);
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const handleMove = (e) => {
      const x = (e.clientX - window.innerWidth / 2) / 60;
      const y = (e.clientY - window.innerHeight / 2) / 60;
      setMouseOffset({ x, y });
    };
    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, []);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tunnelVisionTaskId, setTunnelVisionTaskId] = useState(null);
  
  // Phase 4 states
  const [emergencyTasks, setEmergencyTasks] = useState([]);
  const [overrunningMeeting, setOverrunningMeeting] = useState(null);
  
  // Phase 6 states
  const [showOnboarding, setShowOnboarding] = useState(false);

  const [activeAgentIndex, setActiveAgentIndex] = useState(0);
  const agents = [
    { name: "Planning Agent", status: "Optimizing schedule slots..." },
    { name: "Reminder Agent", status: "Dispatching email digest..." },
    { name: "Calendar Agent", status: "Syncing Google Calendar..." },
    { name: "Analytics Agent", status: "Scanning forensic logs..." }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveAgentIndex((idx) => (idx + 1) % 4);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  // Pomodoro States
  const [pomodoroTime, setPomodoroTime] = useState(25 * 60);
  const [pomodoroActive, setPomodoroActive] = useState(false);

  useEffect(() => {
    let interval = null;
    if (pomodoroActive && pomodoroTime > 0) {
      interval = setInterval(() => {
        setPomodoroTime((t) => {
          if (t <= 1) {
            setPomodoroActive(false);
            addToast("Focus session complete! Take a break. ☕", { type: "success" });
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [pomodoroActive, pomodoroTime, addToast]);

  // Monitor Emergency Mode tasks and Overrunning Meetings
  useEffect(() => {
    const checkStatus = async () => {
      const now = new Date();
      
      // 1. Identify active high-priority tasks due in <= 2 hours (120 mins)
      const urgent = tasks.filter((t) => {
        if (t.status === "completed" || t.priority !== "high" || !t.deadline) return false;
        const deadlineDate = t.deadline.toDate ? t.deadline.toDate() : new Date(t.deadline);
        const diffMs = deadlineDate.getTime() - now.getTime();
        const diffMins = diffMs / (1000 * 60);
        // Include tasks due in less than 2 hours, or overdue by less than 2 hours
        return diffMins > -120 && diffMins <= 120;
      });
      setEmergencyTasks(urgent);

      // 2. Scan calendar events for current day to find any overrunning meetings
      let meetings;
      const googleToken = localStorage.getItem("deadlineiq_google_oauth_token");
      if (googleToken) {
        try {
          const todayStart = new Date(now);
          todayStart.setHours(0, 0, 0, 0);
          const todayEnd = new Date(now);
          todayEnd.setHours(23, 59, 59, 999);
          meetings = await fetchGoogleCalendarEvents(googleToken, todayStart.toISOString(), todayEnd.toISOString());
        } catch (err) {
          console.error("Dashboard failed to fetch google events, using mock", err);
          meetings = generateMockMeetings(now);
        }
      } else {
        meetings = generateMockMeetings(now);
      }

      const overrunning = meetings.find((meet) => {
        const end = new Date(meet.end);
        const diffMins = (now.getTime() - end.getTime()) / (1000 * 60);
        // Meeting ended in the last 30 minutes
        return diffMins > 0 && diffMins <= 30;
      });
      setOverrunningMeeting(overrunning || null);
    };

    if (tasks.length > 0) {
      checkStatus();
    }
  }, [tasks]);

  // Auth check
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) setLoading(false);
    });
    return () => unsub();
  }, []);

  // Tasks real-time sync
  useEffect(() => {
    if (!user) return;



    const tasksRef = collection(db, "users", user.uid, "tasks");
    const q = query(tasksRef, orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const loadedTasks = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setTasks(loadedTasks);
        setLoading(false);
      },
      (error) => {
        console.error("Error syncing tasks:", error);
        addToast("Failed to load tasks.", { type: "error" });
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user, addToast]);

  // Add task to Firestore
  const handleAddTask = async (taskData) => {
    if (!user) return;
    try {
      await addDoc(collection(db, "users", user.uid, "tasks"), {
        ...taskData,
        type: taskData.type || "General",
        subtasks: taskData.subtasks || [],
        status: "today", // Default status is Due Today
        createdAt: serverTimestamp(),
        deferralCount: 0,
        deferralHistory: [],
      });
      addToast(`Task "${taskData.title}" created successfully!`, { type: "success" });
      
      // Proactively check and send procrastination risk alerts via Resend
      checkAndTriggerEmail(taskData, "creation").then((sent) => {
        if (sent) {
          addToast("Procrastination alert email sent successfully! 📧", { type: "info" });
        }
      }).catch(err => {
        console.error("Gmail alert dispatch failed:", err);
        addToast(`Email Alert Error: ${err.message || err}`, { type: "error", duration: 8000 });
      });

    } catch (error) {
      console.error("Error creating task:", error);
      addToast("Failed to create task.", { type: "error" });
    }
  };

  // Move task to In Progress
  const handleStartTask = async (task) => {
    if (!user) return;
    try {
      const taskRef = doc(db, "users", user.uid, "tasks", task.id);
      await updateDoc(taskRef, { status: "progress" });
      addToast(`Started "${task.title}"`, { type: "success", duration: 2000 });
    } catch (error) {
      console.error("Error starting task:", error);
      addToast("Failed to start task.", { type: "error" });
    }
  };

  // Complete Task
  const handleCompleteTask = async (task) => {
    if (!user) return;
    try {
      const taskRef = doc(db, "users", user.uid, "tasks", task.id);
      await updateDoc(taskRef, { status: "completed" });
      trainLocalModel(task, false); // Train online ML model: 0% procrastination
      addToast(`Completed "${task.title}"! 🎉`, { type: "success" });
    } catch (error) {
      console.error("Error completing task:", error);
      addToast("Failed to complete task.", { type: "error" });
    }
  };

  // Defer/Snooze Task
  const handleDeferTask = async (task, newDeadline, reason) => {
    if (!user) return;
    try {
      const taskRef = doc(db, "users", user.uid, "tasks", task.id);
      const originalDeadline = task.deadline?.toDate ? task.deadline.toDate() : new Date(task.deadline);
      
      const newHistoryEntry = {
        timestamp: new Date(),
        oldDeadline: originalDeadline,
        newDeadline: newDeadline,
        reason: reason,
      };

      await updateDoc(taskRef, {
        deadline: newDeadline,
        deferralCount: (task.deferralCount || 0) + 1,
        deferralHistory: [...(task.deferralHistory || []), newHistoryEntry],
      });

      // Silent background log of avoidance event
      await logAvoidanceEvent(user.uid, task, newDeadline, reason);

      trainLocalModel(task, true); // Train online ML model: 100% procrastination

      addToast(`Snoozed "${task.title}"`, { type: "success" });
    } catch (error) {
      console.error("Error deferring task:", error);
      addToast("Failed to defer task.", { type: "error" });
    }
  };

  // Crisis Triage De-prioritize
  const handleDeprioritizeTask = async (task) => {
    if (!user) return;
    try {
      const taskRef = doc(db, "users", user.uid, "tasks", task.id);
      const originalDeadline = task.deadline?.toDate ? task.deadline.toDate() : new Date(task.deadline);
      const newDeadline = new Date(originalDeadline.getTime() + 7 * 24 * 60 * 60 * 1000); // +7 days

      const newHistoryEntry = {
        timestamp: new Date(),
        oldDeadline: originalDeadline,
        newDeadline: newDeadline,
        reason: "Crisis Triage Postponement",
      };

      await updateDoc(taskRef, {
        deadline: newDeadline,
        deferralCount: (task.deferralCount || 0) + 1,
        deferralHistory: [...(task.deferralHistory || []), newHistoryEntry],
      });

      await logAvoidanceEvent(user.uid, task, newDeadline, "Crisis Triage Postponement");
      
      trainLocalModel(task, true); // Train online ML model: 100% procrastination
    } catch (error) {
      console.error("Error deprioritizing task:", error);
    }
  };

  // Delete Task with 5-Second Undo Toast
  const handleDeleteTask = async (task) => {
    if (!user) return;
    try {
      const taskRef = doc(db, "users", user.uid, "tasks", task.id);
      await deleteDoc(taskRef);

      addToast(`Deleted task "${task.title}"`, {
        type: "info",
        action: {
          label: "Undo",
          onClick: async () => {
            const restoredTask = { ...task };
            delete restoredTask.id; // Strip doc ID before write
            await setDoc(doc(db, "users", user.uid, "tasks", task.id), restoredTask);
            addToast("Task restored successfully!", { type: "success" });
          },
        },
      });
    } catch (error) {
      console.error("Error deleting task:", error);
      addToast("Failed to delete task.", { type: "error" });
    }
  };

  // Toggle Subtask Completion in Firestore
  const handleToggleSubtask = async (task, subtaskIdx) => {
    if (!user) return;
    try {
      const taskRef = doc(db, "users", user.uid, "tasks", task.id);
      const updatedSubtasks = task.subtasks.map((sub, idx) =>
        idx === subtaskIdx ? { ...sub, completed: !sub.completed } : sub
      );
      await updateDoc(taskRef, { subtasks: updatedSubtasks });
    } catch (error) {
      console.error("Error toggling subtask:", error);
      addToast("Failed to toggle subtask.", { type: "error" });
    }
  };

  // Calculations for Stats Header
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === "completed").length;
  const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Task Filter helper
  const kanbanColumns = [
    {
      title: "Due Today",
      statusKey: "today",
      accent: "bg-teal-500",
      empty: "Add a task or let the planner build your first focus block.",
      icon: <ShieldAlert className="h-11 w-11 text-slate-300" />,
    },
    {
      title: "In Progress",
      statusKey: "progress",
      accent: "bg-amber-500",
      empty: "Start one task to make the workspace come alive.",
      icon: <Activity className="h-11 w-11 text-slate-300" />,
    },
    {
      title: "Completed",
      statusKey: "completed",
      accent: "bg-emerald-500",
      empty: "Finished work will collect here for review.",
      icon: <CheckCircle2 className="h-11 w-11 text-slate-300" />,
    },
  ];

  const renderColumn = ({ title, statusKey, accent, empty, icon }) => {
    const columnTasks = tasks.filter((t) => t.status === statusKey);

    return (
      <section className="flex min-h-[470px] flex-col rounded-2xl border border-violet-400/15 bg-[#070713]/72 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.34)] backdrop-blur-xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className={`h-2.5 w-2.5 rounded-full ${accent}`} />
            <h3 className="text-xs font-black uppercase tracking-[0.14em] text-violet-100/75">{title}</h3>
          </div>
          <span className="rounded-full border border-violet-300/15 bg-white/[0.05] px-2.5 py-1 text-xs font-black text-violet-100/70">
            {columnTasks.length}
          </span>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto pr-1 scrollbar-none">
          {loading ? (
            Array.from({ length: 2 }).map((_, idx) => (
              <div key={idx} className="animate-pulse rounded-2xl border border-violet-300/10 bg-white/[0.04] p-4">
                <div className="mb-4 h-3 w-24 rounded bg-white/10" />
                <div className="mb-3 h-4 w-4/5 rounded bg-white/10" />
                <div className="h-3 w-2/3 rounded bg-white/10" />
              </div>
            ))
          ) : columnTasks.length === 0 ? (
            <div className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-violet-300/15 bg-white/[0.035] p-6 text-center">
              {icon}
              <p className="mt-4 text-xs font-black uppercase tracking-[0.14em] text-violet-100/65">No tasks</p>
              <p className="mt-2 max-w-[190px] text-xs font-medium leading-5 text-slate-400">{empty}</p>
            </div>
          ) : (
            columnTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onComplete={handleCompleteTask}
                onDelete={handleDeleteTask}
                onDefer={handleDeferTask}
                onStart={handleStartTask}
                onToggleSubtask={handleToggleSubtask}
              />
            ))
          )}
        </div>
      </section>
    );
  };

  const activeTasks = tasks.filter((t) => t.status !== "completed");
  const totalTasksCount = tasks.length;
  const completedTasksCount = tasks.filter((t) => t.status === "completed").length;
  const productivityScore = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 87;
  const focusTimeHours = activeTasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
  const focusHoursText = focusTimeHours > 0
    ? `${Math.floor(focusTimeHours)}h ${Math.round((focusTimeHours % 1) * 60)}m`
    : "0h 0m";
  const averageRisk = activeTasks.length > 0
    ? Math.round(activeTasks.reduce((sum, t) => sum + predictProcrastinationRisk(t), 0) / activeTasks.length)
    : 15;
  const riskLabel = averageRisk > 70 ? "High" : averageRisk > 40 ? "Medium" : "Low";
  const riskColor = averageRisk > 70 ? "text-rose-300" : averageRisk > 40 ? "text-violet-300" : "text-cyan-300";
  const highestRiskTask = [...activeTasks].sort((a, b) => predictProcrastinationRisk(b) - predictProcrastinationRisk(a))[0];
  const recommendationText = highestRiskTask
    ? `Move "${highestRiskTask.title}" into a protected focus block before 6 PM.`
    : "Your schedule is clear. Add one objective or take a proper pause.";
  const highPriorityCount = activeTasks.filter((t) => t.priority === "high").length;
  const overdueCount = activeTasks.filter((t) => {
    if (!t.deadline) return false;
    const d = t.deadline.toDate ? t.deadline.toDate() : new Date(t.deadline);
    return d < new Date();
  }).length;
  const availableHours = Math.max(0, 8 - activeTasks.reduce((acc, t) => acc + (t.estimatedHours || 0), 0));
  const focusBarWidth = Math.min(100, Math.max(8, (focusTimeHours / 8) * 100));

  return (
    <div className="flex-1 bg-transparent text-white relative min-h-screen z-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_38%,rgba(124,58,237,0.16),transparent_34%),radial-gradient(circle_at_32%_8%,rgba(59,130,246,0.10),transparent_28%)]" />

      <div className="mx-auto w-full max-w-[1500px] space-y-6 px-4 py-5 sm:px-6 lg:px-8 relative z-10">
        
        {/* Active Agent Banner */}
        <div 
          onClick={() => window.dispatchEvent(new CustomEvent("toggle-ai-sidebar"))}
          className="flex flex-col gap-3 rounded-[28px] border border-violet-300/18 bg-[#0b0820]/90 px-5 py-4 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-md sm:flex-row sm:items-center sm:justify-between hover:bg-[#100b2a]/90 transition-colors duration-300 cursor-pointer hover:border-indigo-500/30 group"
          title="Click to toggle AI Coach Sidebar"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/5 bg-white/[0.02] shadow-[0_0_24px_rgba(99,102,241,0.2)]">
              <span className="absolute inline-flex h-3 w-3 animate-ping rounded-full bg-indigo-400 opacity-45" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-indigo-400" />
            </span>
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 font-mono">Active agent</div>
              <div className="truncate text-sm font-black text-white">
                {agents[activeAgentIndex].name}
                <span className="ml-2 font-semibold text-slate-400 font-mono text-xs">{agents[activeAgentIndex].status}</span>
              </div>
            </div>
          </div>
          <span className="w-fit rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-300 font-mono group-hover:bg-indigo-500/15 group-hover:text-indigo-300 group-hover:border-indigo-500/30 transition-all duration-300">
            Multi-agent planning online • Click to open
          </span>
        </div>

        {/* Spatial Grid Section */}
        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          
          {/* Daily Command Brief Panel */}
          <div 
            style={{ transform: `translate3d(${mouseOffset.x * 0.4}px, ${mouseOffset.y * 0.4}px, 0)` }}
            className="relative min-h-[420px] overflow-hidden rounded-[32px] border border-violet-300/18 bg-[#080714]/92 p-8 text-white shadow-[0_30px_90px_rgba(0,0,0,0.55)] backdrop-blur-xl transition duration-300 hover:bg-[#0b0820]/95 ease-out"
          >
            <img
              src="/rmotion/ezgif-frame-150.jpg"
              alt=""
              className="absolute inset-y-0 right-0 z-0 h-full w-[62%] object-cover opacity-75 mix-blend-screen"
            />
            <div className="absolute inset-0 z-0 bg-[linear-gradient(90deg,rgba(8,7,20,0.98)_0%,rgba(8,7,20,0.84)_45%,rgba(8,7,20,0.16)_100%)]" />
            {/* Subtle light overlay */}
            <div className="absolute -inset-px z-0 bg-gradient-to-b from-white/[0.04] to-transparent pointer-events-none rounded-[32px]" />

            <div className="relative z-10 flex h-full min-h-[360px] flex-col justify-between gap-8">
              <div>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-slate-350 font-mono">
                  <Timer className="h-3.5 w-3.5 text-indigo-400" />
                  Daily command brief
                </div>
                
                <h2 className="max-w-xl text-3xl font-black leading-tight tracking-normal text-white sm:text-5xl">
                  Good Evening,
                  <span className="block bg-gradient-to-r from-white via-indigo-200 to-indigo-500 bg-clip-text text-transparent">
                    {user?.displayName || user?.email?.split("@")[0] || "User"}.
                  </span>
                </h2>
                
                <p className="mt-4 max-w-sm text-sm font-medium leading-relaxed text-slate-400">
                  AI Suggestion: <span className="font-semibold text-slate-200">{recommendationText}</span>
                </p>
              </div>

              {/* Parallax Stats inside Command Brief */}
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                {[
                  ["Focus score", `${productivityScore}%`, "Completion health"],
                  ["High priority", highPriorityCount, "Needs sequencing"],
                  ["Overdue", overdueCount, "Watch closely"],
                  ["Focus time", focusHoursText, "Scheduled work"],
                ].map(([label, value, helper]) => (
                  <div 
                    key={label} 
                    className="rounded-[20px] border border-white/5 bg-[#050505]/40 p-4 shadow-xl backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:border-white/15"
                  >
                    <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500 font-mono">{label}</div>
                    <div className="mt-2 text-xl font-black text-white font-mono">{value}</div>
                    <div className="mt-1 text-[10px] font-semibold text-slate-400">{helper}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column Parallax Widgets */}
          <div 
            style={{ transform: `translate3d(${mouseOffset.x * -0.3}px, ${mouseOffset.y * -0.3}px, 0)` }}
            className="grid gap-4 transition duration-350 ease-out"
          >
            {/* Risk Model Widget */}
            <div className="rounded-[28px] border border-violet-300/16 bg-[#0b0820]/88 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.42)] backdrop-blur-md hover:bg-[#100b2a]/90 transition duration-300 relative group">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 font-mono">Risk model</div>
                  <div className={`mt-2 text-4xl font-black font-mono ${riskColor}`}>{averageRisk}%</div>
                  <p className="mt-2 text-xs font-semibold text-slate-400">Current procrastination risk is {riskLabel.toLowerCase()}.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-slate-300 shadow-md">
                  <ShieldAlert className="h-6 w-6" />
                </div>
              </div>
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 shadow-[0_0_12px_rgba(139,92,246,0.5)] transition-all duration-500"
                  style={{ width: `${Math.max(8, averageRisk)}%` }}
                />
              </div>
            </div>

            {/* Capacity Map Widget */}
            <div className="rounded-[28px] border border-violet-300/16 bg-[#0b0820]/88 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.42)] backdrop-blur-md hover:bg-[#100b2a]/90 transition duration-300">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 font-mono">Capacity map</div>
                <Clock3 className="h-4 w-4 text-slate-400" />
              </div>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="text-3xl font-black text-indigo-400 font-mono">{Math.floor(availableHours)}h</div>
                  <p className="text-xs font-semibold text-slate-400">open in the day</p>
                </div>
                <div className="min-w-[140px] flex-1">
                  <div className="h-2 overflow-hidden rounded-full bg-white/5">
                    <div className="h-full rounded-full bg-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.5)]" style={{ width: `${focusBarWidth}%` }} />
                  </div>
                  <div className="mt-2 text-right text-[10px] font-bold text-slate-500 font-mono">{focusHoursText} planned</div>
                </div>
              </div>
            </div>

            {/* Creation and Briefing actions */}
            <div className="flex gap-3 mt-1">
              <button
                onClick={() => setIsModalOpen(true)}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white text-[#050505] px-4 py-3.5 text-xs font-black uppercase tracking-wider hover:bg-slate-100 transition active:scale-[0.98] cursor-pointer shadow-xl shadow-white/5"
              >
                <Plus className="h-4 w-4" />
                Create Task
              </button>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent("play-welcome-audio"))}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/5 bg-white/[0.03] hover:bg-white/[0.08] text-white px-5 py-3.5 text-xs font-black uppercase tracking-wider transition active:scale-[0.98] cursor-pointer"
              >
                <Volume2 className="h-4 w-4" />
                Briefing
              </button>
            </div>
          </div>
        </section>

        <EmergencyBanner emergencyTasks={emergencyTasks} />

        {overrunningMeeting && (
          <div className="rounded-[20px] border border-amber-500/20 bg-amber-500/5 p-4 text-amber-300 shadow-md">
            <h4 className="text-[10px] font-black uppercase tracking-[0.14em] font-mono">Meeting overrun warning</h4>
            <p className="mt-1 text-xs font-semibold text-slate-350">
              Sync "{overrunningMeeting.title}" is overrunning. Scheduling slots have adjusted to reduce delay impact.
            </p>
          </div>
        )}

        {emergencyTasks.length > 0 ? (
          <div className="rounded-3xl border border-rose-400/25 bg-[#070713]/82 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.3)] backdrop-blur-xl">
            <div className="mx-auto max-w-xl text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                <ShieldAlert className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-black text-white">Emergency Focus Mode</h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-violet-100/60">
                Complete or reschedule these urgent tasks to unlock the full planner.
              </p>
              <div className="mt-6 space-y-4 text-left">
                {emergencyTasks.map((t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    onComplete={handleCompleteTask}
                    onDelete={handleDeleteTask}
                    onDefer={handleDeferTask}
                    onStart={handleStartTask}
                    onToggleSubtask={handleToggleSubtask}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            <AITaskInput existingTasks={tasks} onSaveTask={handleAddTask} />
            <TriageMode tasks={tasks} onDeprioritize={handleDeprioritizeTask} />
            <InterventionCard
              tasks={tasks}
              userId={user?.uid}
              onReschedule={handleDeferTask}
              onActivateTunnelVision={(taskId) => setTunnelVisionTaskId(taskId)}
            />

            <div className="rounded-3xl border border-violet-400/15 bg-[#070713]/82 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.3)] backdrop-blur-xl">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.16em] text-violet-100/55">Today's completion pace</div>
                  <div className="mt-1 text-2xl font-black text-white">
                    {completedTasks} <span className="text-sm text-violet-100/45">/ {totalTasks} complete</span>
                  </div>
                </div>
                <div className="min-w-[220px] flex-1 sm:max-w-xl">
                  <div className="mb-2 flex justify-between text-xs font-black text-violet-100/55">
                    <span>Progress</span>
                    <span>{completionPercentage}%</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 shadow-[0_0_24px_rgba(139,92,246,0.68)] transition-all duration-500"
                      style={{ width: `${completionPercentage}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {tunnelVisionTaskId ? (
              <div className="relative rounded-3xl border border-violet-400/15 bg-[#070713]/82 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.3)] backdrop-blur-xl">
                <button
                  onClick={() => setTunnelVisionTaskId(null)}
                  className="absolute right-5 top-5 rounded-xl border border-violet-300/15 bg-white/[0.04] px-3 py-2 text-xs font-black text-violet-100 transition hover:bg-white/[0.08]"
                >
                  Exit Focus Mode
                </button>

                <div className="mx-auto max-w-md space-y-5 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-800">
                    <Play className="h-7 w-7" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white">Tunnel Vision Focus</h3>
                    <p className="mt-1 text-sm font-semibold text-violet-100/55">One card, one timer, no extra noise.</p>
                  </div>

                  <div className="rounded-2xl border border-violet-300/15 bg-white/[0.04] p-5">
                    <div className="text-[10px] font-black uppercase tracking-[0.14em] text-violet-100/55">Pomodoro timer</div>
                    <div className="mt-2 text-4xl font-black tracking-normal text-white">
                      {Math.floor(pomodoroTime / 60).toString().padStart(2, "0")}:{String(pomodoroTime % 60).padStart(2, "0")}
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                      <button
                        onClick={() => setPomodoroActive(!pomodoroActive)}
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-xs font-black text-white"
                      >
                        {pomodoroActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                        {pomodoroActive ? "Pause" : "Start"}
                      </button>
                      <button
                        onClick={() => {
                          setPomodoroActive(false);
                          setPomodoroTime(25 * 60);
                        }}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Reset
                      </button>
                    </div>
                  </div>

                  {tasks.find((t) => t.id === tunnelVisionTaskId) ? (
                    <div className="text-left">
                      <TaskCard
                        task={tasks.find((t) => t.id === tunnelVisionTaskId)}
                        onComplete={(t) => {
                          handleCompleteTask(t);
                          setTunnelVisionTaskId(null);
                        }}
                        onDelete={handleDeleteTask}
                        onDefer={handleDeferTask}
                        onStart={handleStartTask}
                        onToggleSubtask={handleToggleSubtask}
                      />
                    </div>
                  ) : (
                    <p className="text-sm font-semibold text-slate-500">Task not found or completed.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
                {kanbanColumns.map((column) => renderColumn(column))}
              </div>
            )}
          </>
        )}

        <TaskModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleAddTask}
        />


      </div>
    </div>
  );
}
