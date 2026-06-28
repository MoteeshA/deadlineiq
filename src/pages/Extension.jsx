export default function Extension() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center py-12 px-4 select-none animate-zoom-in">
      <div className="max-w-md w-full bg-slate-900/40 border border-slate-800/80 rounded-3xl p-8 sm:p-10 backdrop-blur-2xl shadow-2xl text-center relative overflow-hidden">
        {/* Glow accents */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Puzzle Icon */}
        <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-500/5">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
          </svg>
        </div>

        {/* Title & Description */}
        <h2 className="text-xl sm:text-2xl font-black text-slate-100 tracking-wide mb-3">
          Browser Extension Companion
        </h2>
        <p className="text-xs text-slate-400 leading-relaxed mb-8 max-w-sm mx-auto">
          Synchronize your browsing workflow. Capture active tabs, right-click selected web text to save tasks, and trigger focus blocks directly from Chrome.
        </p>

        {/* Direct Download Button */}
        <a
          href="/deadlineiq-extension.zip"
          download="deadlineiq-extension.zip"
          className="w-full py-4 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-650 hover:scale-[1.02] active:scale-[0.98] text-white font-bold text-xs tracking-widest uppercase transition shadow-lg shadow-indigo-500/15 cursor-pointer block text-center"
        >
          Add Extension
        </a>

        {/* Minor Helper Alert Note */}
        <p className="text-[10px] text-slate-500 font-semibold mt-6 uppercase tracking-wider">
          Manifest V3 • Compressed ZIP Archive
        </p>
      </div>
    </div>
  );
}
