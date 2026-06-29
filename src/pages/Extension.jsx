import { useState, useEffect, useRef } from "react";
import { auth, db } from "../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useToast } from "../context/ToastContext";
import { parseTaskWithGemini, parseMediaWithGemini } from "../services/gemini";
import { checkAndTriggerEmail } from "../services/email";
import { 
  Inbox, 
  Link as LinkIcon, 
  UploadCloud, 
  Image as ImageIcon, 
  FileText, 
  Bookmark, 
  Loader2, 
  CheckCircle2, 
  Plus, 
  Sparkles 
} from "lucide-react";

export default function Extension() {
  const { addToast } = useToast();
  const [urlInput, setUrlInput] = useState("");
  const [textInput, setTextInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [recentTask, setRecentTask] = useState(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const dropRef = useRef(null);
  const dragLinkRef = useRef(null);

  // Bookmarklet Code using redirection to guarantee bypass of popup blockers
  const bookmarkletCode = `javascript:(function(){const title=encodeURIComponent(document.title);const url=encodeURIComponent(window.location.href);const text=encodeURIComponent(window.getSelection().toString()||document.body.innerText.substring(0,2500));window.location.href='https://deadlineiq-6321f.web.app/extension?url='+url+'&title='+title+'&text='+text;})();`;

  // Set javascript href dynamically to bypass React XSS sanitization
  useEffect(() => {
    if (dragLinkRef.current) {
      dragLinkRef.current.setAttribute("href", bookmarkletCode);
    }
  }, [bookmarkletCode]);

  // Detect and process Bookmarklet Intake parameters on load
  useEffect(() => {
    const handleBookmarkletIntake = async () => {
      const params = new URLSearchParams(window.location.search);
      const urlParam = params.get("url");
      const titleParam = params.get("title");
      const textParam = params.get("text");

      if (urlParam || titleParam || textParam) {
        if (urlParam) setSourceUrl(urlParam);
        setIsProcessing(true);
        setStatusText("Bookmarklet received. Initializing AI Parsing Layer...");
        try {
          const contentSource = `Source URL: ${urlParam || "unspecified"}\nPage Title: ${titleParam || "unspecified"}\nContent Summary: ${textParam || "unspecified"}`;
          
          // Call AI parser
          const taskData = await parseTaskWithGemini(contentSource, setStatusText);
          await saveCapturedTask(taskData, "Bookmarklet Capture", urlParam);
          
          setStatusText("Success! Opportunity logged in your board.");
          setTimeout(() => {
            // Close popup if opened as popup, else stay
            if (window.opener) {
              window.close();
            }
          }, 2000);
        } catch (err) {
          console.error("Bookmarklet capture failed:", err);
          addToast(`Capture failed: ${err.message}`, { type: "error" });
        } finally {
          setIsProcessing(false);
        }
      }
    };

    handleBookmarkletIntake();
  }, []);

  // Global Paste listener (Ctrl+V) for Screenshot Clipboard Images
  useEffect(() => {
    const handlePaste = async (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            addToast("Screenshot detected in clipboard! Processing...", { type: "info" });
            await processFile(file);
          }
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  // Dynamic loader for local browser OCR library (Tesseract.js)
  async function loadTesseract() {
    if (window.Tesseract) return window.Tesseract;
    return new Promise((resolve, reject) => {
      setStatusText("Connecting to local OCR CDN (Tesseract.js)...");
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
      script.onload = () => resolve(window.Tesseract);
      script.onerror = () => reject(new Error("Failed to load local OCR library from CDN"));
      document.head.appendChild(script);
    });
  }

  // File Processor (OCR + Vision + NLP)
  async function processFile(file) {
    setIsProcessing(true);
    setStatusText(`AI processing ${file.name} (OCR + Vision Layer)...`);
    
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = reader.result.split(",")[1];
          let mimeType = file.type;
          
          // PDF Mime fallback if standard reader misses it
          if (file.name.endsWith(".pdf")) {
            mimeType = "application/pdf";
          }

          const apiKey = localStorage.getItem("deadlineiq_gemini_api_key") || import.meta.env.VITE_GEMINI_API_KEY;
          
          if (!apiKey) {
            if (mimeType.startsWith("image/")) {
              setStatusText("No API Key found. Initializing local OCR engine (Tesseract)...");
              const TesseractObj = await loadTesseract();
              
              setStatusText("Running local OCR character recognition...");
              const ocrResult = await TesseractObj.recognize(reader.result, 'eng', {
                logger: m => {
                  if (m.status === "recognizing") {
                    setStatusText(`Local OCR: processing image (${Math.round(m.progress * 100)}%)...`);
                  }
                }
              });

              const extractedText = ocrResult.data.text;
              if (!extractedText.trim()) {
                throw new Error("Local OCR could not extract any readable text from the image.");
              }

              setStatusText("Extracting tasks from OCR text with local model...");
              const parsedTask = await parseTaskWithGemini(`[Extracted from Screenshot/Image OCR]\n${extractedText}`, setStatusText);
              await saveCapturedTask(parsedTask, `Offline Image OCR: ${file.name}`);
              return;
            } else {
              throw new Error("Offline file ingestion only supports images (PNG, JPG). PDFs require a Gemini API Key.");
            }
          }

          const parsedTask = await parseMediaWithGemini(base64Data, mimeType);
          await saveCapturedTask(parsedTask, `File: ${file.name}`);
        } catch (err) {
          console.error(err);
          addToast(err.message || "Failed to analyze document", { type: "error" });
        } finally {
          setIsProcessing(false);
        }
      };
      
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      addToast("File reading error", { type: "error" });
      setIsProcessing(false);
    }
  }

  // Helper to commit parsed task to Firestore & dispatch alerts
  async function saveCapturedTask(taskData, source, originalUrl = null) {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("No active user session found. Please log in.");
    }

    // ── Duplicate Guard (localStorage — no Firestore index needed) ─────────────
    // If the same title was captured in the last 5 minutes, skip to prevent duplicates
    const dedupeKey = `deadlineiq_capture_${(taskData.title || "").toLowerCase().replace(/\s+/g, "_").substring(0, 60)}`;
    const lastCapturedAt = localStorage.getItem(dedupeKey);
    if (lastCapturedAt && Date.now() - parseInt(lastCapturedAt, 10) < 5 * 60 * 1000) {
      addToast(`"${taskData.title}" was already captured recently — no duplicate created.`, { type: "info" });
      return;
    }
    localStorage.setItem(dedupeKey, Date.now().toString());
    // ──────────────────────────────────────────────────────────────────────────

    // ── Smart Registration Link Fallback ──────────────────────────────────
    // Centralized fallback for registrationLink when capturing from bookmarklet or scraping web URL.
    let parsedUrl = originalUrl || null;
    if (!parsedUrl && source && source.startsWith("Web: ")) {
      parsedUrl = source.replace("Web: ", "").trim();
    } else if (!parsedUrl && source === "Bookmarklet Capture" && sourceUrl) {
      parsedUrl = sourceUrl;
    }

    let finalRegLink = taskData.registrationLink || null;
    if (!finalRegLink && parsedUrl) {
      const decodedUrl = decodeURIComponent(parsedUrl);
      const hackathonTypePattern = /hackathon|competition|contest|challenge|devpost|unstop|hackerearth|hack|athon|combat|tournament|olympiad/i;
      if (hackathonTypePattern.test(`${decodedUrl} ${taskData.title} ${taskData.type}`)) {
        finalRegLink = decodedUrl;
      }
    }
    // ─────────────────────────────────────────────────────────────────────

    const newTask = {
      title: taskData.title || "Untitled Captured Task",
      deadline: taskData.deadline ? new Date(taskData.deadline) : null,
      eventStart: taskData.eventStart ? new Date(taskData.eventStart) : null,
      reminderAt: taskData.reminderAt ? new Date(taskData.reminderAt) : null,
      taskKind: taskData.taskKind || "task",
      estimatedHours: taskData.estimatedHours || 2,
      priority: taskData.priority || "medium",
      type: taskData.type || "General",
      registrationLink: finalRegLink,
      prizes: taskData.prizes || null,
      eligibility: taskData.eligibility || null,
      location: taskData.location || null,
      subtasks: taskData.subtasks || [],
      status: "today",
      createdAt: serverTimestamp(),
      deferralCount: 0,
      deferralHistory: [],
      captureSource: source,
      sourceUrl: parsedUrl ? decodeURIComponent(parsedUrl) : null
    };

    const docRef = await addDoc(collection(db, "users", user.uid, "tasks"), newTask);
    
    const taskWithId = {
      id: docRef.id,
      ...newTask,
      deadline: newTask.deadline,
      eventStart: newTask.eventStart,
      reminderAt: newTask.reminderAt
    };

    setRecentTask(taskWithId);
    addToast(`${taskWithId.taskKind === "event" ? "Reminder" : "Task"} "${taskWithId.title}" auto-created!`, { type: "success" });

    // Proactively check procrastination risk & send email alert
    if (taskWithId.taskKind !== "event") {
      try {
        await checkAndTriggerEmail(taskWithId, "capture");
      } catch (emailErr) {
        console.error("Procrastination alert email trigger failed:", emailErr);
      }
    }
  }

  // Scrape and parse pasted URL (Devpost, Syllabus site, etc.)
  const handleUrlSubmit = async (e) => {
    e.preventDefault();
    if (!urlInput.trim()) return;

    setIsProcessing(true);
    setStatusText("Fetching web page contents via CORS gateway...");

    try {
      // CORS proxy wrapper
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(urlInput.trim())}`;
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error("CORS Proxy Fetch Failed");

      const json = await response.json();
      const htmlContents = json.contents;

      // Extract raw body text
      const domParser = new DOMParser();
      const doc = domParser.parseFromString(htmlContents, "text/html");
      
      // Clean script and style nodes for token efficiency
      doc.querySelectorAll("script, style, svg, nav, footer").forEach(node => node.remove());
      const pageText = doc.body.innerText.replace(/\s+/g, " ").substring(0, 3000);

      setStatusText("Extracting opportunity details and scheduling constraints with Gemini...");
      const taskData = await parseTaskWithGemini(`Scraped Website URL: ${urlInput}\nPage Contents: ${pageText}`, setStatusText);
      await saveCapturedTask(taskData, `Web: ${urlInput}`, urlInput);
      
      setUrlInput("");
    } catch (err) {
      console.error(err);
      addToast("Failed to fetch or parse web content. Try copy-pasting the text instead.", { type: "error" });
    } finally {
      setIsProcessing(false);
    }
  };

  // Submit pasted text block
  const handleTextSubmit = async (e) => {
    e.preventDefault();
    if (!textInput.trim()) return;

    setIsProcessing(true);
    setStatusText("Analyzing text block for opportunities...");

    try {
      const taskData = await parseTaskWithGemini(textInput.trim(), setStatusText);
      await saveCapturedTask(taskData, "Text Capture");
      setTextInput("");
    } catch (err) {
      console.error(err);
      addToast("Failed to parse text", { type: "error" });
    } finally {
      setIsProcessing(false);
    }
  };

  // Drag handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      await processFile(file);
    }
  };

  return (
    <div className="flex-1 bg-transparent text-white p-6 md:p-8 animate-zoom-in relative z-10 max-w-5xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3 mb-2 select-none">
        <span className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-500/5">
          <Inbox className="h-5.5 w-5.5" />
        </span>
        <div>
          <h2 className="text-xl font-black uppercase tracking-[0.16em] text-slate-100 font-mono">
            AI Opportunity Capture Inbox
          </h2>
          <p className="text-[10px] font-bold text-slate-500 tracking-wider font-mono uppercase">
            Universal ingestion gateway • Powered by Gemini Multimodal Vision
          </p>
        </div>
      </div>

      {/* Primary Ingestion Layer Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Left 2 Cols: Capture Forms */}
        <div className="md:col-span-2 space-y-6">
          {/* Drag & Drop zone */}
          <div 
            ref={dropRef}
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-3xl p-8 text-center transition relative overflow-hidden flex flex-col items-center justify-center min-h-[220px] select-none ${
              dragActive 
                ? "border-indigo-500 bg-indigo-500/5 shadow-[0_0_40px_rgba(99,102,241,0.1)]" 
                : "border-slate-800 bg-[#0b0820]/40 hover:border-slate-700/80"
            }`}
          >
            <UploadCloud className={`h-12 w-12 mb-4 transition-transform duration-300 ${dragActive ? "scale-110 text-indigo-400" : "text-slate-500"}`} />
            <h4 className="text-sm font-bold text-slate-200">
              Drag & Drop files here or Paste screenshot
            </h4>
            <p className="text-[10px] text-slate-500 font-semibold mt-2 uppercase tracking-wide">
              Supports Images (.png, .jpg) & Documents (.pdf) • Ctrl+V works anywhere
            </p>

            <input 
              type="file" 
              id="file-upload" 
              className="hidden" 
              accept="image/*,application/pdf"
              onChange={async (e) => {
                if (e.target.files && e.target.files[0]) {
                  await processFile(e.target.files[0]);
                }
              }}
            />
            <label 
              htmlFor="file-upload"
              className="mt-5 px-4 py-2 text-[10px] font-bold uppercase tracking-wider bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl transition cursor-pointer"
            >
              Browse Files
            </label>
          </div>

          {/* Web Scraping & Text block Capture cards */}
          <div className="grid gap-5 sm:grid-cols-2">
            {/* Scraping Card */}
            <div className="bg-[#0b0820]/40 border border-slate-800/80 rounded-3xl p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-indigo-400 mb-3">
                  <LinkIcon className="h-4.5 w-4.5" />
                  <span className="text-[10px] font-black uppercase tracking-wider font-mono">Web Scraping</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed mb-4">
                  Paste any event, assignment portal, or job link (e.g. Devpost). Gemini will fetch the page and build your task.
                </p>
              </div>
              <form onSubmit={handleUrlSubmit} className="flex gap-2">
                <input 
                  type="url"
                  placeholder="https://example.com/syllabus..."
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs outline-none text-slate-100 placeholder-slate-600 transition"
                  disabled={isProcessing}
                />
                <button 
                  type="submit"
                  className="px-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl transition cursor-pointer flex items-center justify-center shrink-0"
                  disabled={isProcessing}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </form>
            </div>

            {/* Raw Text Card */}
            <div className="bg-[#0b0820]/40 border border-slate-800/80 rounded-3xl p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-indigo-400 mb-3">
                  <FileText className="h-4.5 w-4.5" />
                  <span className="text-[10px] font-black uppercase tracking-wider font-mono">Raw Text Block</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed mb-4">
                  Dump syllabus text, email snippets, or random notes. Gemini will extract structure instantly.
                </p>
              </div>
              <form onSubmit={handleTextSubmit} className="flex gap-2">
                <input 
                  type="text"
                  placeholder="e.g. History midterm is Friday Oct 2..."
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs outline-none text-slate-100 placeholder-slate-600 transition"
                  disabled={isProcessing}
                />
                <button 
                  type="submit"
                  className="px-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl transition cursor-pointer flex items-center justify-center shrink-0"
                  disabled={isProcessing}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Right Column: Draggable Bookmarklet */}
        <div className="space-y-6">
          <div className="bg-[#0b0820]/40 border border-slate-800/80 rounded-3xl p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden h-full min-h-[300px]">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />

            <div>
              <div className="flex items-center gap-2 text-indigo-400 mb-3">
                <Bookmark className="h-4.5 w-4.5" />
                <span className="text-[10px] font-black uppercase tracking-wider font-mono">Bookmarklet</span>
              </div>
              <h3 className="text-sm font-bold text-slate-200 mb-2">
                One-Click Bookmarklet Capture
              </h3>
              <p className="text-[11px] text-slate-400 leading-relaxed mb-6">
                Drag the button below into your bookmarks bar. While browsing any website (like Devpost or LinkedIn), click it to send the page title, URL, and selection to DeadlineIQ automatically!
              </p>
            </div>

            <div className="space-y-4">
              {/* Draggable Button */}
              <a 
                ref={dragLinkRef}
                href="#"
                className="w-full py-4 text-center rounded-xl bg-gradient-to-r from-indigo-500 to-purple-650 hover:scale-[1.02] active:scale-[0.98] transition text-white font-bold text-xs tracking-wider uppercase shadow-xl shadow-indigo-500/15 cursor-grab block border border-indigo-400/20"
                title="Drag me to your Bookmarks Bar!"
              >
                📥 Save to DeadlineIQ
              </a>
              <div className="text-[9px] text-center text-slate-550 font-bold uppercase tracking-wider">
                ▲ DRAG THIS BUTTON TO YOUR BOOKMARKS BAR
              </div>

              {/* Manual Copy Button */}
              <button
                onClick={() => {
                  navigator.clipboard.writeText(bookmarkletCode);
                  addToast("Bookmarklet code copied to clipboard! Paste it into your bookmark's URL.", { type: "success" });
                }}
                className="w-full py-2.5 text-center rounded-xl bg-slate-900/50 border border-slate-850 hover:bg-slate-850 transition text-slate-350 font-bold text-[10px] tracking-wider uppercase cursor-pointer"
              >
                Copy Code (for manual bookmark)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Global Status/Processing Overlay Card */}
      {isProcessing && (
        <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-2xl p-5 flex items-center gap-4 animate-pulse">
          <Loader2 className="h-5 w-5 text-indigo-400 animate-spin" />
          <div>
            <div className="text-xs font-bold text-indigo-300">Universal AI Processing Layer active...</div>
            <p className="text-[10px] text-slate-400 mt-1 font-mono">{statusText}</p>
          </div>
        </div>
      )}

      {/* Recently Created Task Display */}
      {recentTask && (
        <div className="bg-emerald-950/15 border border-emerald-500/20 rounded-3xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
            <h4 className="text-xs font-black uppercase tracking-wider font-mono">Structured task created successfully</h4>
          </div>
          
          <div className="grid gap-4 sm:grid-cols-3 bg-black/20 p-4 rounded-2xl border border-white/5">
            <div className="sm:col-span-2">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Title</div>
              <div className="text-sm font-bold text-slate-200 mt-1">{recentTask.title}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                {recentTask.taskKind === "event" ? "Meeting Time" : "Deadline"}
              </div>
              <div className="text-xs font-semibold text-slate-350 mt-1">
                {recentTask.taskKind === "event"
                  ? recentTask.eventStart
                    ? `Meeting at ${new Date(recentTask.eventStart).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · Reminder ${recentTask.reminderAt ? new Date(recentTask.reminderAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}`
                    : "Event captured – set event time above"
                  : recentTask.deadline
                    ? (recentTask.deadline instanceof Date ? recentTask.deadline : new Date(recentTask.deadline)).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                    : "No deadline found"
                }
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Effort / Priority</div>
              <div className="text-xs font-semibold text-indigo-300 mt-1 capitalize">
                {recentTask.estimatedHours} hours • {recentTask.priority} priority
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Category</div>
              <div className="text-xs font-semibold text-purple-300 mt-1">{recentTask.type}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Subtasks created</div>
              <div className="text-xs font-semibold text-slate-300 mt-1">
                {recentTask.subtasks?.length || 0} subtasks
              </div>
            </div>
          </div>
          {sourceUrl && (
            <div className="pt-2 text-right">
              <a 
                href={sourceUrl}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-650 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider transition shadow-lg shadow-indigo-500/10 cursor-pointer"
              >
                ← Return to Scraped Page
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
