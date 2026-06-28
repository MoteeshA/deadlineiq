// src/components/Dock.jsx
// Spatial floating bottom dock mimicking high-end operating system interfaces

import { motion } from "framer-motion";
import { Sparkles, Brain, Calendar, Zap, Activity } from "lucide-react";

export default function Dock({ activeSection, onSectionChange }) {
  const dockItems = [
    { id: "hero", label: "Reveal", icon: Sparkles, color: "text-indigo-400" },
    { id: "experience", label: "Core", icon: Brain, color: "text-purple-400" },
    { id: "calendar", label: "Schedule", icon: Calendar, color: "text-cyan-400" },
    { id: "tasks", label: "Tasks", icon: Zap, color: "text-amber-400" },
    { id: "insights", label: "HUD", icon: Activity, color: "text-rose-400" }
  ];

  return (
    <div className="fixed bottom-6 inset-x-0 flex justify-center z-50 px-4 select-none animate-fade-in">
      <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-[#0a0a0f]/80 border border-white/10 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.85)]">
        {dockItems.map((item) => {
          const isActive = activeSection === item.id;
          const IconComponent = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={`relative px-4 py-2.5 rounded-xl flex flex-col items-center justify-center transition-all duration-300 cursor-pointer ${
                isActive 
                  ? "bg-white/10 border border-white/15 scale-105 shadow-[0_0_15px_rgba(255,255,255,0.05)]" 
                  : "hover:bg-white/[0.03] border border-transparent opacity-60 hover:opacity-100"
              }`}
              title={item.label}
            >
              <IconComponent className={`w-5.5 h-5.5 mb-1 ${item.color}`} />
              <span className="text-[8px] uppercase font-black tracking-widest text-slate-400 font-mono">
                {item.label}
              </span>
              
              {isActive && (
                <motion.div 
                  layoutId="dock-dot"
                  className="absolute -bottom-1.5 w-1 h-1 rounded-full bg-purple-400"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
