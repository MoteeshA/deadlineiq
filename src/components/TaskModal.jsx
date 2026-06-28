import { useState, useEffect } from "react";

export default function TaskModal({ isOpen, onClose, onSubmit }) {
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("2");
  const [priority, setPriority] = useState("medium");
  const [error, setError] = useState("");

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        setTitle("");
        // Default deadline to tomorrow at 5:00 PM
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(17, 0, 0, 0);
        
        // Format as YYYY-MM-DDThh:mm
        const tzOffset = tomorrow.getTimezoneOffset() * 60000; // offset in milliseconds
        const localISOTime = (new Date(tomorrow - tzOffset)).toISOString().slice(0, 16);
        setDeadline(localISOTime);
        
        setEstimatedHours("2");
        setPriority("medium");
        setError("");
      }, 0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Task title is required");
      return;
    }
    if (!deadline) {
      setError("Deadline is required");
      return;
    }

    onSubmit({
      title: title.trim(),
      deadline: new Date(deadline),
      estimatedHours: parseFloat(estimatedHours),
      priority,
    });
    onClose();
  };

  const hourOptions = [
    { value: 0.5, label: "30 mins" },
    { value: 1, label: "1 hour" },
    { value: 2, label: "2 hours" },
    { value: 3, label: "3 hours" },
    { value: 5, label: "5 hours" },
    { value: 8, label: "8 hours (Full day)" },
    { value: 12, label: "12 hours" },
    { value: 16, label: "16 hours" },
    { value: 24, label: "24 hours" },
    { value: 40, label: "40 hours (Full week)" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal Dialog */}
      <div className="relative bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 sm:p-8 animate-zoom-in text-white">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <span>✨</span> Create New Task
          </h3>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white transition p-1.5 hover:bg-slate-800 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3 text-sm text-rose-400 bg-rose-950/30 border border-rose-500/20 rounded-xl">
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Task Title
            </label>
            <input
              type="text"
              placeholder="e.g. Write draft review section"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:ring-2 focus:ring-indigo-500/20"
              autoFocus
            />
          </div>

          {/* Deadline */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Deadline
            </label>
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-slate-100 outline-none transition focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          {/* Estimated Hours & Priority Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Hours */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Effort Estimate
              </label>
              <select
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-slate-100 outline-none transition focus:ring-2 focus:ring-indigo-500/20 appearance-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 1rem center",
                  backgroundSize: "1em",
                }}
              >
                {hourOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Priority
              </label>
              <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 border border-slate-800 rounded-xl">
                {["low", "medium", "high"].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`py-1.5 rounded-lg text-xs font-bold uppercase transition ${
                      priority === p
                        ? p === "high"
                          ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20"
                          : p === "medium"
                          ? "bg-amber-500 text-white shadow-lg shadow-amber-500/20"
                          : "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-3 pt-4 border-t border-slate-800/60">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-slate-800 hover:bg-white/5 font-semibold text-slate-300 transition text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 font-semibold text-white transition text-sm shadow-xl shadow-indigo-500/10"
            >
              Create Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
