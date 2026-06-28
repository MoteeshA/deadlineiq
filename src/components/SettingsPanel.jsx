// src/components/SettingsPanel.jsx
// Immersive spatial settings panel overlay for configuring environmental parameters

import { motion } from "framer-motion";

export default function SettingsPanel({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#050505]/80 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none animate-fade-in">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg p-8 rounded-3xl bg-white/[0.015] border border-white/5 backdrop-blur-[32px] shadow-2xl relative"
      >
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer transition"
        >
          ✕
        </button>

        <h3 className="text-xl font-bold text-white mb-6">Environment Settings</h3>

        <div className="space-y-6">
          
          {/* Audio voice settings */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-bold tracking-widest text-slate-500 font-mono">ElevenLabs TTS Playback Speed</label>
            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 text-sm font-semibold text-white flex justify-between items-center">
              <span>Natural Velocity</span>
              <span className="text-purple-400 font-mono">1.12x Playback</span>
            </div>
          </div>

          {/* Model selection */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-bold tracking-widest text-slate-500 font-mono">Active Intelligence Engine</label>
            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 text-sm font-semibold text-white flex justify-between items-center">
              <span>Gemini Pro Core</span>
              <span className="text-cyan-400 font-mono">gemini-2.5-flash</span>
            </div>
          </div>

          {/* Background rendering options */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-bold tracking-widest text-slate-500 font-mono">Canvas Frame Cache</label>
            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 text-sm font-semibold text-white flex justify-between items-center">
              <span>Timeline Preload Buffer</span>
              <span className="text-slate-400 font-mono">300 Frames Loaded</span>
            </div>
          </div>

        </div>
      </motion.div>
    </div>
  );
}
