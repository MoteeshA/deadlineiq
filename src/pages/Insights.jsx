import { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot } from "firebase/firestore";
import { classifyProcrastinationPattern } from "../services/forensics";
import { useToast } from "../context/ToastContext";

export default function Insights() {
  const { addToast } = useToast();
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [avoidanceEvents, setAvoidanceEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [classifying, setClassifying] = useState(false);
  const [emailDigestEnabled, setEmailDigestEnabled] = useState(() => {
    const saved = localStorage.getItem("deadlineiq_email_digest_enabled");
    return saved !== null ? saved === "true" : true;
  });

  const handleToggleDigest = (val) => {
    setEmailDigestEnabled(val);
    localStorage.setItem("deadlineiq_email_digest_enabled", String(val));
    addToast(`Daily AI email recap ${val ? "enabled" : "disabled"}!`, { type: "info" });
  };

  const handleSendEmailDigest = () => {
    if (!user) return;
    
    const subject = encodeURIComponent("DeadlineIQ: AI Productivity Forensics Report");
    const completedCount = tasks.filter(t => t.status === "completed").length;
    const activeCount = tasks.filter(t => t.status !== "completed").length;
    
    const bodyText = `Hi ${user.displayName || "Productivity Champion"},\n\n` +
      `Here is your custom AI-compiled Productivity Forensics Digest from DeadlineIQ:\n\n` +
      `📈 PERFORMANCE METRICS:\n` +
      `- Active Commitments: ${activeCount} tasks\n` +
      `- Completed Tasks: ${completedCount} tasks\n` +
      `- Primary Procrastination Fingerprint: ${fingerprint.primaryPattern} (${fingerprint.percentage}% match)\n\n` +
      `🧠 AI FORENSIC ANALYSIS:\n` +
      `"${fingerprint.explanation}"\n\n` +
      `💡 STRATEGIC ACTION STRATEGY:\n` +
      `1. Focus on Morning Peak Cognitive Windows for High Priority tasks.\n` +
      `2. Break down ambiguous deliverables into 10-minute micro-focus subtasks.\n` +
      `3. Use the Pomodoro Focus Mode in your Dashboard to break initiation friction.\n\n` +
      `Keep pushing! You've got this.\n\n` +
      `Best,\n` +
      `Your DeadlineIQ AI Coach 🧠`;
      
    const body = encodeURIComponent(bodyText);
    window.open(`mailto:${user.email}?subject=${subject}&body=${body}`, "_blank");
    addToast("Opened mail client to dispatch your AI digest!", { type: "success" });
  };

  // Load default/cached fingerprint
  const [fingerprint, setFingerprint] = useState({
    primaryPattern: "Fear of Failure",
    percentage: 78,
    explanation: "You frequently delay creative/writing tasks due to high standard constraints. Utilizing structured subtask goals reduces starting friction.",
    triggerCategories: ["Writing", "Presentations"],
    safeZoneCategories: ["Research", "Admin"],
    avgHoursBeforeDeadline: 3.2,
    trendImprovement: "Stable",
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsub();
  }, []);

  // Sync tasks
  useEffect(() => {
    if (!user) return;
    const tasksRef = collection(db, "users", user.uid, "tasks");
    const unsub = onSnapshot(tasksRef, (snapshot) => {
      const loaded = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setTasks(loaded);
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  // Sync avoidance events
  useEffect(() => {
    if (!user) return;

    // Load local storage cached pattern if it exists
    const cached = localStorage.getItem(`deadlineiq_pattern_${user.uid}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setTimeout(() => {
          setFingerprint(parsed);
        }, 0);
      } catch (err) {
        console.error(err);
      }
    }

    const eventsRef = collection(db, "users", user.uid, "avoidance_events");
    const unsub = onSnapshot(eventsRef, (snapshot) => {
      const loaded = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setAvoidanceEvents(loaded);
    });
    return () => unsub();
  }, [user]);

  const handleRecalculatePattern = async () => {
    if (!user) return;
    if (tasks.length === 0) {
      addToast("Add or seed some tasks first to analyze patterns!", { type: "info" });
      return;
    }
    setClassifying(true);
    try {
      const data = await classifyProcrastinationPattern(tasks, avoidanceEvents);
      setFingerprint(data);
      localStorage.setItem(`deadlineiq_pattern_${user.uid}`, JSON.stringify(data));
      addToast("AI Procrastination Fingerprint recalculated! 🔍", { type: "success" });
    } catch (err) {
      console.error(err);
      addToast(err.message, { type: "error" });
    } finally {
      setClassifying(false);
    }
  };

  // Stats Calculations
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === "completed").length;
  const totalDefers = tasks.reduce((sum, t) => sum + (t.deferralCount || 0), 0);

  const baseScore = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 80;
  const deferPenalty = totalDefers * 3;
  const calculatedScore = Math.max(10, Math.min(100, Math.round(baseScore - deferPenalty)));

  const getScoreBand = (score) => {
    if (score >= 80) return { label: "EXCELLENT", color: "text-emerald-400", border: "border-emerald-500/20", bg: "bg-emerald-500/10", note: "You are on track and keeping commitments!" };
    if (score >= 60) return { label: "NEEDS WORK", color: "text-amber-400", border: "border-amber-500/20", bg: "bg-amber-500/10", note: "Minor scheduling adjustments needed." };
    if (score >= 40) return { label: "WARNING", color: "text-orange-400", border: "border-orange-500/20", bg: "bg-orange-500/10", note: "Task rescheduling pace is critical." };
    return { label: "CRITICAL", color: "text-rose-400", border: "border-rose-500/20", bg: "bg-rose-500/10", note: "Triage mode recommended. Postpone or drop tasks." };
  };

  const scoreDetails = getScoreBand(calculatedScore);

  // 1. Score History Data Points for the past 7 days (simulated bound to calculatedScore):
  const getHistoricalPoints = (score) => {
    return [
      Math.max(10, Math.min(100, Math.round(score * 0.82))),
      Math.max(10, Math.min(100, Math.round(score * 0.90))),
      Math.max(10, Math.min(100, Math.round(score * 0.85))),
      Math.max(10, Math.min(100, Math.round(score * 0.93))),
      Math.max(10, Math.min(100, Math.round(score * 0.88))),
      Math.max(10, Math.min(100, Math.round(score * 0.96))),
      score
    ];
  };

  const historyData = getHistoricalPoints(calculatedScore);

  // 2. Generate SVG coordinates for a trend line (300px wide, 100px high)
  const getSvgPath = (data) => {
    return data.map((val, idx) => {
      const x = idx * 50;
      // Scale 10-100 score to 10-90 height area so it doesn't clip top/bottom
      const y = 90 - ((val - 10) / 90) * 80;
      return `${idx === 0 ? "M" : "L"} ${x} ${y}`;
    }).join(" ");
  };

  const svgPathStr = getSvgPath(historyData);

  // 3. AI Score Forecast for the next 7 days:
  const getScoreForecast = () => {
    const activeHighPriorityCount = tasks.filter(t => t.status !== "completed" && t.priority === "high").length;
    const completedRatio = totalTasks > 0 ? completedTasks / totalTasks : 1;
    const overlimit = activeHighPriorityCount > 2;

    let forecastedScore = calculatedScore;
    let trend = "Stable";
    let color = "text-indigo-400";
    let reason = "Your task load is balanced. Continue completing subtasks during Peak Focus hours to lock in progress.";

    if (overlimit) {
      forecastedScore = Math.max(10, calculatedScore - 15);
      trend = "Declining";
      color = "text-rose-400";
      reason = "Warning: Multiple active high-priority tasks are due soon with low completion pace. Drop or snooze tasks to prevent breach.";
    } else if (completedRatio > 0.6) {
      forecastedScore = Math.min(100, calculatedScore + 10);
      trend = "Improving";
      color = "text-emerald-400";
      reason = "Positive: High completion rates and low avoidance snoozes. Forecasted to rise as subtasks are fully closed.";
    } else if (totalDefers > 4) {
      forecastedScore = Math.max(10, calculatedScore - 8);
      trend = "Declining";
      color = "text-amber-400";
      reason = "Attention: Recent snoozing patterns trigger velocity lag. Tackle subtasks in early hours to recover momentum.";
    }

    return { score: forecastedScore, trend, color, reason };
  };

  const forecast = getScoreForecast();

  // Map logs to table rows
  const deferralLogs = avoidanceEvents.map((event) => ({
    taskTitle: event.taskTitle,
    timestamp: event.timestamp?.toDate ? event.timestamp.toDate() : new Date(event.timestamp),
    reason: event.reason || "Deferred deadline",
  }));

  deferralLogs.sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="flex-1 flex flex-col">
      {/* Page Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
            Procrastination Forensics
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Review your Commitment Velocity and behaviors compiled by DeadlineIQ.
          </p>
        </div>

        {/* Recalculate AI Fingerprint Button */}
        <button
          onClick={handleRecalculatePattern}
          disabled={classifying || loading}
          className="px-5 py-3 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-200 font-bold text-xs tracking-wide transition flex items-center justify-center gap-2.5 self-start sm:self-center"
        >
          {classifying ? (
            <>
              <svg className="animate-spin h-4 w-4 text-indigo-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Analyzing Logs...
            </>
          ) : (
            <>
              <span>🔍</span> Recalculate AI Fingerprint
            </>
          )}
        </button>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Col: Dial & Score Card */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center text-center">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">
            Commitment Velocity
          </span>

          {/* Dial SVG */}
          <div className="relative w-40 h-40 flex items-center justify-center mb-6">
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
                stroke="url(#dialGradient)"
                strokeDasharray="264"
                strokeDashoffset={264 - (264 * calculatedScore) / 100}
                strokeLinecap="round"
                fill="none"
                className="transition-all duration-1000 ease-out"
              />
              <defs>
                <linearGradient id="dialGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#a855f7" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-black text-slate-100 tracking-tight">{calculatedScore}</span>
              <span className={`text-[10px] font-bold tracking-widest mt-1 ${scoreDetails.color}`}>
                {scoreDetails.label}
              </span>
            </div>
          </div>

          <div className={`p-4 border rounded-xl w-full text-xs text-slate-350 ${scoreDetails.border} ${scoreDetails.bg}`}>
            {scoreDetails.note}
          </div>

          <div className="grid grid-cols-2 gap-4 w-full mt-6 pt-6 border-t border-slate-800/60">
            <div>
              <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                Total Deferrals
              </span>
              <span className="text-xl font-extrabold text-slate-200 mt-1 block">
                {totalDefers}
              </span>
            </div>
            <div>
              <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                Success Ratio
              </span>
              <span className="text-xl font-extrabold text-slate-200 mt-1 block">
                {totalTasks > 0 ? `${Math.round((completedTasks / totalTasks) * 100)}%` : "100%"}
              </span>
            </div>
          </div>
        </div>

        {/* Center Col: SVG Score Trend Chart & AI Forecast */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 sm:p-8 flex flex-col justify-between min-h-[440px]">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 block">
              Commitment Trend & Forecast
            </span>

            {/* SVG Line Graph */}
            <div className="bg-slate-950/60 border border-slate-800/60 rounded-xl p-3 mb-6 relative">
              <svg className="w-full h-24 overflow-visible" viewBox="0 0 300 100">
                {/* Area Gradient Defs */}
                <defs>
                  <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                  </linearGradient>
                </defs>

                {/* SVG Area Fill */}
                <path
                  d={`${svgPathStr} L 300 100 L 0 100 Z`}
                  fill="url(#areaGradient)"
                  className="transition-all duration-1000 ease-out"
                />

                {/* SVG Stroke Line */}
                <path
                  d={svgPathStr}
                  fill="none"
                  stroke="#818cf8"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
                />

                {/* Vertex Dots */}
                {historyData.map((val, idx) => {
                  const x = idx * 50;
                  const y = 90 - ((val - 10) / 90) * 80;
                  return (
                    <circle
                      key={idx}
                      cx={x}
                      cy={y}
                      r="4"
                      className="fill-indigo-400 stroke-slate-900 stroke-2 hover:r-6 cursor-help transition-all"
                      title={`Score: ${val}`}
                    />
                  );
                })}
              </svg>

              {/* Day Labels at bottom */}
              <div className="flex justify-between text-[8px] font-black text-slate-500 uppercase tracking-wider mt-2.5 px-0.5 select-none">
                <span>M</span>
                <span>T</span>
                <span>W</span>
                <span>T</span>
                <span>F</span>
                <span>S</span>
                <span>S</span>
              </div>
            </div>

            {/* AI Forecast Segment */}
            <div className="space-y-2 border-t border-slate-850/50 pt-4">
              <span className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">
                🧠 AI Commitment Forecast
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-250">
                  Predicted Score: <span className="underline underline-offset-4 decoration-indigo-500 decoration-wavy">{forecast.score}</span>
                </span>
                <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                  forecast.trend === "Improving" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                  forecast.trend === "Declining" ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" :
                  "bg-slate-800 text-slate-400 border border-slate-700"
                }`}>
                  {forecast.trend}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed font-medium mt-1">
                {forecast.reason}
              </p>
            </div>
          </div>
        </div>

        {/* Right Col: Procrastination Fingerprints */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 sm:p-8 flex flex-col justify-between min-h-[440px]">
          <div>
            <div className="flex justify-between items-start mb-6">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Procrastination Profile
              </span>
              <span className="text-[10px] font-bold text-indigo-400 px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full shrink-0">
                {fingerprint.primaryPattern}
              </span>
            </div>

            <div className="space-y-6">
              <div>
                <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  AI Forensic Analysis
                </span>
                <p className="text-xs text-slate-350 leading-relaxed font-semibold">
                  {fingerprint.explanation}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {/* Triggers */}
                <div>
                  <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                    🚨 Avoidance Triggers
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {fingerprint.triggerCategories?.map((c) => (
                      <span key={c} className="text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2.5 py-1 rounded-full uppercase tracking-wider">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Safe Zones */}
                <div>
                  <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                    🟢 Safe Zones
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {fingerprint.safeZoneCategories?.map((c) => (
                      <span key={c} className="text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full uppercase tracking-wider">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-slate-800/60 mt-6 pt-5 text-xs text-slate-400">
            <div>
              <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                Action Pace
              </span>
              <span className="text-xs font-bold text-slate-205 mt-1 block">
                avg {fingerprint.avgHoursBeforeDeadline || "3.2"}h before deadline
              </span>
            </div>
            <div>
              <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                Behavior Trend
              </span>
              <span className={`text-xs font-bold mt-1 block ${fingerprint.trendImprovement === "Improving" ? "text-emerald-400" : "text-amber-400"}`}>
                {fingerprint.trendImprovement || "Stable"}
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Col: Recent Avoidance Logs */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 sm:p-8 lg:col-span-2 flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 block">
              Recent Avoidance Events (Total: {avoidanceEvents.length})
            </span>

            {loading ? (
              <div className="h-20 animate-pulse bg-slate-900 rounded-xl" />
            ) : deferralLogs.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs">
                No avoidance actions logged. Your velocity is clean!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800/65 text-slate-500 font-bold">
                      <th className="py-3 px-2">Task</th>
                      <th className="py-3 px-2">Timestamp</th>
                      <th className="py-3 px-2 text-right">Reason/Offset</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40 text-slate-300 font-medium">
                    {deferralLogs.slice(0, 5).map((log, idx) => (
                      <tr key={idx} className="hover:bg-white/5 transition">
                        <td className="py-3 px-2 text-slate-200 font-semibold">{log.taskTitle}</td>
                        <td className="py-3 px-2 text-slate-400">
                          {log.timestamp.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="py-3 px-2 text-right text-indigo-400 font-semibold">{log.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* AI Email Digest Panel */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 sm:p-8 flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 block">
              Email Digest Center
            </span>
            <p className="text-[11px] text-slate-400 leading-relaxed font-medium mb-5">
              Receive automated summaries of your focus metrics, procrastination forensics, and task checklists.
            </p>

            {/* Email Digest Settings */}
            <div className="space-y-4 border-t border-slate-850/50 pt-4 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <span className="block text-xs font-bold text-slate-300">
                    Daily AI Briefing
                  </span>
                  <span className="text-[9px] text-slate-500 font-medium uppercase tracking-wider mt-0.5 block">
                    Sent morning at 9:00 AM
                  </span>
                </div>
                <button
                  onClick={() => handleToggleDigest(!emailDigestEnabled)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 ${
                    emailDigestEnabled ? "bg-indigo-600" : "bg-slate-800"
                  }`}
                  aria-label="Toggle Daily AI Briefing"
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${
                      emailDigestEnabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={handleSendEmailDigest}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:scale-[1.02] active:scale-[0.98] text-white font-bold text-xs tracking-wide transition shadow-lg shadow-indigo-500/10 cursor-pointer"
          >
            Generate & Email Live Digest
          </button>
        </div>

      </div>
    </div>
  );
}
