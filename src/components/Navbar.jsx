// src/components/Navbar.jsx
// Spatial glassmorphic top navigation panel for the product reveal view


export default function Navbar({ onGoogleClick, onSettingsToggle, onNotificationsToggle }) {
  return (
    <header className="fixed top-0 inset-x-0 h-16 bg-[#050505]/40 border-b border-white/5 backdrop-blur-xl z-50 flex items-center justify-between px-6 select-none">
      
      {/* Brand & Logo */}
      <div className="flex items-center gap-3">
        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 48 46">
          <path fill="#ffffff" d="M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z"/>
        </svg>
        <span className="text-sm font-extrabold tracking-widest uppercase bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
          DeadlineIQ
        </span>
      </div>

      {/* Center items: Status indicator */}
      <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full border border-white/5 bg-white/[0.01] text-[9px] uppercase font-bold tracking-widest text-slate-500 font-mono">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
        System Core Online
      </div>

      {/* Right items: Access Buttons & Controls */}
      <div className="flex items-center gap-4">
        {/* Settings Toggle */}
        <button 
          onClick={onSettingsToggle}
          className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition cursor-pointer"
          title="System Settings"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        {/* Notifications Toggle */}
        <button 
          onClick={onNotificationsToggle}
          className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition cursor-pointer relative"
          title="System Logs"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
        </button>

        <button
          onClick={onGoogleClick}
          className="px-4 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-[#050505] text-xs font-black transition active:scale-[0.98] cursor-pointer shadow-lg shadow-white/5"
        >
          Sign In
        </button>
      </div>

    </header>
  );
}
