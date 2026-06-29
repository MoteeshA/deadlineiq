let webLlmEngine = null;
const GROQ_CHAT_MODEL = "llama-3.3-70b-versatile";
const GROQ_FAST_MODEL = "llama-3.1-8b-instant";
const GEMINI_MODEL = "gemini-2.5-flash";

export function getConfiguredGroqApiKey() {
  return localStorage.getItem("deadlineiq_groq_api_key") || import.meta.env.VITE_GROQ_API_KEY || "";
}

export function getConfiguredGeminiApiKey() {
  return localStorage.getItem("deadlineiq_gemini_api_key") || import.meta.env.VITE_GEMINI_API_KEY || "";
}

export function hasConfiguredCloudAiKey() {
  return !!(getConfiguredGroqApiKey() || getConfiguredGeminiApiKey());
}

/**
 * Helper to race a promise against a timeout.
 */
function withTimeout(promise, ms, errorMessage = "Timeout exceeded") {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(errorMessage)), ms))
  ]);
}

function toIsoOrNull(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function resolveTimeOnlyReference(userInput) {
  const normalized = userInput.toLowerCase();
  const timeMatch = normalized.match(/\b(?:at\s*)?(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b/);
  if (!timeMatch) return null;

  let hours = parseInt(timeMatch[1], 10);
  const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
  const meridiem = timeMatch[3].replace(/\./g, "");
  if (meridiem === "pm" && hours !== 12) hours += 12;
  if (meridiem === "am" && hours === 12) hours = 0;

  const date = new Date();
  date.setHours(hours, minutes, 0, 0);

  if (normalized.includes("tomorrow")) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    date.setFullYear(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
  } else if (!normalized.includes("today") && date.getTime() <= Date.now()) {
    date.setDate(date.getDate() + 1);
  }

  return date;
}

function classifyCaptureIntent(userInput, parsed) {
  // Trust the LLM's own classification if it returned one
  if (parsed?.taskKind === "event" || parsed?.taskKind === "task") return parsed.taskKind;
  
  const text = `${userInput} ${parsed?.title || ""} ${parsed?.type || ""}`.toLowerCase();
  // Hackathon/competition registration pages have deadlines but are tasks, not events
  const hackathonWords = /\b(hackathon|competition|contest|challenge|apply|register|submit|submission|prize|eligib)\b/;
  const eventWords = /\b(meeting|meet|call|appointment|interview|webinar|session|class|lecture|standup|sync|demo)\b/;
  const deadlineWords = /\b(deadline|due|apply by|register by|registration closes|last date|finish|complete|deliver|turn in)\b/;

  // Hackathon pages are tasks (with a registration deadline), not events
  if (hackathonWords.test(text)) return "task";
  // Something with a deadline keyword is a task
  if (deadlineWords.test(text)) return "task";
  // Pure live event (meeting, call, etc.) is an event
  if (eventWords.test(text)) return "event";
  return "task";
}

function normalizeCapturedTask(userInput, parsed) {
  const intent = classifyCaptureIntent(userInput, parsed);

  if (intent === "event") {
    // For events (meetings, calls, etc.) — use eventStart from LLM or resolve from text
    const rawEventStart = parsed.eventStart || parsed.startTime || null;
    const resolvedTime = resolveTimeOnlyReference(userInput);
    const eventStart = toIsoOrNull(rawEventStart || resolvedTime);
    const reminderAt = eventStart
      ? toIsoOrNull(new Date(new Date(eventStart).getTime() - 30 * 60 * 1000))
      : null;

    return {
      ...parsed,
      deadline: null,          // events don't have a work deadline
      eventStart,
      reminderAt,
      taskKind: "event",
      type: parsed.type || "Event",
      estimatedHours: parsed.estimatedHours || 0.5,
      subtasks: parsed.subtasks?.length ? parsed.subtasks : [],
      registrationLink: parsed.registrationLink || null
    };
  }

  // For regular tasks and hackathons — preserve deadline and registrationLink
  const deadline = parsed.deadline
    ? toIsoOrNull(parsed.deadline)
    : (() => {
        // Default: tomorrow at 5 PM if no deadline was extracted
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(17, 0, 0, 0);
        return tomorrow.toISOString();
      })();

  return {
    ...parsed,
    deadline,
    eventStart: null,
    reminderAt: null,
    taskKind: "task",
    registrationLink: parsed.registrationLink || null
  };
}

/**
 * Checks if the WebLLM engine has been successfully preloaded.
 */
export function isWebLlmPreloaded() {
  return webLlmEngine !== null;
}

/**
 * Manually triggers downloading and caching of the in-browser model.
 */
export async function preloadWebLlm(onProgress) {
  if (webLlmEngine) {
    if (onProgress) onProgress("Ready");
    return;
  }

  if (!navigator.gpu) {
    throw new Error("WebGPU is not supported by your browser.");
  }

  const webLLM = await import("@mlc-ai/web-llm");
  
  webLlmEngine = await webLLM.CreateMLCEngine("Qwen2-0.5B-Instruct-q4f16_1-MLC", {
    initProgressCallback: (report) => {
      if (onProgress) {
        const progress = report.text.replace(/\[\d+\/\d+\]\s*/g, "");
        onProgress(`Loading: ${progress}`);
      }
    }
  });

  if (onProgress) onProgress("Ready");
}

/**
 * Loads and queries WebLLM model directly inside the browser using WebGPU (100% self-contained).
 */
/**
 * Loads and queries WebLLM model directly inside the browser using WebGPU (100% self-contained).
 */
async function queryInBrowserLLM(userInput, currentLocalTime, onProgress) {
  if (!navigator.gpu) {
    throw new Error("WebGPU is not supported by your browser. Please use Chrome or Safari 17.4+.");
  }

  const webLLM = await import("@mlc-ai/web-llm");
  
  if (!webLlmEngine) {
    if (onProgress) onProgress("Initializing local in-browser LLM (Qwen2-0.5B: ~350MB)...");
    webLlmEngine = await webLLM.CreateMLCEngine("Qwen2-0.5B-Instruct-q4f16_1-MLC", {
      initProgressCallback: (report) => {
        if (onProgress) {
          // Clean up progress text
          const progress = report.text.replace(/\[\d+\/\d+\]\s*/g, "");
          onProgress(`Loading local AI: ${progress}`);
        }
      }
    });
  }

  if (onProgress) onProgress("Local AI is thinking (using WebGPU)...");
  
  const simplifiedPrompt = `
You are the AI task extractor of DeadlineIQ.
Analyze this user task description: "${userInput}"

Reference Local Date/Time: ${currentLocalTime} (Current Year is 2026).

Return a JSON object with these exact keys:
- "title": Concise task name (string)
- "deadline": ISO 8601 DateTime string (or null if none)
- "estimatedHours": Total estimated hours (number)
- "priority": "low" or "medium" or "high" (string)
- "type": Category category (string)
- "subtasks": Array of 3-5 subtask objects, each with "title" (string) and "durationHours" (number)
- "registrationLink": Direct registration URL in text (string or null)
- "prizes": Prize description if any (string or null)
- "eligibility": Eligibility criteria if any (string or null)
- "location": Physical location or "Online" (string or null)

Format the response as a single valid JSON object. Do not include extra conversational text.
`;

  const response = await webLlmEngine.chat.completions.create({
    messages: [
      { role: "user", content: simplifiedPrompt }
    ]
  });

  const content = response.choices[0].message.content;
  const jsonStart = content.indexOf("{");
  const jsonEnd = content.lastIndexOf("}");
  if (jsonStart !== -1 && jsonEnd !== -1) {
    try {
      const rawParsed = JSON.parse(content.substring(jsonStart, jsonEnd + 1));
      
      // Fuzzy key aliases to handle Qwen-2-0.5B variance
      const title = rawParsed.title || rawParsed.task || rawParsed.task_name || rawParsed.name || rawParsed.opportunity || "Captured Task";
      const deadline = rawParsed.deadline || rawParsed.due || rawParsed.date || rawParsed.time || null;
      const estimatedHours = parseFloat(rawParsed.estimatedHours || rawParsed.duration || rawParsed.hours || rawParsed.effort) || 2;
      const priority = rawParsed.priority || rawParsed.importance || "medium";
      const type = rawParsed.type || rawParsed.category || "General";
      
      const subtasksRaw = rawParsed.subtasks || rawParsed.steps || rawParsed.checklist || [];
      let subtasks = Array.isArray(subtasksRaw) ? subtasksRaw.map(s => {
        if (typeof s === "string") {
          return { title: s, durationHours: Math.max(0.5, Math.round((estimatedHours / Math.max(1, subtasksRaw.length)) * 10) / 10) };
        }
        return {
          title: s.title || s.step || s.name || "Subtask step",
          durationHours: parseFloat(s.durationHours || s.hours || s.duration) || 0.5
        };
      }) : [];

      // If the tiny local model returned 0 subtasks, auto-generate a gorgeous 3-step plan
      if (subtasks.length === 0) {
        subtasks = [
          { title: `Prepare & organize: ${title}`, durationHours: Math.max(0.5, Math.round(estimatedHours * 0.3 * 10) / 10) },
          { title: `Execute core actions: ${title}`, durationHours: Math.max(0.5, Math.round(estimatedHours * 0.5 * 10) / 10) },
          { title: `Final review & polish: ${title}`, durationHours: Math.max(0.5, Math.round(estimatedHours * 0.2 * 10) / 10) }
        ];
      }

      return {
        title,
        deadline,
        estimatedHours,
        priority,
        type,
        isVague: false,
        clarifyingQuestion: "",
        confidence: 0.85,
        subtasks,
        registrationLink: rawParsed.registrationLink || rawParsed.url || rawParsed.link || null,
        prizes: rawParsed.prizes || rawParsed.prize || rawParsed.rewards || null,
        eligibility: rawParsed.eligibility || rawParsed.eligible || null,
        location: rawParsed.location || rawParsed.place || null
      };
    } catch (parseErr) {
      console.warn("Local JSON parse failed, falling back to deterministic: ", parseErr);
    }
  }
  throw new Error("In-browser model output did not contain structured JSON");
}

/**
 * Queries local offline LLM (Ollama or Chrome Built-in Gemini Nano) for task parsing.
 */
async function queryLocalOfflineLLM(promptText) {
  // 1. Try local Ollama endpoint (OpenAI compatible completions endpoint)
  try {
    const response = await fetch("http://localhost:11434/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemma2",
        messages: [{ role: "user", content: promptText }],
        response_format: { type: "json_object" }
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      const text = data.choices?.[0]?.message?.content;
      return JSON.parse(text);
    }
  } catch (ollamaErr) {
    console.warn("Ollama is not running locally for offline tasks:", ollamaErr.message);
  }

  // 2. Try Chrome Built-in Gemini Nano (window.ai)
  try {
    if (window.ai && window.ai.assistant) {
      const session = await window.ai.assistant.create();
      const rawResponse = await session.prompt(promptText);
      const jsonStart = rawResponse.indexOf("{");
      const jsonEnd = rawResponse.lastIndexOf("}");
      if (jsonStart !== -1 && jsonEnd !== -1) {
        const jsonStr = rawResponse.substring(jsonStart, jsonEnd + 1);
        return JSON.parse(jsonStr);
      }
    }
  } catch (chromeAiErr) {
    console.warn("Chrome Built-in AI is not available for offline tasks:", chromeAiErr.message);
  }

  throw new Error("No local offline LLM active");
}

export async function callGroqJson({ promptText, apiKey, model = GROQ_CHAT_MODEL, systemText = "You are DeadlineIQ's structured JSON engine." }) {
  const response = await fetch("https://corsproxy.io/?https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemText },
        { role: "user", content: promptText }
      ],
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const errMsg = errData?.error?.message || `HTTP ${response.status}`;
    throw new Error(`Groq API Error: ${errMsg}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  if (!content) throw new Error("Empty response from Groq.");
  const jsonStart = content.indexOf("{");
  const jsonEnd = content.lastIndexOf("}");
  if (jsonStart !== -1 && jsonEnd !== -1) {
    const jsonStr = content.substring(jsonStart, jsonEnd + 1);
    return JSON.parse(jsonStr);
  }
  throw new Error("Could not find valid JSON in Groq response");
}

async function callGeminiJson({ promptText, apiKey, responseSchema }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: promptText }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema,
      },
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const errMsg = errData?.error?.message || `HTTP ${response.status}`;
    throw new Error(`Gemini API Call Failed: ${errMsg}`);
  }

  const result = await response.json();
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty response from Gemini.");
  return JSON.parse(text);
}

/**
 * Queries local offline LLM for conversational chatbot replies.
 */
async function chatWithLocalOfflineLLM(promptText) {
  // Extract user message from structured promptText if possible
  const userMessageMatch = promptText.match(/User Message:\s*"([^"]+)"/is);
  const userMessage = userMessageMatch ? userMessageMatch[1].trim() : promptText;
  
  const simplifiedPrompt = `You are the AI Productivity Agent of DeadlineIQ. Chat with the user and reply to their message: "${userMessage}"`;

  // 1. Try local WebLLM first!
  try {
    if (navigator.gpu && webLlmEngine) {
      const chatPromise = webLlmEngine.chat.completions.create({
        messages: [{ role: "user", content: simplifiedPrompt }]
      }).then(response => {
        const content = response.choices[0].message.content;
        return {
          reply: content || "I'm here to help!",
          action: { type: "NONE", payload: {} }
        };
      });

      return await withTimeout(chatPromise, 6000, "In-browser GPU chat timeout");
    }
  } catch (webLlmErr) {
    console.warn("In-browser WebLLM failed for chat:", webLlmErr.message);
  }

  // 2. Try Ollama local completions
  try {
    const response = await fetch("http://localhost:11434/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemma2",
        messages: [{ role: "user", content: simplifiedPrompt }]
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      return {
        reply: content || "I'm here to help!",
        action: { type: "NONE", payload: {} }
      };
    }
  } catch (ollamaErr) {
    console.warn("Ollama chat fallback failed:", ollamaErr.message);
  }

  // 3. Try Chrome Built-in Gemini Nano
  try {
    if (window.ai && window.ai.assistant) {
      const session = await window.ai.assistant.create();
      const content = await session.prompt(simplifiedPrompt);
      return {
        reply: content || "Let's plan your tasks!",
        action: { type: "NONE", payload: {} }
      };
    }
  } catch (chromeAiErr) {
    console.warn("Chrome AI chat fallback failed:", chromeAiErr.message);
  }

  throw new Error("No local offline LLM available for chat");
}

/**
 * Queries Groq Cloud API for task parsing (super-fast, free, unlimited).
 */
async function queryGroqCloudLLM(userInput, currentLocalTime, apiKey) {
  const url = "https://corsproxy.io/?https://api.groq.com/openai/v1/chat/completions";
  
  const simplifiedPrompt = `
You are the AI task extractor of DeadlineIQ.
Analyze this user task description: "${userInput}"

Reference Local Date/Time: ${currentLocalTime} (Current Year is 2026).

Return a JSON object with these exact keys:
- "title": Concise task name (string)
- "deadline": ISO 8601 DateTime string (or null if none)
- "estimatedHours": Total estimated hours (number)
- "priority": "low" or "medium" or "high" (string)
- "type": Category category (string)
- "subtasks": Array of 3-5 subtask objects, each with "title" (string) and "durationHours" (number)
- "registrationLink": Direct registration URL in text (string or null)
- "prizes": Prize description if any (string or null)
- "eligibility": Eligibility criteria if any (string or null)
- "location": Physical location or "Online" (string or null)

Format the response as a single valid JSON object. Do not include extra conversational text.
`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: GROQ_CHAT_MODEL,
      messages: [{ role: "user", content: simplifiedPrompt }],
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    throw new Error(`Groq API Error: HTTP ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content || "";
  const jsonStart = content.indexOf("{");
  const jsonEnd = content.lastIndexOf("}");
  if (jsonStart !== -1 && jsonEnd !== -1) {
    const jsonStr = content.substring(jsonStart, jsonEnd + 1);
    return JSON.parse(jsonStr);
  }
  throw new Error("Could not find valid JSON in Groq response");
}

/**
 * Queries Groq Cloud API for conversational chatbot replies.
 */
async function chatWithGroqCloudLLM(message, history, currentTasks, profile, apiKey) {
  const url = "https://corsproxy.io/?https://api.groq.com/openai/v1/chat/completions";
  
  const activeTasks = currentTasks.map(t => ({
    id: t.id,
    title: t.title,
    priority: t.priority,
    status: t.status,
    deadline: t.deadline
  }));

  const promptText = `
You are the AI Productivity Agent of DeadlineIQ.
Your role is to act as an empathetic coach, counselor, and coordinator. You help users schedule, manage task overload, and defeat procrastination.

Current Active Tasks:
${JSON.stringify(activeTasks)}

User Behavioral Forensics:
- Primary Procrastination Style: ${profile.primaryPattern}
- Explanatory Fingerprint: "${profile.explanation}"

Your capabilities:
1. Talk to the user empathetically. Suggest actionable, tiny next steps.
2. Coordinate and execute task operations. If the user asks you to add, snooze, or complete a task, say you will do it, and return the appropriate action metadata in the JSON response.

Actions Supported:
- ADD_TASK: to create a new task. Payload needs: { title: "Concise name", priority: "low|medium|high", estimatedHours: number }
- DEFER_TASK: to snooze/reschedule a task. Payload needs: { taskId: "id of task", newDeadline: "ISO DateTime String" } (Use year 2026. Current year is 2026).
- COMPLETE_TASK: to mark a task as completed. Payload needs: { taskId: "id of task" }
- NONE: default when no task creation/update is requested.

Return a JSON matching the schema.
`;

  const messages = [
    { role: "system", content: promptText },
    ...history.map(h => ({
      role: h.role === "user" ? "user" : "assistant",
      content: h.text
    })),
    { role: "user", content: message }
  ];

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: GROQ_CHAT_MODEL,
      messages,
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    throw new Error(`Groq API Error: HTTP ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content || "";
  const jsonStart = content.indexOf("{");
  const jsonEnd = content.lastIndexOf("}");
  if (jsonStart !== -1 && jsonEnd !== -1) {
    const jsonStr = content.substring(jsonStart, jsonEnd + 1);
    return JSON.parse(jsonStr);
  }
  throw new Error("Could not find valid JSON in Groq response");
}

export async function parseTaskWithGemini(userInput, onProgress) {
  // 1. Get API Key (Settings storage or fallback to Env)
  const apiKey = getConfiguredGeminiApiKey();
  const groqApiKey = getConfiguredGroqApiKey();
  
  // Format current time context explicitly in readable English to avoid DD/MM vs MM/DD LLM confusions
  const now = new Date();
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true };
  const currentLocalTime = now.toLocaleDateString('en-US', options);

  const promptText = `
You are the intelligence engine of DeadlineIQ, an anti-procrastination task manager.
Your job is to parse a natural language task description, extract core metadata, determine if it is vague, and break it down into actionable subtasks.

User's Task Description: "${userInput}"

Current Time Context:
- Current Local Date/Time: ${currentLocalTime} (use this as the reference point to resolve relative deadlines like 'tomorrow', 'Friday at 5pm', 'next week')
- Current Year is 2026.

Schema Guidelines:
1. Title: Extracted clean, concise name of the task.

2. TaskKind: CRITICAL — Classify the input as either:
   - "event": A live event that happens at a specific time that the user must ATTEND (meetings, calls, appointments, interviews, webinars, lectures, standups). For events, return the event time in EventStart and set Deadline to null.
   - "task": Everything else — work to complete, things to submit, hackathon registrations, assignments, projects, personal tasks, etc. For tasks, set EventStart to null and return a work Deadline.
   Rule: A hackathon/competition page is a TASK (with a registration deadline), NOT an event — even if it mentions a date.

3. EventStart: If TaskKind is "event", return the ISO 8601 DateTime of when the event/meeting starts. Use Time-only Resolution below. Set to null for tasks.

4. Deadline: ISO 8601 DateTime string.
   - If TaskKind is "event": Set to null (the app auto-schedules a reminder 30 min before EventStart).
   - If TaskKind is "task": This is the work deadline — when the task/submission/registration must be done by.
   - Time-only Resolution: If a specific time (e.g., '10 AM') is mentioned without a day, compare it to current local time:
     - If that time has already passed today → deadline is TOMORROW at that time.
     - If that time is still ahead today → deadline is TODAY at that time.
   - Default: If no deadline can be inferred for a task, set to TOMORROW at 5:00 PM. Never return null for tasks.

5. EstimatedHours: Total hours required. Estimate reasonably (0.5–10h).
6. Priority: low, medium, or high.
7. Type: Category — "Meeting", "Writing", "Programming", "Admin", "Learning", "Hackathon", "Event", etc.
8. IsVague: true if extremely ambiguous. If true, put a clarifying question in ClarifyingQuestion and leave subtasks empty.
9. ClarifyingQuestion: Single actionable question if isVague is true. Else "".
10. Subtasks: 3–6 actionable subtasks, each with 'title' and 'durationHours'. Empty if isVague or if TaskKind is event.
11. Confidence: decimal 0.0–1.0.
12. RegistrationLink: Extract the direct registration/apply URL if the page/text is about a hackathon, contest, webinar, or job application. Set to null if none.
13. Prizes: Hackathon/competition prize details. Set to null if none.
14. Eligibility: Participant eligibility requirements. Set to null if none.
15. Location: Event location ("Online", "Hybrid", city). Set to null if none.

Return the JSON matching the required schema.
`;

  if (groqApiKey) {
    console.info("Routing task parse to primary Groq Cloud API...");
    try {
      if (onProgress) onProgress("Parsing task with Groq Cloud...");
      const rawParsed = await queryGroqCloudLLM(userInput, currentLocalTime, groqApiKey);
      
      const title = rawParsed.title || rawParsed.task || rawParsed.task_name || rawParsed.name || "Captured Task";
      const deadline = rawParsed.deadline || null;
      const estimatedHours = parseFloat(rawParsed.estimatedHours || rawParsed.duration || 2.0) || 2.0;
      const priority = rawParsed.priority || "medium";
      const type = rawParsed.type || "General";
      const subtasksRaw = rawParsed.subtasks || rawParsed.steps || rawParsed.checklist || [];
      let subtasks = Array.isArray(subtasksRaw) ? subtasksRaw.map(s => {
        if (typeof s === "string") {
          return { title: s, durationHours: Math.max(0.5, Math.round((estimatedHours / Math.max(1, subtasksRaw.length)) * 10) / 10) };
        }
        return {
          title: s.title || s.step || s.name || "Subtask step",
          durationHours: parseFloat(s.durationHours || s.hours || s.duration) || 0.5
        };
      }) : [];
      
      if (subtasks.length === 0) {
        subtasks = [
          { title: `Prepare & organize: ${title}`, durationHours: Math.max(0.5, Math.round(estimatedHours * 0.3 * 10) / 10) },
          { title: `Execute core actions: ${title}`, durationHours: Math.max(0.5, Math.round(estimatedHours * 0.5 * 10) / 10) },
          { title: `Final review & polish: ${title}`, durationHours: Math.max(0.5, Math.round(estimatedHours * 0.2 * 10) / 10) }
        ];
      }

      return normalizeCapturedTask(userInput, {
        title,
        deadline,
        estimatedHours,
        priority,
        type,
        isVague: !!rawParsed.isVague,
        clarifyingQuestion: rawParsed.clarifyingQuestion || "",
        confidence: 0.95,
        subtasks,
        taskKind: rawParsed.taskKind || rawParsed.task_kind || null,
        eventStart: rawParsed.eventStart || rawParsed.event_start || rawParsed.startTime || null,
        registrationLink: rawParsed.registrationLink || rawParsed.registration_link || rawParsed.url || rawParsed.link || null,
        prizes: rawParsed.prizes || rawParsed.prize || rawParsed.rewards || null,
        eligibility: rawParsed.eligibility || rawParsed.eligible || null,
        location: rawParsed.location || rawParsed.place || null
      });
    } catch (groqErr) {
      console.warn("Groq cloud parser failed, falling back:", groqErr.message);
    }
  }

  if (!apiKey) {

    const offlinePreference = localStorage.getItem("deadlineiq_offline_mode_preference") || "webgpu";
    if (offlinePreference === "heuristics") {
      console.info("Using fast local deterministic parser per user preference.");
      return normalizeCapturedTask(userInput, parseTaskLocally(userInput, "User preference: Fast Heuristics"));
    }

    console.warn("Gemini API key is missing. Trying local offline LLM...");
    try {
      // 1. Try local WebLLM directly inside browser (WebGPU accelerated)
      if (navigator.gpu) {
        const parsed = await withTimeout(
          queryInBrowserLLM(userInput, currentLocalTime, onProgress),
          7000,
          "In-browser GPU model compilation timeout"
        );
        return normalizeCapturedTask(userInput, parsed);
      }
    } catch (webLlmErr) {
      console.warn("In-browser WebLLM failed, trying fallback LLMs:", webLlmErr.message);
    }

    try {
      // 2. Try local Ollama endpoint next
      return normalizeCapturedTask(userInput, await queryLocalOfflineLLM(promptText));
    } catch {
      console.warn("No local offline LLM active. Using local deterministic parser fallback.");
      return normalizeCapturedTask(userInput, parseTaskLocally(userInput, "API Key missing in Settings; Local LLMs failed"));
    }
  }

  // Updated to use the gemini-2.5-flash model on v1beta endpoint
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: promptText,
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              title: { type: "STRING" },
              taskKind: { type: "STRING", enum: ["task", "event"], description: "Classify as 'event' if user must attend at a specific time (meeting, call, webinar), else 'task'" },
              eventStart: { type: "STRING", description: "ISO 8601 datetime when the event starts. Only for events, null for tasks." },
              deadline: { 
                type: "STRING", 
                description: "ISO 8601 task deadline (when work must be done). For events set to null. For tasks never return null - default to tomorrow at 5PM if unknown." 
              },
              estimatedHours: { type: "NUMBER", description: "Total estimated hours to complete the task" },
              priority: { type: "STRING", enum: ["low", "medium", "high"] },
              type: { type: "STRING", description: "Category: Meeting, Writing, Programming, Admin, Learning, Hackathon, Event, etc." },
              isVague: { type: "BOOLEAN", description: "True if the task is too vague to act on (e.g. 'do homework' or 'study')" },
              clarifyingQuestion: { type: "STRING", description: "Single simple question if task is vague, else empty string" },
              confidence: { type: "NUMBER", description: "Confidence of extraction, between 0.0 and 1.0" },
              registrationLink: { type: "STRING", description: "Direct registration/apply URL for hackathons, contests, webinars. Null if none." },
              prizes: { type: "STRING", description: "Hackathon/competition prize details, or null" },
              eligibility: { type: "STRING", description: "Participant eligibility requirements, or null" },
              location: { type: "STRING", description: "Event location (Online, Hybrid, city), or null" },
              subtasks: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    title: { type: "STRING" },
                    durationHours: { type: "NUMBER", description: "Estimate for this subtask in hours" },
                  },
                  required: ["title", "durationHours"],
                },
              },
            },
            required: ["title", "taskKind", "estimatedHours", "priority", "type", "isVague", "confidence", "subtasks"],
          },
        },
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const errMsg = errData?.error?.message || `HTTP ${response.status} Error`;
      throw new Error(`Gemini API Call Failed: ${errMsg}`);
    }

    const result = await response.json();
    const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textResponse) {
      throw new Error("Received empty response from Gemini API.");
    }

    return normalizeCapturedTask(userInput, JSON.parse(textResponse));
  } catch (err) {
    console.warn("Gemini API call failed. Falling back to local deterministic parser:", err.message);
    return normalizeCapturedTask(userInput, parseTaskLocally(userInput, err.message));
  }
}

function parseTaskLocally(userInput, errorMsg) {
  const normalized = userInput.toLowerCase();
  let title = "";
  
  // Clean title extraction for Bookmarklet/Multimodal inputs
  if (userInput.includes("Page Title:")) {
    const titleMatch = userInput.match(/Page Title:\s*([^\n\r]+?)(?=\s*(Content Summary:|$))/i);
    if (titleMatch && titleMatch[1].trim()) {
      title = titleMatch[1].trim();
    }
  }
  
  if (!title && userInput.includes("Source URL:")) {
    const urlMatch = userInput.match(/Source URL:\s*([^\s]+)/i);
    if (urlMatch) {
      try {
        const hostname = new URL(urlMatch[1]).hostname;
        title = `Scraped Opportunity from ${hostname}`;
      } catch {
        title = "Scraped Opportunity";
      }
    }
  }

  // Fallback for general long descriptions
  if (!title) {
    if (userInput.length > 100) {
      const firstLine = userInput.split(/[\n\r.]/)[0].trim();
      title = firstLine.length > 80 ? firstLine.substring(0, 77) + "..." : firstLine || "Captured Opportunity";
    } else {
      title = userInput.replace(/\b(by|at|takes|priority|urgent|hours|h|hrs|high|low|medium)\b.*/gi, "").trim() || userInput;
    }
  }

  // 1. Is Vague check
  let isVague = false;
  let clarifyingQuestion = "";
  const vagueKeywords = ["study", "work", "do stuff", "something", "homework", "task"];
  if (vagueKeywords.some(w => normalized.trim() === w)) {
    isVague = true;
    clarifyingQuestion = `What specific topic or action items are involved in "${userInput.substring(0, 30)}..."?`;
  }

  // 2. Priority check
  let priority = "medium";
  if (normalized.includes("urgent") || normalized.includes("high") || normalized.includes("asap") || normalized.includes("important")) {
    priority = "high";
  } else if (normalized.includes("low") || normalized.includes("easy") || normalized.includes("later")) {
    priority = "low";
  }

  // 3. Estimated Hours check
  let estimatedHours = 2; // Default
  const hourMatch = normalized.match(/(\d+(\.\d+)?)\s*(h|hr|hour)/);
  if (hourMatch) {
    estimatedHours = parseFloat(hourMatch[1]);
  } else {
    // Guess based on complexity keywords
    if (normalized.includes("complex") || normalized.includes("project") || normalized.includes("long")) {
      estimatedHours = 6;
    } else if (normalized.includes("quick") || normalized.includes("email") || normalized.includes("check")) {
      estimatedHours = 0.5;
    }
  }

  // 4. Category Type check
  let type = "General";
  if (normalized.includes("write") || normalized.includes("report") || normalized.includes("essay") || normalized.includes("deck")) {
    type = "Writing";
  } else if (normalized.includes("code") || normalized.includes("program") || normalized.includes("develop") || normalized.includes("bug") || normalized.includes("fix")) {
    type = "Programming";
  } else if (normalized.includes("read") || normalized.includes("learn") || normalized.includes("study") || normalized.includes("watch")) {
    type = "Learning";
  } else if (normalized.includes("email") || normalized.includes("schedule") || normalized.includes("admin") || normalized.includes("meeting")) {
    type = "Admin";
  }

  // 5. Deadline parser — extended
  let deadline;
  const dayNames = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];

  const getNextWeekday = (targetDay) => {
    const d = new Date();
    const current = d.getDay();
    const diff = (targetDay - current + 7) % 7 || 7;
    d.setDate(d.getDate() + diff);
    d.setHours(17, 0, 0, 0);
    return d.toISOString();
  };

  // "in X days"
  const inDaysMatch = normalized.match(/in\s+(\d+)\s+days?/);
  // "X days from now"
  const daysFromNowMatch = normalized.match(/(\d+)\s+days?\s+from\s+now/);
  // "next week"
  const nextWeekMatch = normalized.includes("next week");
  // "end of week" or "this week"
  const endOfWeekMatch = normalized.includes("end of week") || normalized.includes("this week");
  // specific date like "june 30", "july 5", "30th june"
  const monthNames = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
  const monthMatch = normalized.match(/(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)|(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?/);
  const explicitTime = resolveTimeOnlyReference(userInput);
  const hasNamedWeekday = dayNames.some(day => normalized.includes(day));

  if (explicitTime && !monthMatch && !inDaysMatch && !daysFromNowMatch && !nextWeekMatch && !endOfWeekMatch && !hasNamedWeekday) {
    deadline = explicitTime.toISOString();
  } else if (normalized.includes("today")) {
    const d = new Date(); d.setHours(17, 0, 0, 0);
    deadline = d.toISOString();
  } else if (normalized.includes("tonight")) {
    const d = new Date(); d.setHours(21, 0, 0, 0);
    deadline = d.toISOString();
  } else if (normalized.includes("tomorrow")) {
    const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(17, 0, 0, 0);
    deadline = d.toISOString();
  } else if (inDaysMatch) {
    const d = new Date(); d.setDate(d.getDate() + parseInt(inDaysMatch[1])); d.setHours(17, 0, 0, 0);
    deadline = d.toISOString();
  } else if (daysFromNowMatch) {
    const d = new Date(); d.setDate(d.getDate() + parseInt(daysFromNowMatch[1])); d.setHours(17, 0, 0, 0);
    deadline = d.toISOString();
  } else if (nextWeekMatch) {
    const d = new Date(); d.setDate(d.getDate() + 7); d.setHours(17, 0, 0, 0);
    deadline = d.toISOString();
  } else if (endOfWeekMatch) {
    deadline = getNextWeekday(5); // Friday
  } else if (monthMatch) {
    // Parse specific date like "june 30" or "30 june"
    let day, monthStr;
    if (monthMatch[1] && monthMatch[2]) { day = parseInt(monthMatch[1]); monthStr = monthMatch[2]; }
    else if (monthMatch[3] && monthMatch[4]) { day = parseInt(monthMatch[4]); monthStr = monthMatch[3]; }
    const monthIdx = monthNames.findIndex(m => monthStr.toLowerCase().startsWith(m));
    if (monthIdx !== -1 && day >= 1 && day <= 31) {
      const d = new Date(); d.setMonth(monthIdx); d.setDate(day); d.setHours(17, 0, 0, 0);
      if (d < new Date()) d.setFullYear(d.getFullYear() + 1); // past month = next year
      deadline = d.toISOString();
    }
  } else {
    // Check for named weekdays: monday, tuesday, ...
    const foundDay = dayNames.findIndex(day => normalized.includes(day));
    if (foundDay !== -1) {
      deadline = getNextWeekday(foundDay);
    } else {
      // Default: tomorrow 5pm
      const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(17, 0, 0, 0);
      deadline = d.toISOString();
    }
  }

  // 6. Subtasks generator
  let subtasks = [];
  if (!isVague) {
    const titleClean = userInput.replace(/\b(by|at|takes|priority|urgent|hours|h|hrs|high|low|medium)\b.*/gi, "").trim();
    const subEstimates = [
      Math.max(0.5, Math.round((estimatedHours * 0.25) * 10) / 10),
      Math.max(0.5, Math.round((estimatedHours * 0.50) * 10) / 10),
      Math.max(0.5, Math.round((estimatedHours * 0.25) * 10) / 10)
    ];
    
    if (type === "Writing") {
      subtasks = [
        { title: `Research & Outline for ${titleClean}`, durationHours: subEstimates[0] },
        { title: `Draft core section content`, durationHours: subEstimates[1] },
        { title: `Review and refine tone`, durationHours: subEstimates[2] }
      ];
    } else if (type === "Programming") {
      subtasks = [
        { title: `Analyze logic & design steps for ${titleClean}`, durationHours: subEstimates[0] },
        { title: `Write code implementation`, durationHours: subEstimates[1] },
        { title: `Test inputs and debug errors`, durationHours: subEstimates[2] }
      ];
    } else if (type === "Learning") {
      subtasks = [
        { title: `Locate learning materials / documentation`, durationHours: subEstimates[0] },
        { title: `Read details and take conceptual notes`, durationHours: subEstimates[1] },
        { title: `Review questions / practice application`, durationHours: subEstimates[2] }
      ];
    } else {
      subtasks = [
        { title: `Prepare prerequisites for ${titleClean}`, durationHours: subEstimates[0] },
        { title: `Execute main tasks`, durationHours: subEstimates[1] },
        { title: `Finalize output details`, durationHours: subEstimates[2] }
      ];
    }
  }

  // Make sure the sum matches estimatedHours
  if (subtasks.length > 0) {
    const sum = subtasks.reduce((s, item) => s + item.durationHours, 0);
    if (sum !== estimatedHours) {
      subtasks[1].durationHours += (estimatedHours - sum);
      subtasks[1].durationHours = Math.max(0.5, Math.round(subtasks[1].durationHours * 10) / 10);
    }
  }

  const registrationLink = null;
  const prizes = null;
  const eligibility = null;
  const location = null;

  return {
    title,
    deadline,
    estimatedHours,
    priority,
    type,
    isVague,
    clarifyingQuestion,
    confidence: 0.5,
    subtasks,
    registrationLink,
    prizes,
    eligibility,
    location,
    isFallback: true,
    fallbackReason: errorMsg
  };
}

export async function optimizeScheduleWithGemini(tasks, meetings, profile, workDays) {
  const apiKey = getConfiguredGeminiApiKey();
  const groqApiKey = getConfiguredGroqApiKey();

  const activeTasks = tasks.filter(t => t.status !== "completed").map(t => ({
    id: t.id,
    title: t.title,
    priority: t.priority,
    type: t.type || "General",
    subtasks: (t.subtasks || []).map((sub, idx) => ({
      idx,
      title: sub.title,
      durationHours: sub.durationHours || 1
    }))
  }));

  const serializedMeetings = meetings.map(m => ({
    title: m.title,
    start: new Date(m.start).toISOString(),
    end: new Date(m.end).toISOString()
  }));

  const workDaysStrings = workDays.map(d => new Date(d).toDateString());

  const promptText = `
You are the AI Schedule Optimizer of DeadlineIQ.
Your task is to schedule uncompleted subtasks into free calendar slots between 9:00 AM and 5:00 PM for the working days of the week.

Working Days: ${JSON.stringify(workDaysStrings)}
Working Hours: 9:00 AM to 5:00 PM (Monday to Friday).

Existing Meetings / Blocks (DO NOT OVERLAP with these!):
${JSON.stringify(serializedMeetings)}

Subtasks to Schedule:
${JSON.stringify(activeTasks)}

User Procrastination Behavioral Profile:
- Primary Procrastination Style: ${profile.primaryPattern}
- Trigger Task Categories (Users tend to delay these): ${JSON.stringify(profile.triggerCategories)}
- Explanatory Fingerprint: "${profile.explanation}"

Scheduling Rules:
1. DO NOT overlap slots with existing meetings or other scheduled subtasks.
2. Respect the task priority. High priority subtasks should be scheduled first.
3. Apply Procrastination mitigation rules:
   - If the user's primary pattern is "Fear of Failure" or they avoid "Trigger Task Categories", schedule those trigger tasks in their "Peak Focus Windows" (9:00 AM - 11:30 AM) on early days of the week, so they get them done when energy is highest.
   - Do not schedule heavily demanding or trigger tasks late in the afternoon (after 3:00 PM) to avoid cognitive fatigue.
4. Each slot must have a start and end time in ISO 8601 format. Ensure durations match the subtask durationHours.
5. All times must fall strictly between 9:00 AM and 5:00 PM on the working days.

Return a JSON object containing the optimized subtask slots mapping under the key 'optimizedSlots'.
`;

  const responseSchema = {
    type: "OBJECT",
    properties: {
      optimizedSlots: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            taskId: { type: "STRING" },
            subtaskIdx: { type: "INTEGER" },
            scheduledStart: { type: "STRING", description: "ISO 8601 Datetime string" },
            scheduledEnd: { type: "STRING", description: "ISO 8601 Datetime string" },
            reason: { type: "STRING", description: "Short optimization reason" }
          },
          required: ["taskId", "subtaskIdx", "scheduledStart", "scheduledEnd", "reason"]
        }
      }
    },
    required: ["optimizedSlots"]
  };

  try {
    if (groqApiKey) {
      return await callGroqJson({ promptText, apiKey: groqApiKey, model: GROQ_CHAT_MODEL });
    }
    if (apiKey) {
      return await callGeminiJson({ promptText, apiKey, responseSchema });
    }
    throw new Error("No cloud AI key configured");
  } catch (err) {
    console.warn("AI Schedule Optimizer failed. Falling back to local heuristic optimization:", err.message);
    return optimizeScheduleLocally(tasks, meetings, workDays);
  }
}

function optimizeScheduleLocally(tasks, meetings, workDays) {
  const slots = [];
  const activeTasks = tasks.filter(t => t.status !== "completed");
  
  let currentDayIdx = 0;
  let currentHour = 9;
  let currentMin = 0;

  activeTasks.forEach(task => {
    if (task.subtasks) {
      task.subtasks.forEach((sub, idx) => {
        if (!sub.completed) {
          const durationMs = (sub.durationHours || 1) * 60 * 60 * 1000;
          
          let allocated = false;
          while (currentDayIdx < workDays.length && !allocated) {
            const day = new Date(workDays[currentDayIdx]);
            const start = new Date(day);
            start.setHours(currentHour, currentMin, 0, 0);
            
            const end = new Date(start.getTime() + durationMs);
            const limit = new Date(day);
            limit.setHours(17, 0, 0, 0);

            // Check overlap with meetings
            const overlaps = meetings.some(m => {
              const mStart = new Date(m.start);
              const mEnd = new Date(m.end);
              return start < mEnd && end > mStart;
            });

            if (end <= limit && !overlaps) {
              slots.push({
                taskId: task.id,
                subtaskIdx: idx,
                scheduledStart: start.toISOString(),
                scheduledEnd: end.toISOString(),
                reason: "Scheduled in open focus window (Local fallback)"
              });
              allocated = true;
              
              // Increment pointers
              currentMin += (sub.durationHours || 1) * 60;
              while (currentMin >= 60) {
                currentMin -= 60;
                currentHour += 1;
              }
              if (currentHour >= 17) {
                currentHour = 9;
                currentMin = 0;
                currentDayIdx += 1;
              }
            } else {
              currentMin += 30;
              if (currentMin >= 60) {
                currentMin = 0;
                currentHour += 1;
              }
              if (currentHour >= 17) {
                currentHour = 9;
                currentMin = 0;
                currentDayIdx += 1;
              }
            }
          }
        }
      });
    }
  });

  return { optimizedSlots: slots };
}

export async function forecastHabitSuccess(habits, profile) {
  const apiKey = getConfiguredGeminiApiKey();
  const groqApiKey = getConfiguredGroqApiKey();

  const prompt = `
You are the AI Habit Coach of DeadlineIQ.
Analyze the user's habits and procrastination fingerprint to forecast their habit completion success rate and offer coaching advice.

Active Habits: ${JSON.stringify(habits.map(h => ({ title: h.title, streak: h.streak || 0, frequency: h.frequency || "daily" })))}
User Procrastination Fingerprint:
- Primary Pattern: ${profile.primaryPattern}
- Explanation: ${profile.explanation}

Provide a predicted success percentage (between 10% and 99%) and exactly 2 sentences of specific coaching advice tailored to their procrastination style to help them stick to these habits.
`;

  const schema = {
    type: "OBJECT",
    properties: {
      successRate: { type: "NUMBER" },
      coachingText: { type: "STRING" }
    },
    required: ["successRate", "coachingText"]
  };

  try {
    if (groqApiKey) {
      return await callGroqJson({ promptText: prompt, apiKey: groqApiKey, model: GROQ_FAST_MODEL });
    }
    if (apiKey) {
      return await callGeminiJson({ promptText: prompt, apiKey, responseSchema: schema });
    }
    throw new Error("No cloud AI key configured");
  } catch (err) {
    console.warn("Habit Forecast call failed, using local heuristics:", err.message);
    return {
      successRate: 75,
      coachingText: "[Local Fallback] Maintain your streaks by executing habits in your morning Peak Focus window. Action breeds routine!"
    };
  }
}

export async function chatWithProductivityAgent(message, history, currentTasks, profile) {
  const apiKey = getConfiguredGeminiApiKey();
  const groqApiKey = getConfiguredGroqApiKey();

  const activeTasks = currentTasks.map(t => ({
    id: t.id,
    title: t.title,
    priority: t.priority,
    status: t.status,
    deadline: t.deadline
  }));

  const promptText = `
You are the AI Productivity Agent of DeadlineIQ.
Your role is to act as an empathetic coach, counselor, and coordinator. You help users schedule, manage task overload, and defeat procrastination.

Current Active Tasks:
${JSON.stringify(activeTasks)}

User Behavioral Forensics:
- Primary Procrastination Style: ${profile.primaryPattern}
- Explanatory Fingerprint: "${profile.explanation}"

Your capabilities:
1. Talk to the user empathetically. Suggest actionable, tiny next steps.
2. Coordinate and execute task operations. If the user asks you to add, snooze, or complete a task, say you will do it, and return the appropriate action metadata in the JSON response.

Actions Supported:
- ADD_TASK: to create a new task. Payload needs: { title: "Concise name", priority: "low|medium|high", estimatedHours: number }
- DEFER_TASK: to snooze/reschedule a task. Payload needs: { taskId: "id of task", newDeadline: "ISO DateTime String" } (Use year 2026. Current year is 2026).
- COMPLETE_TASK: to mark a task as completed. Payload needs: { taskId: "id of task" }
- NONE: default when no task creation/update is requested.

Return a JSON matching the schema.
User Message: "${message}"
`;

  if (groqApiKey) {
    console.info("Routing chat to primary Groq Cloud API...");
    try {
      return await chatWithGroqCloudLLM(message, history, currentTasks, profile, groqApiKey);
    } catch (groqErr) {
      console.warn("Groq cloud chat failed, falling back:", groqErr.message);
    }
  }

  if (!apiKey) {

    const offlinePreference = localStorage.getItem("deadlineiq_offline_mode_preference") || "webgpu";
    if (offlinePreference === "heuristics") {
      return {
        reply: "[Offline Mode - Heuristics] I'm active! Configure a Gemini API Key in Settings to unlock AI coaching, or set your Offline Engine to WebGPU to use the local model.",
        action: { type: "NONE", payload: {} }
      };
    }

    console.warn("Gemini API key is missing. Trying local offline LLM for chat...");
    try {
      return await chatWithLocalOfflineLLM(promptText);
    } catch {
      return {
        reply: "[Offline Mode] I'm here to help! (To unlock intelligent coaching & local tasks, configure your Gemini API Key in Settings or run a local model like Ollama with 'gemma2'.)",
        action: { type: "NONE", payload: {} }
      };
    }
  }

  const serializedHistory = history.map(h => ({
    role: h.role === "user" ? "user" : "model",
    parts: [{ text: h.text }]
  }));


  const responseSchema = {
    type: "OBJECT",
    properties: {
      reply: { type: "STRING", description: "Your conversational response text" },
      action: {
        type: "OBJECT",
        properties: {
          type: { type: "STRING", enum: ["ADD_TASK", "DEFER_TASK", "COMPLETE_TASK", "NONE"] },
          payload: {
            type: "OBJECT",
            properties: {
              title: { type: "STRING" },
              priority: { type: "STRING", enum: ["low", "medium", "high"] },
              estimatedHours: { type: "NUMBER" },
              taskId: { type: "STRING" },
              newDeadline: { type: "STRING" }
            }
          }
        },
        required: ["type"]
      }
    },
    required: ["reply", "action"]
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          ...serializedHistory,
          {
            role: "user",
            parts: [{ text: promptText }]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema,
        }
      })
    });

    if (!response.ok) throw new Error("API call failed");
    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    return JSON.parse(text);
  } catch (err) {
    console.warn("AI Chat Agent call failed:", err.message);
    return {
      reply: `I encountered an issue connecting. Let me know if you need to talk about: ${err.message}`,
      action: { type: "NONE", payload: {} }
    };
  }
}

/**
 * Parses multimodal files (images, PDFs, screenshots) using Gemini 2.5 Flash.
 */
export async function parseMediaWithGemini(base64Data, mimeType) {
  const apiKey = getConfiguredGeminiApiKey();
  if (!apiKey) {
    throw new Error("Gemini API Key is missing. Please configure it in Settings to parse files.");
  }

  const now = new Date();
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayName = days[now.getDay()];
  const currentLocalTime = `${dayName}, ${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

  const promptText = `
You are the multimodal intelligence engine of DeadlineIQ, an anti-procrastination task manager.
Your job is to analyze the attached image, screenshot, or document (PDF) to perform Universal AI Capture.
Run OCR and analysis to extract the core task/opportunity (e.g. hackathons, assignments, jobs, project deliverables).

Current Time Context:
- Current Local Date/Time: ${currentLocalTime}
- Current Year is 2026.

Extract and return a structured JSON task with these fields:
1. Title: Clean, descriptive name of the opportunity/task (e.g. 'Build Prototype for DeadlineIQ' or 'Devpost Hackathon Submission').
2. Deadline: ISO 8601 DateTime string (e.g. '2026-06-30T17:00:00Z'). Resolve relative descriptors. Set to null if none is found.
3. EstimatedHours: Realistic estimation of hours needed (default to 2 if unspecified).
4. Priority: low, medium, or high.
5. Type: Category, e.g. "Programming", "Writing", "Learning", "Event", etc.
6. Subtasks: A list of 3-6 sequential action steps (each with 'title' and 'durationHours' matching estimatedHours).
7. RegistrationLink: If the image/document lists an application link or registration URL, extract it. Set to null if none.
8. Prizes: For hackathons or competitions, extract prize pool descriptions. Set to null if none.
9. Eligibility: Extract target participant eligibility (e.g., student status). Set to null if none.
10. Location: Extract location of the event. Set to null if none.

Return the JSON matching the required schema.
`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: promptText },
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Data
              }
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            title: { type: "STRING" },
            deadline: { type: "STRING", description: "ISO 8601 datetime string. Use year 2026. Null if none." },
            estimatedHours: { type: "NUMBER" },
            priority: { type: "STRING", enum: ["low", "medium", "high"] },
            type: { type: "STRING" },
            registrationLink: { type: "STRING", description: "Extracted URL link for registering or applying, or null" },
            prizes: { type: "STRING", description: "Extracted prizes or cash pool, or null" },
            eligibility: { type: "STRING", description: "Extracted eligibility requirements, or null" },
            location: { type: "STRING", description: "Extracted event location, or null" },
            subtasks: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  title: { type: "STRING" },
                  durationHours: { type: "NUMBER" }
                },
                required: ["title", "durationHours"]
              }
            }
          },
          required: ["title", "estimatedHours", "priority", "type", "subtasks"]
        }
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Gemini Media API call failed: ${response.statusText}`);
  }

  const result = await response.json();
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
  return JSON.parse(text);
}
