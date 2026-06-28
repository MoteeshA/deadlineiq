import { useState, useEffect } from "react";

export default function EmergencyBanner({ emergencyTasks = [] }) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000); // Update every 30 seconds
    return () => clearInterval(timer);
  }, []);

  if (emergencyTasks.length === 0) return null;

  // Get the most urgent emergency task
  const task = emergencyTasks.sort((a, b) => {
    const deadlineA = a.deadline?.toDate ? a.deadline.toDate() : new Date(a.deadline || 0);
    const deadlineB = b.deadline?.toDate ? b.deadline.toDate() : new Date(b.deadline || 0);
    return deadlineA - deadlineB;
  })[0];

  const deadlineDate = task.deadline?.toDate ? task.deadline.toDate() : new Date(task.deadline);
  const diffMs = deadlineDate.getTime() - currentTime.getTime();
  const diffMins = Math.max(0, Math.round(diffMs / (1000 * 60)));

  return (
    <div className="mb-6 relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-650 to-rose-600 border border-red-500/30 text-white shadow-xl shadow-red-950/20 animate-pulse duration-2000">
      <div className="absolute inset-0 bg-red-600/10 pointer-events-none" />
      <div className="relative z-10 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 text-center sm:text-left">
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-xl shadow-inner animate-bounce">
            🚨
          </div>
          <div>
            <h3 className="font-extrabold text-sm sm:text-base tracking-wide uppercase text-white/95">
              Emergency Focus Active
            </h3>
            <p className="text-xs text-red-100/90 font-medium mt-0.5 max-w-xl">
              <span className="font-black text-white italic">"{task.title}"</span> is due in{" "}
              <span className="underline decoration-wavy decoration-white font-bold">{diffMins} minutes</span>. Focus now to prevent a deadline breach.
            </p>
          </div>
        </div>
        
        {emergencyTasks.length > 1 && (
          <div className="px-3 py-1.5 rounded-lg bg-black/25 text-[10px] font-black uppercase tracking-wider text-rose-200 shrink-0">
            +{emergencyTasks.length - 1} More Emergency Tasks
          </div>
        )}
      </div>
    </div>
  );
}
