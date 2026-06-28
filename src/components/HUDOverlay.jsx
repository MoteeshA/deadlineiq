// src/components/HUDOverlay.jsx
// Floating glassmorphic HUD statistics panel representing real-time system productivity indices

import { motion } from "framer-motion";
import { mockHUDMetrics } from "../data/deadlineData";
import { fadeUp, containerStagger } from "../lib/animations";

export default function HUDOverlay() {
  return (
    <section className="relative w-full py-16 px-4 bg-[#050505] overflow-hidden">
      
      {/* Glow line */}
      <div className="max-w-5xl mx-auto border-t border-white/5 pt-16">
        
        <div className="mb-12">
          <div className="px-3 py-1 rounded-full border border-white/5 bg-white/[0.02] text-[9px] uppercase font-bold tracking-[0.2em] text-rose-400 w-max backdrop-blur-md mb-4">
            System Telemetry
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            Real-Time HUD Diagnostics
          </h2>
        </div>

        <motion.div 
          variants={containerStagger}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true }}
          className="grid grid-cols-2 md:grid-cols-4 gap-6"
        >
          {mockHUDMetrics.map((met, idx) => (
            <motion.div
              key={idx}
              variants={fadeUp}
              className="p-6 rounded-2xl bg-white/[0.015] border border-white/5 backdrop-blur-md flex flex-col justify-between min-h-[120px] relative overflow-hidden"
            >
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 font-mono">
                {met.label}
              </div>
              <div className="mt-4 flex items-baseline justify-between">
                <span className="text-xl sm:text-2xl font-black text-white font-mono">
                  {met.value}
                </span>
                <span className="text-[9px] font-bold text-emerald-400 font-mono">
                  {met.trend}
                </span>
              </div>
            </motion.div>
          ))}
        </motion.div>

      </div>
    </section>
  );
}
