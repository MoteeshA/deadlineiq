import { useEffect, useState } from "react";
import { useToast } from "../context/ToastContext";

export default function AISpeaker({ user, tasks }) {
  const { addToast } = useToast();
  const [muted, setMuted] = useState(() => {
    return localStorage.getItem("deadlineiq_voice_muted") === "true";
  });
  const [orbState, setOrbState] = useState("idle"); // 'idle', 'speaking', 'listening'
  const [activeAudio, setActiveAudio] = useState(null);

  // Local synthesis fallback
  const fallbackSpeakLocal = (text) => {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      if (window.speechSynthesis) {
        const voices = window.speechSynthesis.getVoices();
        // Prioritize Indian English voices (Swara style)
        const voice = voices.find(v => 
          v.lang.toLowerCase().includes("en-in") || 
          v.lang.toLowerCase().includes("en_in") ||
          v.name.toLowerCase().includes("india")
        ) || voices.find(v => 
          v.name.toLowerCase().includes("google us english") || 
          v.name.toLowerCase().includes("samantha") || 
          v.name.toLowerCase().includes("siri")
        ) || voices.find(v => v.lang.startsWith("en"));
        if (voice) utterance.voice = voice;
      }
      utterance.rate = 1.1;
      utterance.pitch = 1.0;
      utterance.onstart = () => setOrbState("speaking");
      utterance.onend = () => setOrbState("idle");
      utterance.onerror = () => setOrbState("idle");
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error(e);
      setOrbState("idle");
    }
  };

  // Text-To-Speech function using Google Translate WaveNet stream or ElevenLabs
  const speakText = async (text) => {
    if (muted) return;
    try {
      // Cancel local speech
      window.speechSynthesis.cancel();

      // Pause existing audio
      if (activeAudio) {
        activeAudio.pause();
      }

      // Truncate to first two sentences to respect 200 char limits & remain concise
      const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
      const conciseText = sentences.slice(0, 2).join(" ").substring(0, 180);

      const elKey = localStorage.getItem("deadlineiq_elevenlabs_api_key");
      const elVoice = localStorage.getItem("deadlineiq_elevenlabs_voice_id") || "21m00Tcm4TlvDq8ikWAM";

      if (elKey) {
        setOrbState("speaking");
        try {
          const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${elVoice}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "xi-api-key": elKey
            },
            body: JSON.stringify({
              text: conciseText,
              model_id: "eleven_monolingual_v1",
              voice_settings: {
                stability: 0.75,
                similarity_boost: 0.75
              }
            })
          });

          if (!response.ok) {
            throw new Error("ElevenLabs API failed");
          }

          const blob = await response.blob();
          const objectUrl = URL.createObjectURL(blob);
          const audio = new Audio(objectUrl);
          audio.playbackRate = 1.12;
          audio.onended = () => {
            setOrbState("idle");
            setActiveAudio(null);
            URL.revokeObjectURL(objectUrl);
          };
          audio.onerror = () => {
            setOrbState("idle");
            setActiveAudio(null);
            URL.revokeObjectURL(objectUrl);
            fallbackGoogleTTS(conciseText);
          };
          setActiveAudio(audio);
          audio.play();
          return;
        } catch (err) {
          console.warn("ElevenLabs failed, using Google Translate:", err);
        }
      }

      fallbackGoogleTTS(conciseText);
    } catch (e) {
      console.warn("TTS stream error, fallback:", e);
      fallbackSpeakLocal(text);
    }
  };

  const fallbackGoogleTTS = (conciseText) => {
    setOrbState("speaking");
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=en-IN&client=tw-ob&q=${encodeURIComponent(conciseText)}`;
    const audio = new Audio(url);
    audio.playbackRate = 1.12;
    audio.onended = () => {
      setOrbState("idle");
      setActiveAudio(null);
    };
    audio.onerror = () => {
      console.warn("Google TTS fallback failed, using local synthesis");
      fallbackSpeakLocal(conciseText);
    };
    setActiveAudio(audio);

    audio.play();
  };

  // Trigger speech greeting once user logs in
  useEffect(() => {
    if (!user || muted) return;

    const hour = new Date().getHours();
    let audioFile = "/audio/welcome_evening.mp3";

    if (hour >= 5 && hour < 12) {
      audioFile = "/audio/welcome_morning.mp3";
    } else if (hour >= 12 && hour < 17) {
      audioFile = "/audio/welcome_afternoon.mp3";
    } else if (hour >= 21 || hour < 5) {
      audioFile = "/audio/welcome_night.mp3";
    }

    // Attempt automatic play silently (no robotic fallback to prevent bad experience)
    const timer = setTimeout(() => {
      try {
        if (activeAudio) {
          activeAudio.pause();
        }
        setOrbState("speaking");
        const audio = new Audio(audioFile);
        audio.playbackRate = 1.12;
        audio.onended = () => {
          setOrbState("idle");
          setActiveAudio(null);
        };
        audio.onerror = () => {
          const name = user?.displayName || user?.email?.split("@")[0] || "there";
          const greeting = hour >= 5 && hour < 12 ? "Good morning" : hour >= 12 && hour < 17 ? "Good afternoon" : hour >= 17 && hour < 21 ? "Good evening" : "Good night";
          speakText(`${greeting}, ${name}. Welcome back to your workspace.`);
        };

        setActiveAudio(audio);
        audio.play().catch(() => {
          // Autoplay blocked by browser policy, keep orb in idle state silently
          setOrbState("idle");
          setActiveAudio(null);
        });
      } catch {
        setOrbState("idle");
        setActiveAudio(null);
      }
    }, 2000);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Window event listener for manual briefing triggers (always allowed by browser)
  useEffect(() => {
    const handlePlayRequest = () => {
      if (muted) return;
      const hour = new Date().getHours();
      let audioFile = "/audio/welcome_evening.mp3";

      if (hour >= 5 && hour < 12) {
        audioFile = "/audio/welcome_morning.mp3";
      } else if (hour >= 12 && hour < 17) {
        audioFile = "/audio/welcome_afternoon.mp3";
      } else if (hour >= 21 || hour < 5) {
        audioFile = "/audio/welcome_night.mp3";
      }

      try {
        if (activeAudio) activeAudio.pause();
        setOrbState("speaking");
        const audio = new Audio(audioFile);
        audio.playbackRate = 1.12;
        audio.onended = () => {
          setOrbState("idle");
          setActiveAudio(null);
        };
        audio.onerror = () => {
          const name = user?.displayName || user?.email?.split("@")[0] || "there";
          const greeting = hour >= 5 && hour < 12 ? "Good morning" : hour >= 12 && hour < 17 ? "Good afternoon" : hour >= 17 && hour < 21 ? "Good evening" : "Good night";
          speakText(`${greeting}, ${name}. Welcome back to your workspace.`);
        };
        setActiveAudio(audio);
        audio.play().catch((err) => {
          console.warn("Manual play request fail:", err);
          const name = user?.displayName || user?.email?.split("@")[0] || "there";
          const greeting = hour >= 5 && hour < 12 ? "Good morning" : hour >= 12 && hour < 17 ? "Good afternoon" : hour >= 17 && hour < 21 ? "Good evening" : "Good night";
          speakText(`${greeting}, ${name}. Welcome back to your workspace.`);
        });
      } catch (err) {
        console.warn("Manual play request catch:", err);
        setOrbState("idle");
        setActiveAudio(null);
      }
    };

    window.addEventListener("play-welcome-audio", handlePlayRequest);
    return () => window.removeEventListener("play-welcome-audio", handlePlayRequest);
  }, [activeAudio, muted, user]);

  const handleToggleMute = () => {
    const val = !muted;
    setMuted(val);
    localStorage.setItem("deadlineiq_voice_muted", String(val));
    if (val) {
      window.speechSynthesis.cancel();
      if (activeAudio) {
        activeAudio.pause();
      }
      setOrbState("idle");
      addToast("AI Voice Voice Assistance muted.", { type: "info" });
    } else {
      addToast("AI Voice Voice Assistance active.", { type: "success" });
      speakText("Voice assistance active. I am listening.");
    }
  };

  // Determine orb glow color/animations
  const getOrbStyle = () => {
    switch (orbState) {
      case "speaking":
        return "bg-gradient-to-tr from-purple-500 via-pink-500 to-rose-500 animate-pulse scale-110 shadow-purple-500/40";
      case "listening":
        return "bg-gradient-to-tr from-rose-500 via-red-500 to-orange-500 animate-ping scale-110 shadow-red-500/40";
      case "idle":
      default:
        return "bg-gradient-to-tr from-indigo-500 via-indigo-650 to-purple-650 hover:scale-105 shadow-indigo-500/20";
    }
  };

  if (!user) return null;

  return (
    <div className="fixed bottom-24 right-24 md:bottom-8 md:right-28 z-40 flex items-center gap-3 bg-slate-950/80 border border-slate-800/80 p-2.5 rounded-2xl backdrop-blur-xl shadow-2xl animate-slide-in select-none">
      {/* Glow Orb Button */}
      <button
        onClick={() => {
          if (muted) return;
          try {
            if (activeAudio) {
              activeAudio.pause();
            }
            setOrbState("speaking");
            const audio = new Audio("/audio/status_check.mp3");
            audio.playbackRate = 1.12;
            audio.onended = () => {
              setOrbState("idle");
              setActiveAudio(null);
            };
            audio.onerror = () => {
              const activeTasks = tasks.filter((t) => t.status !== "completed");
              speakText(`Current status check: you have ${activeTasks.length} active commitments. Focus timer is ready.`);
            };
            setActiveAudio(audio);
            audio.play().catch((err) => {
              console.warn("Status play fail:", err);
              const activeTasks = tasks.filter((t) => t.status !== "completed");
              speakText(`Current status check: you have ${activeTasks.length} active commitments. Focus timer is ready.`);
            });
          } catch (e) {
            console.warn("Status play catch:", e);
            const activeTasks = tasks.filter((t) => t.status !== "completed");
            speakText(`Current status check: you have ${activeTasks.length} active commitments. Focus timer is ready.`);
          }
        }}
        className={`w-10 h-10 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 border border-white/10 cursor-pointer relative group ${getOrbStyle()}`}
        title="AI Coaching Voice Orb"
      >
        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
        {/* State label on hover */}
        <span className="absolute bottom-12 bg-slate-900 border border-slate-800 text-slate-350 text-[9px] font-black uppercase tracking-wider py-1 px-2 rounded-lg opacity-0 group-hover:opacity-100 transition duration-200 pointer-events-none select-none">
          {orbState === "speaking" ? "Speaking..." : orbState === "listening" ? "Listening..." : "Click to speak status"}
        </span>
      </button>

      {/* Mute toggle icon */}
      <button
        onClick={handleToggleMute}
        className="w-8 h-8 rounded-xl bg-slate-900/60 hover:bg-slate-850 border border-slate-850 hover:border-slate-800 text-slate-400 hover:text-slate-200 flex items-center justify-center transition cursor-pointer"
        title={muted ? "Unmute Coach Voice" : "Mute Coach Voice"}
      >
        {muted ? (
          <svg className="w-4 h-4 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-emerald-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
        )}
      </button>
    </div>
  );
}
