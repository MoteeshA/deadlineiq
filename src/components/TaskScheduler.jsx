// src/components/TaskScheduler.jsx
// Immersive task schedule preview highlighting smart subtask parser and progress velocity dials

import { motion } from "framer-motion";
import { fadeUp } from "../lib/animations";

export default function TaskScheduler() {
  return (
    <section className="relative w-full py-20 px-4 bg-[#050505] overflow-hidden">
      
      {/* Light glow behind element */}
      <div className="absolute right-1/4 top-1/2 -translate-y-1/2 w-[500px] h-[300px] rounded-full bg-purple-500/5 blur-[120px] pointer-events-none" />

      <div className="max-w-5xl mx-auto flex flex-col-reverse md:flex-row items-center gap-12 z-10 relative">
        
        {/* Left side: Visual representation */}
        <motion.div
          variants={fadeUp}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true }}
          className="flex-1 w-full p-6 rounded-3xl bg-white/[0.01] border border-white/5 backdrop-blur-xl relative"
        >
          {/* Smart Task breakdown mock */}
          <div className="space-y-4">
            
            {/* Input task header */}
            <div className="p-4 rounded-2xl bg-white/[0.025] border border-white/10 flex items-center justify-between">
              <div>
                <div className="text-[10px] text-purple-400 font-bold uppercase tracking-wider mb-1 font-mono">Gemini Decoded Input</div>
                <div className="text-sm font-semibold text-white">"Finish outline by tomorrow noon, high priority"</div>
              </div>
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[9px] font-bold font-mono">Parsed 98%</span>
            </div>

            {/* Subtask chain */}
            <div className="pl-4 border-l-2 border-dashed border-purple-500/30 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-[10px] text-purple-300 font-bold font-mono">1</div>
                <span className="text-xs text-slate-350">Research competitor designs (Peak Focus 9-10 AM)</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-[10px] text-purple-300 font-bold font-mono">2</div>
                <span className="text-xs text-slate-350">Draft conceptual skeleton layout (10-Min Ugly Draft Timer)</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-[10px] text-purple-300 font-bold font-mono">3</div>
                <span className="text-xs text-slate-350">Review structural pacing (Estimated Risk: 12%)</span>
              </div>
            </div>

          </div>
        </motion.div>

        {/* Right side: Context */}
        <div className="flex-1 space-y-6">
          <div className="px-3 py-1 rounded-full border border-white/5 bg-white/[0.02] text-[9px] uppercase font-bold tracking-[0.2em] text-purple-400 w-max backdrop-blur-md">
            Agentic Processing
          </div>
          <h2 className="text-3xl sm:text-5xl font-black bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent tracking-tight">
            Smart Task Subtask Chains.
          </h2>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            Speak or type tasks naturally. The intelligence maps the command into distinct action steps, schedules them around your focus metrics, and tracks completing velocity automatically.
          </p>
        </div>

      </div>
    </section>
  );
}
