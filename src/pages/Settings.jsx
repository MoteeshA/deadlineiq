import { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  getDocs,
  doc,
} from "firebase/firestore";
import { useToast } from "../context/ToastContext";

export default function Settings() {
  const { addToast } = useToast();
  const [user, setUser] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(
    localStorage.getItem("deadlineiq_gemini_api_key") || ""
  );
  const [elevenLabsKey, setElevenLabsKey] = useState(
    localStorage.getItem("deadlineiq_elevenlabs_api_key") || ""
  );
  const [elevenLabsVoice, setElevenLabsVoice] = useState(
    localStorage.getItem("deadlineiq_elevenlabs_voice_id") || "21m00Tcm4TlvDq8ikWAM"
  );
  const [resendKey, setResendKey] = useState(
    localStorage.getItem("deadlineiq_resend_api_key") || ""
  );
  const [resendEmail, setResendEmail] = useState(
    localStorage.getItem("deadlineiq_resend_recipient_email") || ""
  );

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsub();
  }, []);

  const handleExportCSV = async () => {
    if (!user) {
      addToast("Please log in to export tasks.", { type: "error" });
      return;
    }
    setExporting(true);
    try {
      const tasksRef = collection(db, "users", user.uid, "tasks");
      const querySnapshot = await getDocs(tasksRef);
      const allTasks = querySnapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      const completedTasks = allTasks.filter((t) => t.status === "completed");

      if (completedTasks.length === 0) {
        addToast("No completed tasks found to export.", { type: "warning" });
        setExporting(false);
        return;
      }

      // Build CSV
      const headers = [
        "ID",
        "Title",
        "Priority",
        "Estimated Hours",
        "Status",
        "Deadline",
        "Created At",
        "Deferral Count",
      ];
      const escapeCSV = (str) => {
        if (str === null || str === undefined) return "";
        const stringVal = String(str);
        if (
          stringVal.includes(",") ||
          stringVal.includes('"') ||
          stringVal.includes("\n") ||
          stringVal.includes("\r")
        ) {
          return `"${stringVal.replace(/"/g, '""')}"`;
        }
        return stringVal;
      };

      const rows = completedTasks.map((t) => {
        const deadlineDate = t.deadline?.toDate
          ? t.deadline.toDate()
          : t.deadline
          ? new Date(t.deadline)
          : null;
        const createdDate = t.createdAt?.toDate
          ? t.createdAt.toDate()
          : t.createdAt
          ? new Date(t.createdAt)
          : null;

        return [
          t.id,
          t.title,
          t.priority,
          t.estimatedHours,
          t.status,
          deadlineDate ? deadlineDate.toISOString() : "",
          createdDate ? createdDate.toISOString() : "",
          t.deferralCount || 0,
        ]
          .map(escapeCSV)
          .join(",");
      });

      const csvContent = [headers.join(","), ...rows].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `deadlineiq_completed_tasks_${new Date().toISOString().slice(0, 10)}.csv`
      );
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      addToast("Successfully connected & exported to Google Sheets (simulated)! 📊", {
        type: "success",
      });
    } catch (err) {
      console.error("Error exporting CSV:", err);
      addToast("Failed to export tasks.", { type: "error" });
    } finally {
      setExporting(false);
    }
  };

  const handleSaveApiKey = (e) => {
    e.preventDefault();
    localStorage.setItem("deadlineiq_gemini_api_key", apiKeyInput.trim());
    addToast("Gemini API key saved successfully!", { type: "success" });
  };

  const handleSaveElevenLabs = (e) => {
    e.preventDefault();
    localStorage.setItem("deadlineiq_elevenlabs_api_key", elevenLabsKey.trim());
    localStorage.setItem("deadlineiq_elevenlabs_voice_id", elevenLabsVoice.trim());
    addToast("ElevenLabs voice credentials saved! 🗣️", { type: "success" });
  };

  const handleSaveResend = (e) => {
    e.preventDefault();
    localStorage.setItem("deadlineiq_resend_api_key", resendKey.trim());
    localStorage.setItem("deadlineiq_resend_recipient_email", resendEmail.trim());
    addToast("Resend notifications configured successfully! 📧", { type: "success" });
  };

  return (
    <div className="flex-1 flex flex-col">
      <div className="mb-8">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
          Settings
        </h2>
        <p className="text-slate-400 text-sm mt-1">
          Manage your account profile and load mock data for testing.
        </p>
      </div>

      <div className="space-y-6">
        {/* User Profile Info */}
        {user && (
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName}
                className="w-20 h-20 rounded-full border border-slate-700 object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-black text-2xl text-white">
                {user.displayName?.charAt(0).toUpperCase() || "U"}
              </div>
            )}
            <div className="text-center sm:text-left">
              <h3 className="text-lg font-bold text-slate-100">{user.displayName || "Anonymous User"}</h3>
              <p className="text-sm text-slate-400 mt-1">{user.email}</p>
              <div className="mt-3 flex flex-wrap gap-2 justify-center sm:justify-start">
                <span className="bg-slate-950 border border-slate-800 text-[10px] text-slate-500 font-bold uppercase tracking-wide px-3 py-1 rounded-full">
                  User ID: {user.uid.slice(0, 8)}...
                </span>
                <span className="bg-indigo-950 border border-indigo-900 text-[10px] text-indigo-400 font-bold uppercase tracking-wide px-3 py-1 rounded-full">
                  Provider: Google Auth
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Gemini API Key Configuration */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 sm:p-8">
          <h3 className="text-base font-bold text-slate-200 mb-2 flex items-center gap-2 select-none">
            <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 7a2 2 0 012 2m-3.414 1.586A2 2 0 1010 14h.01M10 14h2v2h2V8.414l-4.586 4.586z" />
            </svg> Gemini API Key Setup
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed max-w-xl mb-5">
            Provide your Gemini Developer API key to unlock natural language task parsing, automatic subtask generation, and realistic scheduling insights.
          </p>

          <form onSubmit={handleSaveApiKey} className="flex flex-col sm:flex-row gap-3 max-w-lg">
            <input
              type="password"
              placeholder="Enter Gemini API Key (e.g. AIzaSy...)"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 outline-none transition"
            />
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs tracking-wide transition active:scale-[0.98]"
            >
              Save Key
            </button>
          </form>
        </div>

        {/* Resend Email Alerts Configuration */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 sm:p-8">
          <h3 className="text-base font-bold text-slate-200 mb-2 flex items-center gap-2 select-none">
            <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg> Resend Email Notifications
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed max-w-xl mb-5">
            Link a free Resend.com API key and your registered recipient email to receive proactive notifications and procrastination warnings triggered by the local neural net.
          </p>

          <form onSubmit={handleSaveResend} className="space-y-4 max-w-lg">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider select-none">
                Resend API Key
              </label>
              <input
                type="password"
                placeholder="re_your_free_resend_key"
                value={resendKey}
                onChange={(e) => setResendKey(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 outline-none transition"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider select-none">
                Recipient Notification Email
              </label>
              <input
                type="email"
                placeholder="e.g. your_email@example.com"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 outline-none transition"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs tracking-wide transition active:scale-[0.98] cursor-pointer"
            >
              Save Email Config
            </button>
          </form>
        </div>

        {/* ElevenLabs API Configuration */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 sm:p-8">
          <h3 className="text-base font-bold text-slate-200 mb-2 flex items-center gap-2 select-none">
            <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg> ElevenLabs Voice Intelligence
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed max-w-xl mb-5">
            Provide your ElevenLabs API Key and Voice ID to enable ultra-realistic, custom AI voice synthesis (e.g. Swara or Whisper styles) in the orb speaker and sidebar agent.
          </p>

          <form onSubmit={handleSaveElevenLabs} className="space-y-4 max-w-lg">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider select-none">
                ElevenLabs API Key
              </label>
              <input
                type="password"
                placeholder="xi-api-key"
                value={elevenLabsKey}
                onChange={(e) => setElevenLabsKey(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 outline-none transition"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider select-none">
                ElevenLabs Voice ID
              </label>
              <input
                type="text"
                placeholder="e.g. 21m00Tcm4TlvDq8ikWAM (Rachel default)"
                value={elevenLabsVoice}
                onChange={(e) => setElevenLabsVoice(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 outline-none transition"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-indigo-550 hover:bg-indigo-600 text-white font-bold text-xs tracking-wide transition active:scale-[0.98] cursor-pointer"
            >
              Save Voice Credentials
            </button>
          </form>
        </div>

        {/* Data Integration & Export */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 sm:p-8">
          <h3 className="text-base font-bold text-slate-200 mb-2 flex items-center gap-2 select-none">
            <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg> Data Integration & Export
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed max-w-xl mb-5">
            Synchronize your productivity metrics with your personal Google Workspace. Click below to download a spreadsheet-compatible CSV of all completed tasks and trigger a simulated Google Sheets API synchronization.
          </p>

          <button
            onClick={handleExportCSV}
            disabled={exporting}
            className="px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98] border border-emerald-500/30 text-white font-bold text-sm tracking-wide transition flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:pointer-events-none"
          >
            {exporting ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Exporting...
              </>
            ) : (
              <>
                <span>💚</span> Export to Google Sheets (CSV)
              </>
            )}
          </button>
        </div>


      </div>
    </div>
  );
}