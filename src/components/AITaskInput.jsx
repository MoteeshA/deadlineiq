import { useState } from "react";
import { parseTaskWithGemini } from "../services/gemini";
import { useToast } from "../context/ToastContext";

export default function AITaskInput({ existingTasks, onSaveTask }) {
  const { addToast } = useToast();
  const [promptInput, setPromptInput] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [isListening, setIsListening] = useState(false);

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
      setPromptInput(prev => prev ? `${prev} ${speechToText}` : speechToText);
      addToast("Speech transcribed successfully!", { type: "success" });
    };

    recognition.start();
  };
  
  // States for interactive parsed task
  const [parsedTask, setParsedTask] = useState(null);
  const [subtasks, setSubtasks] = useState([]);
  const [clarifyingAnswer, setClarifyingAnswer] = useState("");

  const handleAnalyze = async (textToAnalyze) => {
    if (!textToAnalyze.trim()) return;
    setAnalyzing(true);
    setParsedTask(null);
    try {
      const data = await parseTaskWithGemini(textToAnalyze);
      setParsedTask(data);
      if (data.subtasks) {
        setSubtasks(data.subtasks);
      }
    } catch (err) {
      console.error(err);
      addToast(err.message, { type: "error" });
    } finally {
      setAnalyzing(false);
    }
  };

  // Clarification handler: append answer to original prompt and re-run
  const handleSubmitClarification = (e) => {
    e.preventDefault();
    if (!clarifyingAnswer.trim()) return;
    const combinedPrompt = `${promptInput} (${clarifyingAnswer.trim()})`;
    setPromptInput(combinedPrompt);
    setClarifyingAnswer("");
    handleAnalyze(combinedPrompt);
  };

  // Subtask changes
  const handleUpdateSubtaskTitle = (idx, newTitle) => {
    setSubtasks(prev => prev.map((s, i) => i === idx ? { ...s, title: newTitle } : s));
  };

  const handleUpdateSubtaskDuration = (idx, newDuration) => {
    const val = parseFloat(newDuration) || 0;
    setSubtasks(prev => prev.map((s, i) => i === idx ? { ...s, durationHours: val } : s));
  };

  const handleDeleteSubtask = (idx) => {
    setSubtasks(prev => prev.filter((_, i) => i !== idx));
  };

  const handleAddSubtask = () => {
    setSubtasks(prev => [...prev, { title: "New action item", durationHours: 1 }]);
  };

  // Computations
  const totalSubtaskHours = subtasks.reduce((sum, s) => sum + s.durationHours, 0);
  const totalHoursWithBuffer = totalSubtaskHours * 1.2;

  // Realism Checks
  const getRealismWarning = () => {
    if (!parsedTask || !parsedTask.deadline) return null;
    const deadlineDate = new Date(parsedTask.deadline);
    const now = new Date();
    const diffMs = deadlineDate - now;

    if (diffMs < 0) {
      return { isCritical: true, message: "⚠️ Warning: Selected deadline has already passed." };
    }

    const remainingHours = diffMs / (1000 * 60 * 60);
    if (totalHoursWithBuffer > remainingHours) {
      return {
        isCritical: true,
        message: `⚠️ Time Deficit: Only ${remainingHours.toFixed(1)}h left before deadline, but task requires ${totalHoursWithBuffer.toFixed(1)}h of effort (including 20% AI buffer).`,
        suggestion: `Suggest adjusting deadline or starting immediately.`
      };
    }
    return null;
  };

  // Conflict Checks
  const getConflictWarning = () => {
    if (!parsedTask || !parsedTask.deadline || !existingTasks) return null;
    const targetTime = new Date(parsedTask.deadline).getTime();
    const WINDOW_MS = 1.5 * 60 * 60 * 1000; // 1.5 hours window

    for (const t of existingTasks) {
      if (t.status === "completed" || !t.deadline) continue;
      const exTime = t.deadline.toDate ? t.deadline.toDate().getTime() : new Date(t.deadline).getTime();
      if (Math.abs(targetTime - exTime) < WINDOW_MS) {
        return `⚠️ Conflict: Clashes with deadline for task "${t.title}" (within 1.5h window).`;
      }
    }
    return null;
  };

  const realismWarning = getRealismWarning();
  const conflictWarning = getConflictWarning();

  const handleConfirmSave = () => {
    if (!parsedTask) return;
    
    // Construct final task doc
    const deadlineVal = parsedTask.deadline ? new Date(parsedTask.deadline) : null;
    onSaveTask({
      title: parsedTask.title,
      deadline: deadlineVal,
      estimatedHours: Math.round(totalSubtaskHours * 10) / 10,
      priority: parsedTask.priority || "medium",
      type: parsedTask.type || "General",
      registrationLink: parsedTask.registrationLink || null,
      prizes: parsedTask.prizes || null,
      eligibility: parsedTask.eligibility || null,
      location: parsedTask.location || null,
      subtasks: subtasks.map(s => ({ title: s.title, durationHours: s.durationHours, completed: false })),
    });

    // Reset everything
    setParsedTask(null);
    setSubtasks([]);
    setPromptInput("");
  };

  const handleCancel = () => {
    setParsedTask(null);
    setSubtasks([]);
  };

  return (
    <div className="bg-white/[0.01] border border-white/5 rounded-[28px] p-6 mb-8 backdrop-blur-md hover:bg-white/[0.015] hover:border-white/10 transition-all duration-300">
      <h3 className="text-xs font-bold text-slate-450 uppercase tracking-widest mb-4 flex items-center gap-2 font-mono">
        <span>🧠</span> Gemini AI Planner
      </h3>

      {/* natural text prompt input form */}
      {!parsedTask && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAnalyze(promptInput);
          }}
          className="space-y-4"
        >
          <div>
            <textarea
              placeholder="What do you need to get done? (e.g., 'Finish project report by Friday at 5pm, takes 4h high priority')"
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              disabled={analyzing}
              rows={2}
              className="w-full bg-[#050505]/40 border border-white/5 focus:border-indigo-500 rounded-2xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:ring-2 focus:ring-indigo-500/10 resize-none disabled:opacity-50"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={analyzing || !promptInput.trim()}
              className="px-5 py-2.5 rounded-xl bg-white text-[#050505] hover:bg-slate-100 font-bold text-xs tracking-wide transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
            >
              {analyzing ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-[#050505]" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  AI Brain Thinking...
                </>
              ) : (
                <>
                  <span>💫</span> Plan with AI
                </>
              )}
            </button>

            <button
              type="button"
              onClick={startListening}
              disabled={analyzing}
              className={`px-4 py-2.5 rounded-xl border font-bold text-xs transition flex items-center gap-2 active:scale-[0.98] cursor-pointer ${
                isListening
                  ? "bg-rose-500/20 border-rose-500/40 text-rose-400 animate-pulse"
                  : "bg-white/[0.02] border-white/5 text-slate-400 hover:bg-white/[0.05] hover:text-slate-200"
              }`}
            >
              {isListening ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-450 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                  </span>
                  Recording...
                </>
              ) : (
                <>
                  <span>🎙️</span> Speak
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Loader placeholder when analyzing */}
      {analyzing && (
        <div className="mt-4 bg-slate-950/40 border border-slate-800/40 rounded-2xl p-6 space-y-4 animate-pulse">
          <div className="h-5 bg-slate-800 rounded w-1/3" />
          <div className="h-4 bg-slate-800 rounded w-1/4" />
          <div className="space-y-2">
            <div className="h-4 bg-slate-800 rounded w-full" />
            <div className="h-4 bg-slate-800 rounded w-5/6" />
          </div>
        </div>
      )}

      {/* Parse Preview Container */}
      {parsedTask && !analyzing && (
        <div className="mt-2 space-y-6">
          {/* Vague Task Clarification Card */}
          {parsedTask.isVague ? (
            <div className="bg-amber-950/20 border border-amber-500/20 rounded-2xl p-5 space-y-4">
              <h4 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                <span>🤔</span> Just a Quick Question...
              </h4>
              <p className="text-xs text-slate-350 leading-relaxed font-semibold">
                "{parsedTask.clarifyingQuestion}"
              </p>
              <form onSubmit={handleSubmitClarification} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type details to help specify your task..."
                  value={clarifyingAnswer}
                  onChange={(e) => setClarifyingAnswer(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 outline-none transition"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!clarifyingAnswer.trim()}
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs transition disabled:opacity-50"
                >
                  Update
                </button>
              </form>
              <button
                onClick={handleCancel}
                className="text-xs text-slate-500 hover:text-slate-300 font-semibold underline block"
              >
                Start Over
              </button>
            </div>
          ) : (
            // Full Parsed task Preview
            <div className="space-y-6">
              {parsedTask.isFallback && (
                <div className="p-3.5 bg-indigo-950/40 border border-indigo-500/20 text-indigo-400 text-xs rounded-xl font-medium leading-relaxed space-y-1">
                  <div>
                    ℹ️ <strong>Local Planner Active</strong>: We've planned your task offline.
                  </div>
                  <div className="text-[10px] text-slate-400 leading-normal font-semibold">
                    API Diagnostic: {parsedTask.fallbackReason}
                  </div>
                </div>
              )}

              
              {/* Metadata row */}
              <div className="flex flex-wrap items-center gap-4 bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4">
                <div className="flex-1 min-w-[200px]">
                  <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest">Parsed Title</span>
                  <input
                    type="text"
                    value={parsedTask.title}
                    onChange={(e) => setParsedTask({ ...parsedTask, title: e.target.value })}
                    className="w-full bg-transparent font-bold text-slate-200 focus:text-white border-b border-transparent focus:border-slate-700 outline-none py-0.5 text-sm"
                  />
                </div>
                <div>
                  <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest">Deadline</span>
                  <input
                    type="datetime-local"
                    value={parsedTask.deadline ? parsedTask.deadline.slice(0, 16) : ""}
                    onChange={(e) => setParsedTask({ ...parsedTask, deadline: e.target.value })}
                    className="bg-transparent text-xs font-semibold text-slate-300 focus:text-white border-b border-transparent focus:border-slate-700 outline-none py-0.5"
                  />
                </div>
                <div>
                  <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest">Category</span>
                  <input
                    type="text"
                    value={parsedTask.type}
                    onChange={(e) => setParsedTask({ ...parsedTask, type: e.target.value })}
                    className="bg-transparent text-xs font-semibold text-slate-300 focus:text-white border-b border-transparent focus:border-slate-700 outline-none py-0.5 w-20"
                  />
                </div>
                <div>
                  <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest">Confidence</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="w-10 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${parsedTask.confidence > 0.7 ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                        style={{ width: `${parsedTask.confidence * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400">{Math.round(parsedTask.confidence * 100)}%</span>
                  </div>
                </div>
              </div>

              {/* Warning/Clash Boxes */}
              {(realismWarning || conflictWarning) && (
                <div className="space-y-2">
                  {realismWarning && (
                    <div className="p-3.5 bg-rose-950/20 border border-rose-500/20 text-rose-400 text-xs rounded-xl font-medium leading-relaxed">
                      <div>{realismWarning.message}</div>
                      {realismWarning.suggestion && (
                        <div className="text-[10px] text-rose-500 font-bold uppercase mt-1">
                          👉 {realismWarning.suggestion}
                        </div>
                      )}
                    </div>
                  )}
                  {conflictWarning && (
                    <div className="p-3.5 bg-amber-950/20 border border-amber-500/20 text-amber-400 text-xs rounded-xl font-medium">
                      {conflictWarning}
                    </div>
                  )}
                </div>
              )}

              {/* Subtasks checklist items */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Generated Action Steps
                  </h4>
                  <button
                    onClick={handleAddSubtask}
                    type="button"
                    className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition flex items-center gap-1"
                  >
                    <span>+</span> Add Step
                  </button>
                </div>

                <div className="space-y-2">
                  {subtasks.map((sub, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 bg-slate-950/30 border border-slate-850 rounded-xl px-3 py-2"
                    >
                      {/* Subtask Title input */}
                      <input
                        type="text"
                        value={sub.title}
                        onChange={(e) => handleUpdateSubtaskTitle(idx, e.target.value)}
                        className="flex-1 bg-transparent text-xs text-slate-200 outline-none border-b border-transparent focus:border-slate-800 py-0.5"
                      />
                      {/* Subtask duration */}
                      <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-350 text-[10px] font-bold">
                        <input
                          type="number"
                          step="0.5"
                          min="0.5"
                          value={sub.durationHours}
                          onChange={(e) => handleUpdateSubtaskDuration(idx, e.target.value)}
                          className="bg-transparent w-7 text-center outline-none text-slate-100 text-[10px] font-bold border-none p-0"
                        />
                        <span>h</span>
                      </div>
                      {/* Delete subtask button */}
                      <button
                        onClick={() => handleDeleteSubtask(idx)}
                        className="text-slate-500 hover:text-rose-400 transition p-1"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
                
                {/* Total effort review footer */}
                <div className="mt-4 flex justify-between items-center text-xs font-semibold text-slate-400 px-1.5">
                  <span>Effort Total:</span>
                  <span>
                    {totalSubtaskHours.toFixed(1)}h 
                    <span className="text-slate-500 font-normal"> (+20% AI buffer = {totalHoursWithBuffer.toFixed(1)}h)</span>
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-4 border-t border-slate-800/60">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="flex-1 py-3 rounded-xl border border-slate-800 hover:bg-white/5 font-semibold text-slate-300 transition text-sm"
                >
                  Cancel Plan
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSave}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 font-semibold text-white transition text-sm shadow-xl shadow-indigo-500/10"
                >
                  Confirm & Commit
                </button>
              </div>

            </div>
          )}
        </div>
      )}
    </div>
  );
}
