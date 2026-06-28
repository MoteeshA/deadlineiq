import { useState, useEffect } from "react";
import { getCoachingResponse } from "../services/forensics";
import { useToast } from "../context/ToastContext";

export default function InterventionCard({ tasks, userId, onReschedule, onActivateTunnelVision }) {
  const { addToast } = useToast();
  
  // Find task with >= 3 deferrals that is not completed
  const targetTask = tasks.find(t => t.status !== "completed" && (t.deferralCount || 0) >= 3);

  // Check procrastination pattern cache
  const patternCacheKey = `deadlineiq_pattern_${userId}`;
  const cachedPattern = JSON.parse(localStorage.getItem(patternCacheKey)) || {
    primaryPattern: "Fear of Failure",
    percentage: 78,
  };

  const primaryPattern = targetTask ? cachedPattern.primaryPattern : null;

  // Blocker Chat Modal State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [blockerText, setBlockerText] = useState("");
  const [coachingAdvice, setCoachingAdvice] = useState("");
  const [loadingCoach, setLoadingCoach] = useState(false);

  // Timer State for 10-Min Ugly Draft
  const [timerSeconds, setTimerSeconds] = useState(600);
  const [timerRunning, setTimerRunning] = useState(false);

  useEffect(() => {
    let interval = null;
    if (timerRunning && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds(s => {
          if (s <= 1) {
            setTimerRunning(false);
            addToast("Time's up! Great work starting the draft! 🚀", { type: "success" });
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerRunning, timerSeconds, addToast]);

  if (!targetTask) return null;

  const handleStartTimer = () => {
    setTimerSeconds(600);
    setTimerRunning(true);
  };

  const handleStopTimer = () => {
    setTimerRunning(false);
  };

  const formatTimer = (sec) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Peak Hours Shift Rescheduler
  const handleShiftToPeakHours = () => {
    // Shift deadline to tomorrow morning at 9:00 AM (typical peak cognitive hours)
    const tomorrowPeak = new Date();
    tomorrowPeak.setDate(tomorrowPeak.getDate() + 1);
    tomorrowPeak.setHours(9, 0, 0, 0);

    onReschedule(targetTask, tomorrowPeak, "Shifted to peak cognitive hours (9AM)");
    addToast(`Rescheduled "${targetTask.title}" to tomorrow 9:00 AM`, { type: "success" });
  };

  // Chat/Blocker Coach Request
  const handleGetCoachAdvice = async (e) => {
    e.preventDefault();
    if (!blockerText.trim()) return;
    setLoadingCoach(true);
    setCoachingAdvice("");
    try {
      const advice = await getCoachingResponse(targetTask, blockerText);
      setCoachingAdvice(advice);
    } catch (err) {
      console.error(err);
      addToast(err.message, { type: "error" });
    } finally {
      setLoadingCoach(false);
    }
  };

  const getInterventionDetails = () => {
    switch (primaryPattern) {
      case "Fear of Failure":
        return {
          title: "Fear of Failure Pattern Detected",
          message: `You've deferred "${targetTask.title}" ${targetTask.deferralCount} times. We know why—you want it to be perfect. Let's beat the friction with a 10-minute ugly draft challenge. The goal is only to write something bad, not good. Just start.`,
          action: (
            <div className="flex flex-col sm:flex-row items-center gap-4 mt-4 w-full justify-between bg-slate-950/60 p-4 border border-slate-800 rounded-2xl">
              <div className="flex items-center gap-3">
                <span className="text-3xl font-mono tracking-widest text-indigo-400">
                  {formatTimer(timerSeconds)}
                </span>
                {timerRunning && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                )}
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                {!timerRunning ? (
                  <button
                    onClick={handleStartTimer}
                    className="flex-1 sm:flex-initial px-4 py-2 text-xs font-bold bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl transition"
                  >
                    Start 10-Min Draft
                  </button>
                ) : (
                  <button
                    onClick={handleStopTimer}
                    className="flex-1 sm:flex-initial px-4 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition"
                  >
                    Pause Timer
                  </button>
                )}
                <button
                  onClick={() => setTimerSeconds(600)}
                  className="px-3 py-2 text-xs font-semibold hover:bg-white/5 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-xl transition"
                >
                  Reset
                </button>
              </div>
            </div>
          )
        };

      case "Task Ambiguity": {
        const firstSubtask = targetTask.subtasks && targetTask.subtasks.length > 0 ? targetTask.subtasks[0] : null;
        return {
          title: "Task Ambiguity Pattern Detected",
          message: `"${targetTask.title}" has been delayed. It's likely because the task feels too big or ambiguous. Let's focus exclusively on the single next step. Forget the final outcome—just do this one action item:`,
          action: (
            <div className="mt-4 space-y-4 w-full">
              {firstSubtask ? (
                <div className="flex items-center gap-3 bg-slate-950/60 p-4 border border-indigo-500/20 rounded-2xl">
                  <span className="text-xl">👉</span>
                  <div>
                    <p className="text-sm font-bold text-slate-100">{firstSubtask.title}</p>
                    <p className="text-[10px] text-slate-500 font-semibold mt-0.5 uppercase tracking-wider">
                      Est. Effort: {firstSubtask.durationHours}h
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">No action steps generated. Try planning this task with Gemini.</p>
              )}
              <button
                onClick={() => onActivateTunnelVision(targetTask.id)}
                className="px-4 py-2.5 text-xs font-bold bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl transition shadow-md"
              >
                Focus on This Step Only
              </button>
            </div>
          )
        };
      }

      case "Overwhelm":
        return {
          title: "Overwhelm Pattern Detected",
          message: `Your board is full and you are freezing on "${targetTask.title}". Let's clear the noise. We will hide all other tasks so you can focus on this single card without distractions.`,
          action: (
            <div className="mt-4">
              <button
                onClick={() => onActivateTunnelVision(targetTask.id)}
                className="px-4 py-2.5 text-xs font-bold bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl transition"
              >
                Activate Tunnel Vision Mode
              </button>
            </div>
          )
        };

      case "Energy Mismatch":
        return {
          title: "Energy Mismatch Pattern Detected",
          message: `We've noticed you are deferring "${targetTask.title}" during low-energy windows. Let's shift it to your peak focus block (usually 9:00 AM - 11:00 AM) when your concentration is fresh.`,
          action: (
            <div className="mt-4">
              <button
                onClick={handleShiftToPeakHours}
                className="px-4 py-2.5 text-xs font-bold bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl transition"
              >
                Reschedule to Peak Hours (Tomorrow 9AM)
              </button>
            </div>
          )
        };

      case "Emotional Avoidance":
      default:
        return {
          title: "Emotional Avoidance Pattern Detected",
          message: `"${targetTask.title}" has been deferred 3 times due to creative friction or discomfort. Talk to our coach to help identify the emotional blocker and get a tiny starting advice.`,
          action: (
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => {
                  setBlockerText("");
                  setCoachingAdvice("");
                  setIsChatOpen(true);
                }}
                className="px-4 py-2.5 text-xs font-bold bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl transition"
              >
                What's blocking me?
              </button>
            </div>
          )
        };
    }
  };

  const details = getInterventionDetails();

  return (
    <>
      <div className="bg-slate-900 border border-indigo-500/40 shadow-xl shadow-indigo-500/5 rounded-3xl p-5 sm:p-6 mb-8 flex flex-col md:flex-row gap-5 items-start relative overflow-hidden">
        {/* Glow Side Accent */}
        <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-indigo-500" />

        <div className="bg-indigo-500/10 p-3.5 rounded-2xl text-indigo-400 border border-indigo-500/20 shrink-0">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        <div className="flex-1 w-full">
          <h4 className="text-sm font-bold text-slate-100 tracking-wide uppercase flex items-center gap-2">
            🚨 Live Intervention <span className="text-[10px] text-indigo-400 font-semibold px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full">{details.title}</span>
          </h4>
          <p className="text-xs text-slate-400 leading-relaxed mt-2.5 max-w-2xl font-semibold">
            {details.message}
          </p>
          {details.action}
        </div>
      </div>

      {/* Blocker Coaching Chat Modal */}
      {isChatOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => setIsChatOpen(false)}
          />
          <div className="relative bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 sm:p-8 animate-zoom-in text-white">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                <span>💬</span> Blocker Coach Assistant
              </h3>
              <button 
                onClick={() => setIsChatOpen(false)}
                className="text-slate-400 hover:text-white transition p-1 hover:bg-slate-800 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleGetCoachAdvice} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                  Task: {targetTask.title}
                </label>
                <textarea
                  placeholder="Explain why this task feels hard to start... (e.g. 'I am worried I don't know enough coding parameters', 'I feel tired and it requires a lot of reading')"
                  value={blockerText}
                  onChange={(e) => setBlockerText(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-xs text-slate-100 placeholder-slate-500 outline-none transition focus:ring-2 focus:ring-indigo-500/10 resize-none"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={loadingCoach || !blockerText.trim()}
                className="w-full py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs tracking-wide transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loadingCoach ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Coaching in progress...
                  </>
                ) : (
                  "Ask Coach Advice"
                )}
              </button>
            </form>

            {/* Coach response bubble */}
            {coachingAdvice && (
              <div className="mt-6 p-4 bg-indigo-950/20 border border-indigo-500/20 rounded-xl animate-slide-in">
                <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                  <span>🤖</span> AI Coach Advice
                </div>
                <p className="text-xs text-slate-350 leading-relaxed font-semibold italic">
                  "{coachingAdvice}"
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
