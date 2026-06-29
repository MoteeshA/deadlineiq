import { useState, useEffect, useRef } from "react";
import { chatWithProductivityAgent } from "../services/gemini";
import { useToast } from "../context/ToastContext";

const WELCOME_MSG = {
  id: "msg-welcome",
  role: "model",
  text: "Hey! I'm your IQ Coach. I analyze your productivity forensics and help you optimize your commitments. Ask me anything, or let me plan your tasks!",
  time: new Date().toISOString(),
};

export default function AIAgentSidebar({ isOpen, onClose, user, tasks, onExecuteAction }) {
  const { addToast } = useToast();

  // FIX: Load persisted chat history from localStorage on mount
  const [messages, setMessages] = useState(() => {
    if (!user) return [WELCOME_MSG];
    try {
      const saved = localStorage.getItem(`deadlineiq_chat_history_${user.uid}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Restore Date objects
        return parsed.map(m => ({ ...m, time: new Date(m.time) }));
      }
    } catch {}
    return [WELCOME_MSG];
  });

  // FIX: DEFER confirmation state — ask user before writing to Firestore
  const [deferConfirm, setDeferConfirm] = useState(null); // { action, label }

  const [inputValue, setInputValue] = useState("");
  const [sending, setSending] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const scrollRef = useRef(null);
  const activeAudioRef = useRef(null);

  // FIX: Save messages to localStorage whenever they change
  useEffect(() => {
    if (!user || messages.length === 0) return;
    try {
      localStorage.setItem(
        `deadlineiq_chat_history_${user.uid}`,
        JSON.stringify(messages.slice(-50)) // keep last 50 messages
      );
    } catch {}
  }, [messages, user]);

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      addToast("Speech recognition is not supported in this browser. Try Chrome/Safari.", { type: "warning" });
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      addToast("Listening... Speak now.", { type: "info", duration: 2000 });
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
      addToast(`Voice error: ${event.error}`, { type: "error" });
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onresult = (event) => {
      const speechToText = event.results[0][0].transcript;
      setInputValue(speechToText);
      addToast("Transcribed voice input!", { type: "success" });
    };

    recognition.start();
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || sending || !user) return;

    const userMessage = {
      id: `msg-user-${Date.now()}`,
      role: "user",
      text: inputValue.trim(),
      time: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setSending(true);

    try {
      // Get procrastination profile or defaults
      let profile = {
        primaryPattern: "Fear of Failure",
        explanation: "Prefers morning focus for high impact tasks.",
        triggerCategories: ["Writing", "Presentations"]
      };

      const cachedPattern = localStorage.getItem(`deadlineiq_pattern_${user.uid}`);
      if (cachedPattern) {
        try {
          profile = JSON.parse(cachedPattern);
        } catch (err) { console.error(err); }
      }

      // Call agent API
      const response = await chatWithProductivityAgent(
        userMessage.text,
        messages.map((m) => ({ role: m.role, text: m.text })),
        tasks,
        profile
      );

      const agentMessage = {
        id: `msg-agent-${Date.now()}`,
        role: "model",
        text: response.reply,
        time: new Date(),
      };

      setMessages((prev) => [...prev, agentMessage]);

      // Speak response aloud if not muted
      const muted = localStorage.getItem("deadlineiq_voice_muted") === "true";
      if (!muted && response.reply) {
        if (activeAudioRef.current) {
          activeAudioRef.current.pause();
        }
        window.speechSynthesis?.cancel();

        // Truncate to first two sentences to respect 200 char limit
        const sentences = response.reply.match(/[^.!?]+[.!?]+/g) || [response.reply];
        const conciseReply = sentences.slice(0, 2).join(" ").substring(0, 180);

        const elKey = localStorage.getItem("deadlineiq_elevenlabs_api_key");
        const elVoice = localStorage.getItem("deadlineiq_elevenlabs_voice_id") || "21m00Tcm4TlvDq8ikWAM";

        const playLocalFallback = () => {
          const utterance = new SpeechSynthesisUtterance(conciseReply);
          if (window.speechSynthesis) {
            const voices = window.speechSynthesis.getVoices();
            const voice = voices.find(v => 
              v.lang.toLowerCase().includes("en-in") || 
              v.lang.toLowerCase().includes("en_in") ||
              v.name.toLowerCase().includes("india")
            ) || voices.find(v => 
              v.name.toLowerCase().includes("google us english") || 
              v.name.toLowerCase().includes("samantha")
            ) || voices.find(v => v.lang.startsWith("en"));
            if (voice) utterance.voice = voice;
          }
          utterance.rate = 1.1;
          utterance.pitch = 1.0;
          window.speechSynthesis?.speak(utterance);
        };

        if (elKey) {
          try {
            fetch(`https://api.elevenlabs.io/v1/text-to-speech/${elVoice}`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "xi-api-key": elKey
              },
              body: JSON.stringify({
                text: conciseReply,
                model_id: "eleven_monolingual_v1",
                voice_settings: { stability: 0.75, similarity_boost: 0.75 }
              })
            }).then(res => {
              if (!res.ok) throw new Error("ElevenLabs fail");
              return res.blob();
            }).then(blob => {
              const objectUrl = URL.createObjectURL(blob);
              const audio = new Audio(objectUrl);
              audio.playbackRate = 1.12;
              activeAudioRef.current = audio;
              audio.onended = () => URL.revokeObjectURL(objectUrl);
              audio.onerror = () => { URL.revokeObjectURL(objectUrl); playLocalFallback(); };
              audio.play();
            }).catch(err => {
              console.warn("ElevenLabs failed, using Web Speech:", err);
              playLocalFallback();
            });
            return;
          } catch (err) {
            console.warn("ElevenLabs catch, using Web Speech:", err);
          }
        }

        // FIX: use Web Speech directly — removed Google Translate TTS (unofficial/unreliable endpoint)
        playLocalFallback();
      }

      // FIX: Intercept DEFER_TASK — show confirmation before writing to Firestore
      if (response.action && response.action.type !== "NONE") {
        if (response.action.type === "DEFER_TASK") {
          const targetTask = tasks.find(t => t.id === response.action.payload?.taskId);
          const newDate = response.action.payload?.newDeadline
            ? new Date(response.action.payload.newDeadline).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
            : "a new date";
          setDeferConfirm({
            action: response.action,
            label: `Reschedule "${targetTask?.title || "task"}" to ${newDate}?`
          });
        } else {
          onExecuteAction(response.action);
        }
      }
    } catch (err) {
      console.error(err);
      addToast("Failed to chat with agent", { type: "error" });
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    return () => {
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen && activeAudioRef.current) {
      activeAudioRef.current.pause();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-80 sm:w-96 bg-slate-950 border-l border-slate-800/85 backdrop-blur-xl flex flex-col z-50 shadow-2xl animate-slide-in-right">
      {/* Header */}
      <div className="p-4 border-b border-slate-850/60 flex items-center justify-between bg-slate-900/20">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping" />
          <div>
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-widest leading-none">
              IQ Coach Co-Pilot
            </h4>
            <span className="text-[9px] text-slate-500 font-semibold tracking-wider block mt-1 uppercase">
              Agentic Automation Mode
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white transition p-1.5 hover:bg-white/5 rounded-lg"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* FIX: DEFER Confirmation Banner */}
      {deferConfirm && (
        <div className="mx-3 mt-3 p-3 bg-amber-950/40 border border-amber-500/30 rounded-xl flex flex-col gap-2">
          <p className="text-xs font-bold text-amber-300">{deferConfirm.label}</p>
          <div className="flex gap-2">
            <button
              onClick={() => { onExecuteAction(deferConfirm.action); setDeferConfirm(null); addToast("Task rescheduled!", { type: "success" }); }}
              className="flex-1 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 font-bold text-[10px] uppercase tracking-wider transition"
            >
              ✓ Confirm
            </button>
            <button
              onClick={() => { setDeferConfirm(null); addToast("Reschedule cancelled.", { type: "info" }); }}
              className="flex-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 font-bold text-[10px] uppercase tracking-wider transition"
            >
              ✗ Cancel
            </button>
          </div>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        {messages.map((m) => {
          const isUser = m.role === "user";
          return (
            <div
              key={m.id}
              className={`flex flex-col ${isUser ? "items-end" : "items-start"} max-w-[85%] ${
                isUser ? "ml-auto" : "mr-auto"
              }`}
            >
              <div
                className={`p-3.5 rounded-2xl text-xs leading-relaxed font-semibold ${
                  isUser
                    ? "bg-indigo-650 text-white rounded-tr-none shadow-md shadow-indigo-950/20"
                    : "bg-slate-900/60 border border-slate-850 text-slate-200 rounded-tl-none"
                }`}
              >
                {m.text}
              </div>
              <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mt-1 px-1 select-none">
                {m.time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          );
        })}

        {sending && (
          <div className="flex items-center gap-2 text-slate-500 text-[10px] font-bold uppercase tracking-widest pl-1 animate-pulse">
            <span className="flex h-1.5 w-1.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500"></span>
            </span>
            Coach is typing...
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      <form onSubmit={handleSend} className="p-4 border-t border-slate-850/60 bg-slate-900/10 flex gap-2">
        <button
          type="button"
          onClick={startListening}
          className={`p-2.5 rounded-xl border flex items-center justify-center transition cursor-pointer shrink-0 ${
            isListening
              ? "bg-rose-500/20 border-rose-500/40 text-rose-400 animate-pulse"
              : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
          }`}
          title="Speak to Coach"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        </button>
        <input
          type="text"
          placeholder="Ask coach to schedule, add, or snooze..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          disabled={sending}
          className="flex-1 bg-slate-950 border border-slate-800 focus:border-indigo-550 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 outline-none transition"
        />
        <button
          type="submit"
          disabled={sending || !inputValue.trim()}
          className="px-4 py-2.5 rounded-xl bg-indigo-550 hover:bg-indigo-650 text-white font-bold text-xs transition active:scale-[0.98] disabled:opacity-50 shrink-0"
        >
          Send
        </button>
      </form>
    </div>
  );
}
