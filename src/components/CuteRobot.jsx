import { useState, useEffect } from "react";
import { auth } from "../firebase";

const expressions = ["(^.^)", "(•‿•)", "(^_-)", "(o_o)", "(•_•)"];
const quotes = [
  "Focus mode boosts your efficiency by 87%!",
  "No procrastination today! Lock in! ⚡",
  "DBMS project is 90% completed. Let's finish!",
  "You are maintaining a great focus streak! ( ^_^[)",
  "Need a break? Remember to stand up every 45 mins.",
];

export default function CuteRobot() {
  const [expression, setExpression] = useState("(^.^)");
  const [bubbleText, setBubbleText] = useState("Let's crush your goals today!");
  const [showBubble, setShowBubble] = useState(true);

  // Rotate expressions and quotes randomly
  useEffect(() => {
    const currentUser = auth.currentUser;
    const name = currentUser?.displayName || currentUser?.email?.split("@")[0] || "User";
    setBubbleText(`Let's crush your goals today, ${name}!`);

    const interval = setInterval(() => {
      const randomIdx = Math.floor(Math.random() * expressions.length);
      setExpression(expressions[randomIdx]);
      setBubbleText(quotes[Math.floor(Math.random() * quotes.length)]);
      setShowBubble(true);
      // Auto-hide bubble after 4s
      setTimeout(() => setShowBubble(false), 4000);
    }, 12000);

    return () => clearInterval(interval);
  }, []);

  const handleClick = () => {
    setExpression("(^v^)");
    setBubbleText("Systems fully operational! Let's build something epic.");
    setShowBubble(true);
  };

  return (
    <div className="relative flex items-center gap-4 select-none shrink-0">
      {/* Interactive Speech Bubble */}
      {showBubble && (
        <div className="absolute right-20 bottom-2 md:bottom-auto md:top-2 mr-3 bg-slate-950/90 border border-slate-800 text-[10px] text-indigo-350 font-bold px-3 py-2 rounded-2xl shadow-xl w-40 backdrop-blur-xl animate-fade-in z-20">
          <div className="relative">
            {bubbleText}
            {/* arrow indicator */}
            <div className="absolute -right-4 top-1/2 -translate-y-1/2 w-0 h-0 border-t-4 border-t-transparent border-b-4 border-b-transparent border-l-4 border-l-slate-800" />
          </div>
        </div>
      )}

      {/* Floating Animated Robot Mascot */}
      <div 
        onClick={handleClick}
        className="relative cursor-pointer group select-none shrink-0"
      >
        {/* Pulsing ring aura */}
        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl opacity-15 blur group-hover:opacity-40 group-hover:scale-105 transition duration-500" />
        
        {/* Robot Chassis Frame */}
        <div className="relative w-14 h-14 bg-slate-950 border border-slate-800/80 rounded-2xl p-2.5 flex flex-col justify-between shadow-2xl transition duration-300 transform group-hover:-translate-y-1.5 animate-[float_4s_ease-in-out_infinite]">
          {/* Antennas */}
          <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 flex items-center justify-center gap-3">
            {/* Left antenna */}
            <div className="w-0.5 h-3 bg-slate-800 rounded-full transform -rotate-12 origin-bottom relative">
              <div className="absolute -top-1 -left-0.5 w-1.5 h-1.5 bg-indigo-550 rounded-full animate-pulse" />
            </div>
            {/* Right antenna */}
            <div className="w-0.5 h-3 bg-slate-800 rounded-full transform rotate-12 origin-bottom relative">
              <div className="absolute -top-1 -left-0.5 w-1.5 h-1.5 bg-purple-550 rounded-full animate-pulse" />
            </div>
          </div>

          {/* LED Eyes Screen Grid */}
          <div className="w-full h-6 bg-slate-900 border border-slate-850 rounded-lg flex items-center justify-center font-mono text-[9px] font-black text-indigo-400 tracking-wider shadow-inner relative overflow-hidden select-none">
            {/* Grid scanning effect */}
            <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(99,102,241,0.05)_50%,rgba(0,0,0,0.25)_50%)] bg-[size:100%_4px]" />
            <div className="z-10 text-[8px] animate-pulse">{expression}</div>
          </div>

          {/* Bottom Grill / Mouth */}
          <div className="flex gap-1 justify-center items-center mt-1">
            <div className="w-1.5 h-0.5 bg-indigo-500/50 rounded-full animate-[pulse_1s_infinite_0.1s]" />
            <div className="w-1.5 h-0.5 bg-purple-500/50 rounded-full animate-[pulse_1s_infinite_0.3s]" />
            <div className="w-1.5 h-0.5 bg-indigo-500/50 rounded-full animate-[pulse_1s_infinite_0.5s]" />
          </div>
        </div>

        {/* Hover tag indicator */}
        <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-850 text-slate-400 text-[8px] font-black uppercase tracking-wider py-0.5 px-1.5 rounded opacity-0 group-hover:opacity-100 transition duration-200 pointer-events-none select-none shrink-0 whitespace-nowrap">
          IQ Bot
        </span>
      </div>

      {/* Embedded CSS Animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-6px) rotate(2deg); }
        }
      `}</style>
    </div>
  );
}
