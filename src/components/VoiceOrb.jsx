// src/components/VoiceOrb.jsx
// Glowing, physics-based fluid interactive voice coach orb visualization

import { motion } from "framer-motion";

export default function VoiceOrb({ isSpeaking = false, onClick }) {
  return (
    <div className="flex flex-col items-center justify-center space-y-6 select-none relative">
      
      {/* Dynamic ambient backglow */}
      <div className="absolute w-[200px] h-[200px] rounded-full bg-gradient-to-tr from-purple-500/20 via-pink-500/10 to-indigo-500/30 blur-[80px] pointer-events-none" />

      {/* Floating Outer Glass Circle */}
      <div className="w-48 h-48 rounded-full border border-white/5 bg-white/[0.01] backdrop-blur-[32px] flex items-center justify-center relative p-1.5 shadow-2xl">
        
        {/* Pulsing visual waves */}
        {isSpeaking && (
          <>
            <motion.div 
              animate={{ scale: [1, 1.25, 1], opacity: [0.3, 0, 0.3] }}
              transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
              className="absolute inset-0 rounded-full border border-purple-500/25 pointer-events-none" 
            />
            <motion.div 
              animate={{ scale: [1, 1.45, 1], opacity: [0.15, 0, 0.15] }}
              transition={{ repeat: Infinity, duration: 3.0, ease: "easeInOut" }}
              className="absolute -inset-4 rounded-full border border-cyan-500/15 pointer-events-none" 
            />
          </>
        )}

        {/* Core Intelligent Orb */}
        <button
          onClick={onClick}
          className={`w-36 h-36 rounded-full cursor-pointer transition-all duration-700 bg-gradient-to-tr from-indigo-500 via-purple-500 to-rose-500 shadow-[0_0_50px_rgba(134,59,255,0.4)] border border-white/20 relative overflow-hidden group flex items-center justify-center ${
            isSpeaking ? "animate-pulse scale-105" : "hover:scale-102"
          }`}
        >
          {/* Inner particle noise simulation overlay */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.2),transparent_60%)] mix-blend-overlay" />
          
          <svg className="w-8 h-8 text-white relative z-10 filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        </button>

      </div>

      <div className="text-center space-y-1.5 z-10">
        <span className="text-[10px] uppercase font-bold tracking-[0.25em] text-slate-500 font-mono">Interactive Coach</span>
        <div className="text-xs font-semibold text-slate-350">{isSpeaking ? "Coaching session playing..." : "Ready for status audit"}</div>
      </div>

    </div>
  );
}
