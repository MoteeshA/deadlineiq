// src/components/CalendarGrid.jsx
// Spatial borderless calendar engine showcase for the landing page

import { motion } from "framer-motion";
import { fadeUp } from "../lib/animations";

export default function CalendarGrid() {
  const days = Array.from({ length: 14 }, (_, i) => i + 15); // mock dates
  
  const mockTasks = {
    16: { label: "Gemini Integration", type: "high" },
    18: { label: "Audio Synthesis", type: "medium" },
    21: { label: "Local MLP Training", type: "high" },
    25: { label: "Product Reveal Launch", type: "vip" }
  };

  return (
    <section className="relative w-full py-20 px-4 bg-[#050505] overflow-hidden">
      
      {/* Spotlight behind calendar */}
      <div className="absolute left-1/4 top-1/2 -translate-y-1/2 w-[500px] h-[300px] rounded-full bg-cyan-500/5 blur-[120px] pointer-events-none" />

      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-12 z-10 relative">
        
        {/* Left side: Context */}
        <div className="flex-1 space-y-6">
          <div className="px-3 py-1 rounded-full border border-white/5 bg-white/[0.02] text-[9px] uppercase font-bold tracking-[0.2em] text-cyan-400 w-max backdrop-blur-md">
            Cognitive Scheduling
          </div>
          <h2 className="text-3xl sm:text-5xl font-black bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent tracking-tight">
            The Borderless Calendar.
          </h2>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            DeadlineIQ automatically schedules subtasks directly into open calendar slots, avoiding meetings and matching peak energy periods. It removes boundaries and hard black table lines to offer a floating, VisionOS glassmorphic calendar array.
          </p>
        </div>

        {/* Right side: Visual calendar grid mock */}
        <motion.div 
          variants={fadeUp}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true }}
          className="flex-1 w-full p-6 rounded-3xl bg-white/[0.01] border border-white/5 backdrop-blur-xl"
        >
          <div className="grid grid-cols-7 gap-2 text-center text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-4 font-mono">
            <span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span><span>Su</span>
          </div>

          <div className="grid grid-cols-7 gap-3">
            {days.map((day) => {
              const task = mockTasks[day];
              return (
                <div 
                  key={day}
                  className={`p-3 rounded-2xl min-h-[70px] sm:min-h-[85px] flex flex-col justify-between transition-all duration-300 relative select-none ${
                    task ? "bg-white/[0.025] border border-white/10" : "bg-white/[0.01] border border-transparent"
                  }`}
                >
                  <span className="text-xs font-semibold text-slate-400 font-mono self-start">
                    {day}
                  </span>
                  
                  {task && (
                    <div className={`mt-1.5 px-2 py-1 rounded-lg text-[9px] font-bold tracking-tight text-center ${
                      task.type === "high" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                      task.type === "medium" ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" :
                      "bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300 border border-purple-500/30 shadow-purple-500/10"
                    }`}>
                      {task.label}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>

      </div>
    </section>
  );
}
