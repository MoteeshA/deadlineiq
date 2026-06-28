// src/pages/Login.jsx
// Immersive spatial dashboard & luxury logo reveal presentation container for DeadlineIQ

import { useState, useEffect, useRef } from "react";
import { auth, signInWithGoogle, db } from "../firebase";
import { useNavigate } from "react-router-dom";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

// Sub-components
import Navbar from "../components/Navbar";
import HeroSection from "../components/HeroSection";
import DeadlineExperience from "../components/DeadlineExperience";
import CalendarGrid from "../components/CalendarGrid";
import TaskScheduler from "../components/TaskScheduler";
import VoiceOrb from "../components/VoiceOrb";
import HUDOverlay from "../components/HUDOverlay";
import Dock from "../components/Dock";
import SettingsPanel from "../components/SettingsPanel";
import Notifications from "../components/Notifications";

export default function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const videoRef = useRef(null);
  
  // Navigation & UI States
  const [activeSection, setActiveSection] = useState("hero");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [isOrbSpeaking, setIsOrbSpeaking] = useState(false);
  const [activeAudio, setActiveAudio] = useState(null);

  const mockLogs = [
    { title: "Optics calibration completed", time: "Just now" },
    { title: "Local neural network weights cached", time: "2m ago" },
    { title: "Google OAuth services handshake verified", time: "5m ago" }
  ];

  // Preserved Login Handlers
  const handleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await signInWithGoogle();
      const user = result.user;

      const userRef = doc(db, "users", user.uid);
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        lastLogin: serverTimestamp(),
      }, { merge: true });

      navigate("/dashboard");
    } catch (err) {
      console.error("Login failed:", err);
      setError("Failed to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  };



  // Section scroll tracker
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const height = window.innerHeight;
      
      if (scrollY < height * 0.8) {
        setActiveSection("hero");
      } else if (scrollY < height * 1.8) {
        setActiveSection("experience");
      } else if (scrollY < height * 2.8) {
        setActiveSection("calendar");
      } else if (scrollY < height * 3.8) {
        setActiveSection("tasks");
      } else {
        setActiveSection("insights");
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Autoplay video on scroll intersection
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.play().catch((err) => {
            console.warn("Autoplay was prevented by browser:", err);
          });
        } else {
          video.pause();
        }
      },
      {
        threshold: 0.5, // Trigger when 50% of the video is visible
      }
    );

    observer.observe(video);
    return () => {
      if (video) observer.unobserve(video);
    };
  }, []);

  const handleSectionJump = (sectionId) => {
    const targetElement = document.getElementById(sectionId);
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: "smooth" });
      setActiveSection(sectionId);
    }
  };

  const playLandingWelcome = () => {
    try {
      if (activeAudio) {
        activeAudio.pause();
      }

      setIsOrbSpeaking(true);
      const audio = new Audio("/audio/welcome_guest.mp3");
      audio.playbackRate = 1.12;

      audio.onended = () => {
        setIsOrbSpeaking(false);
        setActiveAudio(null);
      };

      audio.onerror = () => {
        setIsOrbSpeaking(false);
        setActiveAudio(null);
      };

      setActiveAudio(audio);
      audio.play().catch((err) => {
        console.warn("Audio playback failed or blocked:", err);
        setIsOrbSpeaking(false);
        setActiveAudio(null);
      });
    } catch (e) {
      console.warn("Error playing landing welcome audio:", e);
      setIsOrbSpeaking(false);
      setActiveAudio(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white relative font-sans overflow-x-hidden">
      
      {/* Top Navbar */}
      <Navbar 
        onGoogleClick={handleLogin}
        onSettingsToggle={() => setSettingsOpen(!settingsOpen)}
        onNotificationsToggle={() => setNotificationsOpen(!notificationsOpen)}
      />

      {/* Main Sections */}
      <div id="hero">
        <HeroSection onGoogleClick={handleLogin} />
      </div>

      {/* Immersive Product Demo Video */}
      <div className="py-16 bg-[#03030a] relative border-b border-white/5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.08),transparent_50%)]" />
        <div className="max-w-5xl mx-auto px-5 relative z-10">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
              Immersive Workspace Demonstration
            </h2>
            <p className="mt-2 text-sm text-slate-400 max-w-xl mx-auto">
              Watch DeadlineIQ's agentic co-pilot and client-side neural network plan tasks, allocate calendar focus slots, and calculate workload capacity.
            </p>
          </div>
          
          <div className="relative aspect-video rounded-3xl border border-white/10 overflow-hidden shadow-2xl bg-black">
            <video 
              ref={videoRef}
              src="/IQ_FINAL.mp4" 
              className="w-full h-full object-cover" 
              controls 
              muted
              playsInline
              loop
              preload="metadata"
              poster="/screenshots/dashboard1.png"
            />
          </div>
        </div>
      </div>

      <div id="experience">
        <DeadlineExperience />
      </div>

      <div id="calendar">
        <CalendarGrid />
      </div>

      <div id="tasks">
        <TaskScheduler />
      </div>

      {/* Voice Orb Section */}
      <div className="py-12 bg-[#050505] flex flex-col items-center justify-center border-t border-b border-white/5 relative">
        <div className="absolute inset-0 bg-radial-gradient(circle at center, rgba(168, 85, 247, 0.05) 0%, transparent 70%) pointer-events-none" />
        <VoiceOrb isSpeaking={isOrbSpeaking} onClick={playLandingWelcome} />
      </div>

      <div id="insights">
        <HUDOverlay />
      </div>

      {/* Error notification banner if any */}
      {error && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold rounded-xl z-50 animate-bounce">
          {error}
        </div>
      )}

      {/* Floating Bottom Dock */}
      <Dock activeSection={activeSection} onSectionChange={handleSectionJump} />

      {/* Overlay Panels */}
      <SettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      {notificationsOpen && (
        <Notifications logs={mockLogs} onClose={() => setNotificationsOpen(false)} />
      )}

      {/* Bottom Padding for floating Dock */}
      <div className="h-28" />

      {/* Auth Loading Glass Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-[#050505]/80 backdrop-blur-md z-[100] flex flex-col items-center justify-center space-y-4 animate-fade-in">
          <div className="w-10 h-10 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
          <div className="text-[10px] uppercase font-bold tracking-[0.25em] text-slate-400 font-mono">Initializing Workspace Profile</div>
        </div>
      )}

    </div>
  );
}