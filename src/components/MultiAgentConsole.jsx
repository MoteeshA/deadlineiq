import { useState, useEffect, useRef } from "react";
import { Cpu, Play, CheckCircle2, X } from "lucide-react";

export default function MultiAgentConsole({ isOpen, onClose }) {
  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState("idle"); // 'idle', 'running', 'complete'
  const [progress, setProgress] = useState(0);
  const logEndRef = useRef(null);

  const simulationSteps = [
    { text: "[PlanningAgent] Initializing multi-agent scheduling negotiation pipeline...", delay: 600 },
    { text: "[CalendarAgent] Connecting to Google Calendar API...", delay: 1200 },
    { text: "[CalendarAgent] Fetching active events and sync-blocking busy slots...", delay: 2000 },
    { text: "[AnalyticsAgent] Feedforward local MLP neural net risk telemetry...", delay: 2800 },
    { text: "[AnalyticsAgent] Forecasted average procrastination index: 56%.", delay: 3500 },
    { text: "[PlanningAgent] Checking 3 active tasks for cognitive duration clashes...", delay: 4200 },
    { text: "[PlanningAgent] WARNING: Detected deadline conflict for 'Finish presentation slides'!", delay: 4800, type: "warning" },
    { text: "[CalendarAgent] Rescheduling: Shifting effort allocations within 1.5h clash window...", delay: 5500 },
    { text: "[PlanningAgent] Success: Clash resolved. Optimized focus slot allocated.", delay: 6200, type: "success" },
    { text: "[ReminderAgent] Pre-calculating procrastination alert email trigger states...", delay: 6800 },
    { text: "[ReminderAgent] Gmail OAuth dispatch channel is live and authenticated.", delay: 7400 },
    { text: "[System] Negotiation complete. Distributed multi-agent schedule synced.", delay: 8000, type: "system" }
  ];

  useEffect(() => {
    if (isOpen) {
      handleRunOptimization();
    } else {
      setLogs([]);
      setStatus("idle");
      setProgress(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  function handleRunOptimization() {
    setLogs([]);
    setStatus("running");
    setProgress(0);

    // Progress bar runner
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 1.25;
      });
    }, 100);

    // Logs runner
    const timeouts = [];
    simulationSteps.forEach((step) => {
      const t = setTimeout(() => {
        setLogs((prev) => [...prev, step]);
        if (step.type === "system") {
          setStatus("complete");
        }
      }, step.delay);
      timeouts.push(t);
    });

    return () => {
      clearInterval(progressInterval);
      timeouts.forEach(clearTimeout);
    };
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-[#04020a]/85 backdrop-blur-md transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Cyberpunk Terminal Container */}
      <div className="relative w-full max-w-2xl bg-[#090815]/95 border border-indigo-500/30 rounded-[28px] shadow-[0_0_80px_rgba(99,102,241,0.25)] overflow-hidden text-white font-sans flex flex-col max-h-[85vh]">
        {/* Decorative Grid Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] pointer-events-none opacity-20" />
        
        {/* Terminal Header */}
        <div className="relative z-10 flex items-center justify-between border-b border-slate-800 bg-[#0e0c20]/90 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-indigo-500/20 bg-indigo-500/10 text-indigo-400">
              <Cpu className="h-4.5 w-4.5 animate-pulse" />
            </span>
            <div>
              <h3 className="text-sm font-black uppercase tracking-[0.16em] text-slate-100 font-mono">
                Multi-Agent Planner
              </h3>
              <p className="text-[10px] font-bold text-indigo-400 tracking-wider font-mono">
                Negotiation status: {status === "running" ? "CONVERGING..." : status === "complete" ? "SYNCED" : "STANDBY"}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white transition p-2 hover:bg-white/5 rounded-xl border border-white/5 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Terminal Console View */}
        <div className="relative z-10 flex-1 overflow-y-auto p-6 bg-[#04030a]/90 font-mono text-xs leading-relaxed space-y-3.5 min-h-[280px]">
          {logs.length === 0 && (
            <div className="h-full flex items-center justify-center text-slate-500 font-semibold select-none">
              Initializing console nodes...
            </div>
          )}

          {logs.map((log, idx) => {
            let textColor = "text-slate-300";
            if (log.type === "warning") textColor = "text-amber-400 font-bold";
            if (log.type === "success") textColor = "text-emerald-400 font-bold";
            if (log.type === "system") textColor = "text-indigo-300 font-black";

            return (
              <div key={idx} className={`flex items-start gap-2.5 transition-all duration-300 ${textColor}`}>
                <span className="text-slate-600 font-bold select-none">&gt;</span>
                <span>{log.text}</span>
              </div>
            );
          })}
          <div ref={logEndRef} />
        </div>

        {/* Progress and Actions Footer */}
        <div className="relative z-10 border-t border-slate-800 bg-[#0a081c]/90 px-6 py-5 flex flex-col sm:flex-row items-center gap-4">
          {/* Real-time Progress Bar */}
          <div className="w-full sm:flex-1">
            <div className="flex justify-between items-center mb-1.5 text-[10px] font-bold text-slate-400 font-mono uppercase tracking-wider">
              <span>Sync Progress</span>
              <span className="text-indigo-400">{Math.round(progress)}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-900 overflow-hidden border border-slate-800/80">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 shadow-[0_0_12px_rgba(139,92,246,0.6)] transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 w-full sm:w-auto">
            {status === "complete" ? (
              <button
                onClick={handleRunOptimization}
                className="flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" /> Optimize Again
              </button>
            ) : null}
            <button
              onClick={status === "complete" ? onClose : undefined}
              disabled={status !== "complete"}
              className={`flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition select-none ${
                status === "complete" 
                  ? "bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-xl shadow-indigo-500/20 cursor-pointer" 
                  : "bg-slate-800/50 text-slate-500 border border-slate-850 cursor-not-allowed"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {status === "complete" ? "Apply Strategy" : "Calibrating..."}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
