import { useState, useRef, useEffect } from "react";
import { predictProcrastinationRisk } from "../utils/localML";

export default function TaskCard({ task, onComplete, onDelete, onDefer, onStart, onToggleSubtask }) {
  const [showSnooze, setShowSnooze] = useState(false);
  const menuRef = useRef(null);
  const riskScore = predictProcrastinationRisk(task);

  // Close snooze menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowSnooze(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const deadlineDate = task.deadline
    ? (task.deadline.toDate ? task.deadline.toDate() : new Date(task.deadline))
    : null;
  const now = new Date();
  const isOverdue = deadlineDate && deadlineDate < now && task.status !== "completed";
  const diffHours = deadlineDate ? (deadlineDate - now) / (1000 * 60 * 60) : Infinity;
  const isUrgent = deadlineDate && diffHours > 0 && diffHours <= 4 && task.status !== "completed";

  const getPriorityBadgeColor = (p) => {
    switch (p) {
      case "high":
        return "bg-rose-500/10 text-rose-400 border border-rose-500/20";
      case "medium":
        return "bg-amber-500/10 text-amber-400 border border-amber-500/20";
      default:
        return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
    }
  };

  const formatDeadline = (dateObj) => {
    if (!dateObj || isNaN(dateObj.getTime())) return "No deadline";
    const isToday = now.toDateString() === dateObj.toDateString();
    const tomorrow = new Date();
    tomorrow.setDate(now.getDate() + 1);
    const isTomorrow = tomorrow.toDateString() === dateObj.toDateString();

    const timeStr = dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });

    if (isToday) return `${isOverdue ? "Overdue Today" : "Today"} at ${timeStr}`;
    if (isTomorrow) return `Tomorrow at ${timeStr}`;

    return `${dateObj.toLocaleDateString([], { month: "short", day: "numeric" })} at ${timeStr}`;
  };

  const handleSnoozeOption = (hoursOffset) => {
    const referenceDate = deadlineDate || new Date();
    const newDeadline = new Date(referenceDate.getTime() + hoursOffset * 60 * 60 * 1000);
    onDefer(task, newDeadline, `Snoozed by +${hoursOffset}h`);
    setShowSnooze(false);
  };

  const handleSnoozeDays = (daysOffset) => {
    const referenceDate = deadlineDate || new Date();
    const newDeadline = new Date(referenceDate.getTime() + daysOffset * 24 * 60 * 60 * 1000);
    onDefer(task, newDeadline, `Snoozed by +${daysOffset}d`);
    setShowSnooze(false);
  };

  return (
    <div
      className={`group relative bg-white/[0.015] backdrop-blur-md border rounded-3xl p-4 sm:p-5 shadow-2xl transition-all duration-350 hover:bg-white/[0.035] hover:-translate-y-1 select-none ${
        task.status === "completed"
          ? "border-white/5 opacity-50"
          : isOverdue
          ? "border-rose-500/20 shadow-rose-500/5 hover:border-rose-500/40"
          : isUrgent
          ? "border-amber-500/20 shadow-amber-500/5 hover:border-amber-500/40"
          : "border-white/5 hover:border-white/15"
      }`}
    >
      {/* Top Details */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getPriorityBadgeColor(task.priority)}`}>
          {task.priority}
        </span>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{task.estimatedHours}h</span>
        </div>
      </div>

      {/* Task Title */}
      <h4
        className={`text-slate-100 font-semibold text-sm mb-4 leading-snug tracking-wide group-hover:text-white transition ${
          task.status === "completed" ? "line-through text-slate-500" : ""
        }`}
      >
        {task.title}
      </h4>

      {/* Hackathon/Opportunity Metadata Badges */}
      {(task.prizes || task.eligibility || task.location || task.registrationLink) && (
        <div className="mb-4 flex flex-wrap gap-2 pt-1">
          {task.prizes && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 select-none">
              🏆 {task.prizes}
            </span>
          )}
          {task.eligibility && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 select-none">
              👥 {task.eligibility}
            </span>
          )}
          {task.location && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 select-none">
              📍 {task.location}
            </span>
          )}
          {task.registrationLink && (
            <a 
              href={task.registrationLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black bg-indigo-500 text-white hover:bg-indigo-650 hover:scale-[1.03] active:scale-[0.98] transition cursor-pointer select-none border border-indigo-400/20"
            >
              🔗 Register Here
            </a>
          )}
        </div>
      )}

      {/* Subtasks List */}
      {task.subtasks && task.subtasks.length > 0 && (
        <div className="mb-4 space-y-1.5 border-t border-slate-800/40 pt-3">
          <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            <span>Subtasks</span>
            <span className="text-slate-400">
              {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length}
            </span>
          </div>
          <div className="space-y-1">
            {task.subtasks.map((sub, idx) => (
              <label
                key={idx}
                className="flex items-center gap-2 text-xs text-slate-300 hover:text-slate-200 cursor-pointer select-none transition py-0.5"
              >
                <input
                  type="checkbox"
                  checked={sub.completed || false}
                  disabled={task.status === "completed"}
                  onChange={() => onToggleSubtask && onToggleSubtask(task, idx)}
                  className="rounded border-slate-700 bg-slate-950 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-slate-900 w-3.5 h-3.5"
                />
                <span className={`truncate ${sub.completed ? "line-through text-slate-500" : ""}`}>
                  {sub.title}
                </span>
                <span className="text-[9px] text-slate-500 ml-auto shrink-0 font-medium">
                  {sub.durationHours}h
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Local Neural Network Procrastination Risk Forecast */}
      {task.status !== "completed" && (
        <div className="mb-4 bg-slate-950/40 border border-slate-850 p-3.5 rounded-xl flex flex-col gap-2">
          <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-wider select-none">
            <div className="flex items-center gap-1.5">
              <span>🧠</span>
              <span>Local Neural Net Risk</span>
            </div>
            <span className={riskScore > 70 ? "text-rose-400" : riskScore > 40 ? "text-amber-400" : "text-emerald-450"}>
              {riskScore}%
            </span>
          </div>

          {/* Risk Level Progress Bar */}
          <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden select-none">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                riskScore > 70 ? "bg-rose-500" : riskScore > 40 ? "bg-amber-500" : "bg-emerald-500"
              }`}
              style={{ width: `${riskScore}%` }}
            />
          </div>

          {/* Risk Label and Action recommendations */}
          <div className="flex justify-between items-center text-[9px] font-extrabold uppercase tracking-wide select-none gap-2">
            <span className={riskScore > 70 ? "text-rose-400/90" : riskScore > 40 ? "text-amber-400/90" : "text-emerald-400/90"}>
              {riskScore > 70 ? "High Risk" : riskScore > 40 ? "Moderate Risk" : "Low Risk"}
            </span>
            <span className="text-slate-450 font-black text-right shrink-0">
              {riskScore > 70 ? "Start Today" : riskScore > 40 ? "Prioritize Soon" : "Maintain Pace"}
            </span>
          </div>
        </div>
      )}

      {/* Deadline Info */}
      <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-800/60">
        <div
          className={`flex items-center gap-1.5 text-xs font-semibold ${
            task.status === "completed"
              ? "text-slate-500"
              : isOverdue
              ? "text-rose-400"
              : isUrgent
              ? "text-amber-400"
              : "text-slate-400"
          }`}
        >
          {isOverdue && (
            <svg className="w-3.5 h-3.5 animate-pulse text-rose-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          )}
          <span>{formatDeadline(deadlineDate)}</span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1">
          {task.status !== "completed" && (
            <>
              {/* Start Task Button */}
              {task.status === "today" && (
                <button
                  onClick={() => onStart(task)}
                  title="Start Task (In Progress)"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-950/20 border border-transparent hover:border-indigo-500/20 transition-all duration-200"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
              )}

              {/* Complete Button */}
              <button
                onClick={() => onComplete(task)}
                title="Mark Completed"
                className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-950/20 border border-transparent hover:border-emerald-500/20 transition-all duration-200"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </button>

              {/* Defer / Snooze Button */}
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setShowSnooze(!showSnooze)}
                  title="Defer Task"
                  className={`p-1.5 rounded-lg border border-transparent transition-all duration-200 ${
                    showSnooze
                      ? "text-indigo-400 bg-indigo-950/20 border-indigo-500/20"
                      : "text-slate-400 hover:text-indigo-400 hover:bg-indigo-950/20 hover:border-indigo-500/20"
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>

                {/* Snooze Popup */}
                {showSnooze && (
                  <div className="absolute right-0 bottom-full mb-2 z-10 w-44 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl p-1.5 flex flex-col gap-0.5 animate-zoom-in">
                    <div className="px-2 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Snooze / Defer
                    </div>
                    <button
                      onClick={() => handleSnoozeOption(1)}
                      className="w-full text-left px-2.5 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition"
                    >
                      +1 Hour
                    </button>
                    <button
                      onClick={() => handleSnoozeOption(3)}
                      className="w-full text-left px-2.5 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition"
                    >
                      +3 Hours
                    </button>
                    <button
                      onClick={() => handleSnoozeDays(1)}
                      className="w-full text-left px-2.5 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition"
                    >
                      +1 Day (Tomorrow)
                    </button>
                    <button
                      onClick={() => handleSnoozeDays(3)}
                      className="w-full text-left px-2.5 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition"
                    >
                      +3 Days
                    </button>
                    {task.deferralCount > 0 && (
                      <div className="border-t border-slate-800/80 my-1 pt-1 text-[10px] text-center text-amber-500 font-medium">
                        Deferred {task.deferralCount} time{task.deferralCount > 1 ? "s" : ""}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Delete Button */}
          <button
            onClick={() => onDelete(task)}
            title="Delete Task"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/20 border border-transparent hover:border-rose-500/20 transition-all duration-200"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
