// src/components/Notifications.jsx
// Spatial notifications display overlay for system logs and audits


export default function Notifications({ logs = [], onClose }) {
  return (
    <div className="fixed top-20 right-6 w-full max-w-sm z-50 p-4 bg-white/[0.015] border border-white/5 backdrop-blur-[32px] rounded-3xl shadow-2xl space-y-3 select-none">
      
      <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-2">
        <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 font-mono">System Audit Logs</span>
        <button 
          onClick={onClose}
          className="text-[10px] uppercase font-bold tracking-widest text-rose-400 hover:text-rose-300 font-mono cursor-pointer"
        >
          Clear
        </button>
      </div>

      <div className="space-y-2.5 max-h-[250px] overflow-y-auto scrollbar-none">
        {logs.length === 0 ? (
          <div className="text-xs text-slate-500 text-center py-4">No recent logs recorded</div>
        ) : (
          logs.map((log, idx) => (
            <div 
              key={idx} 
              className="p-3 rounded-xl bg-white/[0.01] border border-white/5 text-xs text-slate-300 flex items-start gap-2.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
              <div>
                <div className="font-semibold text-white mb-0.5">{log.title}</div>
                <div className="text-[10px] text-slate-500">{log.time}</div>
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
}
