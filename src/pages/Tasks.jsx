import { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  updateDoc,
  deleteDoc,
  setDoc,
} from "firebase/firestore";
import { useToast } from "../context/ToastContext";
import TaskCard from "../components/TaskCard";
import { trainLocalModel } from "../utils/localML";
import { checkAndTriggerEmail } from "../services/email";

export default function Tasks() {
  const { addToast } = useToast();
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sortBy, setSortBy] = useState("deadline");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    const tasksRef = collection(db, "users", user.uid, "tasks");
    const q = query(tasksRef, orderBy("createdAt", "desc"));

    const unsub = onSnapshot(q, (snapshot) => {
      const loaded = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setTasks(loaded);
      setLoading(false);
    });

    return () => unsub();
  }, [user]);

  // Actions
  const handleStartTask = async (task) => {
    try {
      await updateDoc(doc(db, "users", user.uid, "tasks", task.id), { status: "progress" });
      addToast(`Started "${task.title}"`, { type: "success" });
    } catch (err) {
      console.error(err);
      addToast("Failed to update task", { type: "error" });
    }
  };

  const handleCompleteTask = async (task) => {
    try {
      await updateDoc(doc(db, "users", user.uid, "tasks", task.id), { status: "completed" });
      trainLocalModel(task, false); // Train online ML model: 0% procrastination
      addToast(`Completed "${task.title}"! 🎉`, { type: "success" });
    } catch (err) {
      console.error(err);
      addToast("Failed to complete task", { type: "error" });
    }
  };

  const handleDeferTask = async (task, newDeadline, reason) => {
    try {
      const originalDeadline = task.deadline?.toDate ? task.deadline.toDate() : new Date(task.deadline);
      const newHistoryEntry = {
        timestamp: new Date(),
        oldDeadline: originalDeadline,
        newDeadline: newDeadline,
        reason: reason,
      };
      await updateDoc(doc(db, "users", user.uid, "tasks", task.id), {
        deadline: newDeadline,
        deferralCount: (task.deferralCount || 0) + 1,
        deferralHistory: [...(task.deferralHistory || []), newHistoryEntry],
      });
      trainLocalModel(task, true); // Train online ML model: 100% procrastination
      addToast(`Deferred "${task.title}"`, { type: "success" });

      // Trigger email check on manual deferral
      const deferredTask = {
        ...task,
        deadline: newDeadline,
        deferralCount: (task.deferralCount || 0) + 1,
      };
      checkAndTriggerEmail(deferredTask, "deferral").then((sent) => {
        if (sent) {
          addToast("Procrastination alert email sent successfully! 📧", { type: "info" });
        }
      }).catch(err => {
        console.error("Gmail alert dispatch failed:", err);
        addToast(`Email Alert Error: ${err.message || err}`, { type: "error", duration: 8000 });
      });
    } catch (err) {
      console.error(err);
      addToast("Failed to defer task", { type: "error" });
    }
  };

  const handleDeleteTask = async (task) => {
    try {
      await deleteDoc(doc(db, "users", user.uid, "tasks", task.id));
      addToast(`Deleted task "${task.title}"`, {
        type: "info",
        action: {
          label: "Undo",
          onClick: async () => {
            const restored = { ...task };
            delete restored.id;
            await setDoc(doc(db, "users", user.uid, "tasks", task.id), restored);
          },
        },
      });
    } catch (err) {
      console.error(err);
      addToast("Failed to delete task", { type: "error" });
    }
  };

  const handleToggleSubtask = async (task, subtaskIdx) => {
    try {
      const taskRef = doc(db, "users", user.uid, "tasks", task.id);
      const updatedSubtasks = task.subtasks.map((sub, idx) =>
        idx === subtaskIdx ? { ...sub, completed: !sub.completed } : sub
      );
      await updateDoc(taskRef, { subtasks: updatedSubtasks });
    } catch (err) {
      console.error(err);
      addToast("Failed to toggle subtask", { type: "error" });
    }
  };

  // Filter & Sort Logic
  const filteredTasks = tasks
    .filter((task) => {
      const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "all" || task.status === statusFilter;
      const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter;
      return matchesSearch && matchesStatus && matchesPriority;
    })
    .sort((a, b) => {
      if (sortBy === "deadline") {
        const dateA = a.deadline?.toDate ? a.deadline.toDate() : new Date(a.deadline);
        const dateB = b.deadline?.toDate ? b.deadline.toDate() : new Date(b.deadline);
        return dateA - dateB;
      }
      if (sortBy === "priority") {
        const priorityWeight = { high: 3, medium: 2, low: 1 };
        return priorityWeight[b.priority] - priorityWeight[a.priority];
      }
      if (sortBy === "createdAt") {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
        return dateB - dateA; // newest first
      }
      return 0;
    });

  return (
    <div className="flex-1 flex flex-col">
      <div className="mb-8">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
          All Tasks
        </h2>
        <p className="text-slate-400 text-sm mt-1">
          Search, filter, and organize your commitment inventory.
        </p>
      </div>

      {/* Filters block */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 sm:p-5 mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Search */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
            Search
          </label>
          <div className="relative">
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 outline-none transition"
            />
            <svg className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Status Filter */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
            Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs text-slate-100 outline-none transition appearance-none"
            style={{
              backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 1rem center",
              backgroundSize: "1em",
            }}
          >
            <option value="all">All Statuses</option>
            <option value="today">Due Today</option>
            <option value="progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        {/* Priority Filter */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
            Priority
          </label>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs text-slate-100 outline-none transition appearance-none"
            style={{
              backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 1rem center",
              backgroundSize: "1em",
            }}
          >
            <option value="all">All Priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        {/* Sort */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
            Sort By
          </label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs text-slate-100 outline-none transition appearance-none"
            style={{
              backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 1rem center",
              backgroundSize: "1em",
            }}
          >
            <option value="deadline">Deadline (Earliest first)</option>
            <option value="priority">Priority (Highest first)</option>
            <option value="createdAt">Date Created (Newest first)</option>
          </select>
        </div>
      </div>

      {/* Grid List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="bg-slate-900 border border-slate-800/50 rounded-2xl p-5 space-y-4 animate-pulse">
              <div className="h-4 bg-slate-800 rounded w-16" />
              <div className="h-5 bg-slate-800 rounded w-3/4" />
              <div className="h-4 bg-slate-800 rounded w-24 pt-3 border-t border-slate-800/30" />
            </div>
          ))}
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="bg-slate-900/20 border border-slate-800/60 rounded-2xl p-12 text-center flex flex-col items-center justify-center">
          <svg className="w-16 h-16 text-slate-700 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="text-lg font-bold text-slate-300">No matching tasks found</h3>
          <p className="text-slate-500 text-sm mt-1 max-w-sm">
            Try adjusting your search criteria or filters to see your tasks.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onComplete={handleCompleteTask}
              onDelete={handleDeleteTask}
              onDefer={handleDeferTask}
              onStart={handleStartTask}
              onToggleSubtask={handleToggleSubtask}
            />
          ))}
        </div>
      )}
    </div>
  );
}