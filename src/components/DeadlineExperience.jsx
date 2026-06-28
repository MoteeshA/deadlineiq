// src/components/DeadlineExperience.jsx
// Immersive feature matrix showing cognitive AI features with spatial grid structures

import { motion } from "framer-motion";
import { deadlineFeatures } from "../data/deadlineData";
import { fadeUp, containerStagger, glassCardHover } from "../lib/animations";

export default function DeadlineExperience() {
  return (
    <section className="relative w-full py-24 px-4 bg-[#050505] overflow-hidden">
      
      {/* Decorative gradient orb */}
      <div className="absolute right-0 top-1/4 w-[400px] h-[400px] rounded-full bg-gradient-to-l from-indigo-500/5 to-purple-500/5 blur-[120px] pointer-events-none" />

      <div className="max-w-5xl mx-auto z-10 relative">
        
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-5xl font-black bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent mb-4 tracking-tight">
            Designed for Absolute Focus.
          </h2>
          <p className="text-slate-400 text-sm sm:text-base max-w-xl mx-auto">
            Traditional task dashboards fail because they are passive. DeadlineIQ acts proactively, using integrated cognitive analytics to protect your time.
          </p>
        </div>

        {/* Feature Cards Grid */}
        <motion.div 
          variants={containerStagger}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          {deadlineFeatures.map((feat) => (
            <motion.div
              key={feat.id}
              variants={fadeUp}
              whileHover="hover"
              custom={glassCardHover}
              className="p-8 rounded-3xl bg-white/[0.015] border border-white/5 backdrop-blur-2xl transition-all duration-300 relative overflow-hidden group"
            >
              {/* Highlight Glow Hover Accent */}
              <div className="absolute -inset-px bg-gradient-to-tr from-purple-500/0 via-purple-500/10 to-cyan-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl" />
              
              <div className="flex items-start justify-between mb-6 relative z-10">
                <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-xl">
                  {feat.icon === "brain" && "🧠"}
                  {feat.icon === "calendar" && "📅"}
                  {feat.icon === "mic" && "🎙️"}
                  {feat.icon === "alert" && "⚡"}
                </div>
                <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-slate-500 font-mono">
                  {feat.metric}
                </span>
              </div>

              <h3 className="text-xl font-bold text-white mb-3 relative z-10">
                {feat.title}
              </h3>
              
              <p className="text-slate-400 text-sm leading-relaxed relative z-10">
                {feat.description}
              </p>
            </motion.div>
          ))}
        </motion.div>

      </div>
    </section>
  );
}
