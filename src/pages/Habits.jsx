import { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { forecastHabitSuccess } from "../services/gemini";
import { useToast } from "../context/ToastContext";

export default function Habits() {
  const { addToast } = useToast();
  const [user, setUser] = useState(null);
  const [habits, setHabits] = useState([]);
  const [goals, setGoals] = useState([]);

  // New item inputs
  const [newHabitTitle, setNewHabitTitle] = useState("");
  const [newHabitFreq, setNewHabitFreq] = useState("daily");
  const [newGoalTitle, setNewGoalTitle] = useState("");

  // AI Forecast state
  const [forecasting, setForecasting] = useState(false);
  const [forecast, setForecast] = useState({
    successRate: 82,
    coachingText: "Align your creative habits with early focus windows. Starting tasks with a 10-minute micro-focus minimizes procrastination friction."
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsub();
  }, []);

  // Sync Habits
  useEffect(() => {
    if (!user) return;
    const habitsRef = collection(db, "users", user.uid, "habits");
    const unsub = onSnapshot(habitsRef, (snapshot) => {
      const loaded = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      setHabits(loaded);
    });
    return () => unsub();
  }, [user]);

  // Sync Goals
  useEffect(() => {
    if (!user) return;
    const goalsRef = collection(db, "users", user.uid, "goals");
    const unsub = onSnapshot(goalsRef, (snapshot) => {
      const loaded = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      setGoals(loaded);
    });
    return () => unsub();
  }, [user]);

  // Trigger AI Forecast
  const handleRecalculateForecast = async () => {
    if (!user) return;
    if (habits.length === 0) {
      addToast("Add some habits first to forecast success!", { type: "info" });
      return;
    }
    setForecasting(true);
    try {
      let profile = {
        primaryPattern: "Fear of Failure",
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

      const data = await forecastHabitSuccess(habits, profile);
      setForecast(data);
      addToast("AI Habit success likelihood forecast updated! 🧠🔥", { type: "success" });
    } catch (err) {
      console.error(err);
      addToast("Forecast failed", { type: "error" });
    } finally {
      setForecasting(false);
    }
  };

  // Add Habit
  const handleAddHabit = async (e) => {
    e.preventDefault();
    if (!user || !newHabitTitle.trim()) return;

    try {
      await addDoc(collection(db, "users", user.uid, "habits"), {
        title: newHabitTitle.trim(),
        frequency: newHabitFreq,
        streak: 0,
        history: [],
        lastCompleted: null,
        createdAt: serverTimestamp(),
      });
      setNewHabitTitle("");
      addToast(`Habit "${newHabitTitle}" added!`, { type: "success" });
    } catch (err) {
      console.error(err);
      addToast("Failed to add habit", { type: "error" });
    }
  };

  // Add Goal
  const handleAddGoal = async (e) => {
    e.preventDefault();
    if (!user || !newGoalTitle.trim()) return;

    try {
      await addDoc(collection(db, "users", user.uid, "goals"), {
        title: newGoalTitle.trim(),
        completed: false,
        createdAt: serverTimestamp(),
      });
      setNewGoalTitle("");
      addToast(`Goal "${newGoalTitle}" added!`, { type: "success" });
    } catch (err) {
      console.error(err);
      addToast("Failed to add goal", { type: "error" });
    }
  };

  // Toggle Habit Completion (Check in for today)
  const handleCheckInHabit = async (habit) => {
    if (!user) return;
    const habitRef = doc(db, "users", user.uid, "habits", habit.id);

    const todayStr = new Date().toISOString().slice(0, 10);
    const hasCompletedToday = (habit.history || []).includes(todayStr);

    let updatedHistory = [...(habit.history || [])];
    let updatedStreak = habit.streak || 0;

    if (hasCompletedToday) {
      // Uncheck
      updatedHistory = updatedHistory.filter((d) => d !== todayStr);
      updatedStreak = Math.max(0, updatedStreak - 1);
    } else {
      // Check in
      updatedHistory.push(todayStr);
      updatedStreak += 1;
    }

    try {
      await updateDoc(habitRef, {
        history: updatedHistory,
        streak: updatedStreak,
        lastCompleted: hasCompletedToday ? null : new Date().toISOString(),
      });
      addToast(hasCompletedToday ? "Removed check-in." : "Checked in! Keep the streak going! 🔥", {
        type: "success",
        duration: 1500,
      });
    } catch (err) {
      console.error(err);
      addToast("Failed to update check-in", { type: "error" });
    }
  };

  // Toggle Goal Completed
  const handleToggleGoal = async (goal) => {
    if (!user) return;
    const goalRef = doc(db, "users", user.uid, "goals", goal.id);
    try {
      await updateDoc(goalRef, { completed: !goal.completed });
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Habit
  const handleDeleteHabit = async (id) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, "users", user.uid, "habits", id));
      addToast("Habit deleted", { type: "info" });
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Goal
  const handleDeleteGoal = async (id) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, "users", user.uid, "goals", id));
      addToast("Goal deleted", { type: "info" });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Page Header */}
      <div className="mb-8">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
          Goals & Habits Hub
        </h2>
        <p className="text-slate-400 text-sm mt-1">
          Lock in daily routines and track milestones alongside your AI coach.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Habits list */}
        <div className="lg:col-span-2 space-y-6">
          {/* Habits Form Card */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 sm:p-6">
            <h3 className="text-sm font-bold text-slate-350 uppercase tracking-widest mb-4">
              ✨ Track a New Habit
            </h3>
            <form onSubmit={handleAddHabit} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Name your habit (e.g. Read 30 mins, Code React)"
                value={newHabitTitle}
                onChange={(e) => setNewHabitTitle(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 outline-none transition"
              />
              <select
                value={newHabitFreq}
                onChange={(e) => setNewHabitFreq(e.target.value)}
                className="bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs text-slate-355 placeholder-slate-500 outline-none transition"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
              <button
                type="submit"
                disabled={!newHabitTitle.trim()}
                className="px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-650 text-white font-bold text-xs tracking-wide transition active:scale-[0.98] disabled:opacity-50"
              >
                Add Habit
              </button>
            </form>
          </div>

          {/* Habits Tracker Card */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 sm:p-6">
            <h3 className="text-sm font-bold text-slate-350 uppercase tracking-widest mb-4">
              🔥 Habit Streak Checklist
            </h3>

            {habits.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs font-semibold">
                No habits added yet. Start tracking above!
              </div>
            ) : (
              <div className="space-y-3">
                {habits.map((habit) => {
                  const todayStr = new Date().toISOString().slice(0, 10);
                  const isChecked = (habit.history || []).includes(todayStr);

                  return (
                    <div
                      key={habit.id}
                      className="flex items-center justify-between gap-4 p-4 rounded-xl bg-slate-950/60 border border-slate-850 hover:bg-slate-900/30 transition"
                    >
                      <div className="flex items-center gap-3.5">
                        {/* Checkbox button */}
                        <button
                          onClick={() => handleCheckInHabit(habit)}
                          className={`w-5 h-5 rounded-md flex items-center justify-center transition border ${
                            isChecked
                              ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/10"
                              : "border-slate-700 hover:border-indigo-500 text-transparent"
                          }`}
                        >
                          ✓
                        </button>
                        <div>
                          <span
                            className={`text-xs font-bold text-slate-200 ${
                              isChecked ? "line-through text-slate-500" : ""
                            }`}
                          >
                            {habit.title}
                          </span>
                          <span className="block text-[8px] font-black tracking-widest uppercase text-slate-500 mt-0.5">
                            {habit.frequency}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        {/* Streak Badge */}
                        <div className="flex items-center gap-1.5 bg-indigo-950/30 border border-indigo-900 px-3 py-1 rounded-full text-[10px] font-bold text-indigo-400">
                          <span>🔥</span>
                          <span>{habit.streak || 0} Streak</span>
                        </div>

                        {/* Delete button */}
                        <button
                          onClick={() => handleDeleteHabit(habit.id)}
                          className="text-slate-600 hover:text-rose-400 transition"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Goals Card */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 sm:p-6">
            <h3 className="text-sm font-bold text-slate-350 uppercase tracking-widest mb-4">
              🎯 Long-Term Milestone Goals
            </h3>
            <form onSubmit={handleAddGoal} className="flex gap-3 mb-5">
              <input
                type="text"
                placeholder="Enter a milestone goal..."
                value={newGoalTitle}
                onChange={(e) => setNewGoalTitle(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 outline-none transition"
              />
              <button
                type="submit"
                disabled={!newGoalTitle.trim()}
                className="px-5 py-2.5 rounded-xl bg-purple-650 hover:bg-purple-700 text-white font-bold text-xs tracking-wide transition active:scale-[0.98] disabled:opacity-50"
              >
                Add Goal
              </button>
            </form>

            {goals.length === 0 ? (
              <div className="py-6 text-center text-slate-500 text-xs font-semibold">
                No goals added yet. Add one above!
              </div>
            ) : (
              <div className="space-y-2.5">
                {goals.map((goal) => (
                  <div
                    key={goal.id}
                    className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/60 border border-slate-850"
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleToggleGoal(goal)}
                        className={`w-4.5 h-4.5 rounded flex items-center justify-center border transition ${
                          goal.completed
                            ? "bg-purple-600 border-purple-500 text-white"
                            : "border-slate-800 hover:border-purple-500 text-transparent"
                        }`}
                      >
                        ✓
                      </button>
                      <span
                        className={`text-xs font-bold text-slate-200 ${
                          goal.completed ? "line-through text-slate-500" : ""
                        }`}
                      >
                        {goal.title}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteGoal(goal.id)}
                      className="text-slate-650 hover:text-rose-400 transition"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: AI Coach Forecast Card */}
        <div className="space-y-6">
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 flex flex-col items-center justify-between min-h-[420px] text-center">
            <div className="w-full">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 block">
                🧠 AI Habit Adherence Forecast
              </span>

              {/* Radial Dial */}
              <div className="relative w-36 h-36 mx-auto flex items-center justify-center mb-6">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    strokeWidth="8"
                    stroke="rgba(255,255,255,0.03)"
                    fill="none"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    strokeWidth="8"
                    stroke="url(#habitGradient)"
                    strokeDasharray="264"
                    strokeDashoffset={264 - (264 * forecast.successRate) / 100}
                    strokeLinecap="round"
                    fill="none"
                    className="transition-all duration-1000 ease-out"
                  />
                  <defs>
                    <linearGradient id="habitGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#a855f7" />
                      <stop offset="100%" stopColor="#ec4899" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-black text-slate-100 tracking-tight">{forecast.successRate}%</span>
                  <span className="text-[8px] font-extrabold tracking-widest text-slate-500 uppercase mt-0.5">
                    Success rate
                  </span>
                </div>
              </div>

              {/* AI Coaching Insight */}
              <div className="p-4 bg-purple-950/15 border border-purple-500/20 text-purple-300 text-xs rounded-xl text-left leading-relaxed">
                <div className="font-extrabold text-[9px] uppercase tracking-wider text-purple-400 mb-1.5 flex items-center gap-1.5">
                  <span>💡</span> AI Coaching Insight
                </div>
                {forecast.coachingText}
              </div>
            </div>

            <button
              onClick={handleRecalculateForecast}
              disabled={forecasting || habits.length === 0}
              className="mt-6 w-full py-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold text-xs tracking-wider transition active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {forecasting ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Running simulation...
                </>
              ) : (
                <>
                  <span>📈</span> Forecast Habit Success
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
