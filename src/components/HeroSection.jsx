// src/components/HeroSection.jsx
// Dark cinematic product opening powered by the Desktop rmotion frame sequence.

import { motion } from "framer-motion";
import { ArrowRight, CalendarCheck2, ShieldCheck, Sparkles } from "lucide-react";
import TimelineCanvas from "./TimelineCanvas";
import { fadeUp } from "../lib/animations";

const proofPoints = [
  { label: "Planning latency", value: "-42%" },
  { label: "Focus blocks created", value: "18" },
  { label: "Deadline risk", value: "Low" },
];

export default function HeroSection({ onGoogleClick }) {
  return (
    <section className="relative min-h-screen w-full overflow-hidden bg-[#03030a] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(124,58,237,0.24),transparent_30%),radial-gradient(circle_at_78%_14%,rgba(37,99,235,0.18),transparent_28%),radial-gradient(circle_at_58%_82%,rgba(168,85,247,0.16),transparent_34%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(167,139,250,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(167,139,250,0.045)_1px,transparent_1px)] bg-[size:42px_42px]" />

      <div className="relative mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 items-center gap-10 px-5 pb-16 pt-24 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:px-10">
        <div className="max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-white/[0.05] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-violet-200 shadow-[0_0_32px_rgba(139,92,246,0.22)] backdrop-blur"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Deadline intelligence workspace
          </motion.div>

          <motion.h1
            variants={fadeUp}
            initial="initial"
            animate="animate"
            className="max-w-4xl text-5xl font-black leading-[0.96] tracking-normal text-white sm:text-6xl lg:text-7xl"
          >
            DeadlineIQ
            <span className="block bg-gradient-to-r from-violet-200 via-violet-400 to-blue-400 bg-clip-text text-transparent">
              moves with your focus.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.18 }}
            className="mt-6 max-w-xl text-base font-medium leading-7 text-violet-100/70 sm:text-lg"
          >
            An ultra-premium, futuristic AI Operating System for productivity and cognitive focus. DeadlineIQ replaces cluttered checklists with an immersive, spatial dashboard featuring real-time telemetry, conversational coaching, and proactive calendar orchestration.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="mt-8 flex flex-col gap-3 sm:flex-row"
          >
            <button
              onClick={onGoogleClick}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-5 text-sm font-black text-white shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/[0.1] active:translate-y-0"
            >
              Continue with Google
              <ArrowRight className="h-4.5 w-4.5" />
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.42 }}
            className="mt-10 grid max-w-xl grid-cols-3 overflow-hidden rounded-2xl border border-violet-300/15 bg-[#090918]/72 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur"
          >
            {proofPoints.map((item) => (
              <div key={item.label} className="border-r border-violet-300/10 px-4 py-3 last:border-r-0">
                <div className="text-xl font-black text-white">{item.value}</div>
                <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-violet-100/45">{item.label}</div>
              </div>
            ))}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, x: 28, scale: 0.98 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ duration: 0.85, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="relative"
        >
          <div className="absolute -inset-5 rounded-[32px] bg-gradient-to-br from-violet-500/24 via-blue-500/12 to-cyan-400/12 blur-2xl" />
          <div className="relative overflow-hidden rounded-[28px] border border-violet-300/18 bg-[#070713] shadow-2xl shadow-violet-950/35">
            <div className="flex items-center justify-between border-b border-violet-300/12 bg-white/[0.045] px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              </div>
              <div className="flex items-center gap-2 rounded-full border border-violet-300/15 bg-white/[0.04] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-violet-100/75">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
                Live motion model
              </div>
            </div>

            <TimelineCanvas className="h-[430px] sm:h-[540px] lg:h-[610px]" fit="contain" />

            <div className="grid grid-cols-1 gap-3 border-t border-violet-300/12 bg-white/[0.035] p-4 sm:grid-cols-3">
              {["Capture", "Sequence", "Protect"].map((step, idx) => (
                <div key={step} className="rounded-xl border border-violet-300/12 bg-white/[0.045] p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <CalendarCheck2 className="h-4 w-4 text-violet-200" />
                    <span className="text-[10px] font-black text-violet-100/38">0{idx + 1}</span>
                  </div>
                  <div className="text-sm font-black text-white">{step}</div>
                  <div className="mt-1 text-[11px] font-medium text-violet-100/52">
                    {idx === 0 ? "Parse tasks" : idx === 1 ? "Place focus blocks" : "Watch deadline risk"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
