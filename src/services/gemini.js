export async function parseTaskWithGemini(userInput) {
  // 1. Get API Key (Settings storage or fallback to Env)
  const apiKey = localStorage.getItem("deadlineiq_gemini_api_key") || import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("Gemini API key is missing. Using local deterministic parser fallback.");
    return parseTaskLocally(userInput, "API Key missing in Settings");
  }

  // 2. Format current time context
  const now = new Date();
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayName = days[now.getDay()];
  const currentLocalTime = `${dayName}, ${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

  const promptText = `
You are the intelligence engine of DeadlineIQ, an anti-procrastination task manager.
Your job is to parse a natural language task description, extract core metadata, determine if it is vague, and break it down into actionable subtasks.

User's Task Description: "${userInput}"

Current Time Context:
- Current Local Date/Time: ${currentLocalTime} (use this as the reference point to resolve relative deadlines like 'tomorrow', 'Friday at 5pm', 'next week')
- Current Year is 2026.

Schema Guidelines:
1. Title: Extracted clean, concise name of the task.
2. Deadline: ISO 8601 DateTime string. Resolve relative descriptors carefully. If NO deadline can be inferred, set to null.
3. EstimatedHours: Total hours required. If user specifies "2h", return 2. If unspecified, make a reasonable estimate (e.g. 1 to 10 hours).
4. Priority: low, medium, or high. Base this on urgency and gravity of the task.
5. Type: Category, e.g. "Writing", "Programming", "Admin", "Learning", "Event", etc.
6. IsVague: boolean. Set to true if the task description is very ambiguous (e.g. "do stuff", "study", "work on project"). If true, provide a single, actionable clarifying question in 'clarifyingQuestion' to help define the task, and keep the subtasks array empty.
7. ClarifyingQuestion: If isVague is true, ask a simple prompt. Else empty string.
8. Subtasks: A list of 3-6 actionable, sequential subtasks to complete this parent task. Each subtask must have a 'title' and 'durationHours' (how long that step takes). The sum of subtask durationHours should approximate the parent task's estimatedHours. Keep empty if isVague is true.
9. Confidence: decimal between 0.0 and 1.0.

Return the JSON matching the required schema.
`;

  // Updated to use the gemini-2.5-flash model on v1beta endpoint
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

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
              deadline: { 
                type: "STRING", 
                description: "ISO 8601 datetime string. Use year 2026. If no deadline is specified or inferred, return null." 
              },
              estimatedHours: { type: "NUMBER", description: "Total estimated hours to complete the task" },
              priority: { type: "STRING", enum: ["low", "medium", "high"] },
              type: { type: "STRING", description: "Category: e.g. Writing, Programming, Admin, Learning, Event" },
              isVague: { type: "BOOLEAN", description: "True if the task title is vague or lacks clear outcome (e.g. 'do homework' or 'study')" },
              clarifyingQuestion: { type: "STRING", description: "Single simple question if task is vague, else empty" },
              confidence: { type: "NUMBER", description: "Confidence of extraction, between 0.0 and 1.0" },
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
            required: ["title", "estimatedHours", "priority", "type", "isVague", "confidence", "subtasks"],
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

    return JSON.parse(textResponse);
  } catch (err) {
    console.warn("Gemini API call failed. Falling back to local deterministic parser:", err.message);
    return parseTaskLocally(userInput, err.message);
  }
}

function parseTaskLocally(userInput, errorMsg) {
  const normalized = userInput.toLowerCase();
  
  // 1. Is Vague check
  let isVague = false;
  let clarifyingQuestion = "";
  const vagueKeywords = ["study", "work", "do stuff", "something", "homework", "task"];
  if (vagueKeywords.some(w => normalized.trim() === w)) {
    isVague = true;
    clarifyingQuestion = `What specific topic or action items are involved in "${userInput}"?`;
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

  // 5. Deadline parser
  let deadline;
  
  if (normalized.includes("today")) {
    const today = new Date();
    today.setHours(17, 0, 0, 0);
    deadline = today.toISOString();
  } else if (normalized.includes("tomorrow")) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(17, 0, 0, 0);
    deadline = tomorrow.toISOString();
  } else if (normalized.includes("friday")) {
    const tempDate = new Date();
    const currentDay = tempDate.getDay();
    const daysUntilFriday = (5 - currentDay + 7) % 7 || 7;
    tempDate.setDate(tempDate.getDate() + daysUntilFriday);
    tempDate.setHours(17, 0, 0, 0);
    deadline = tempDate.toISOString();
  } else {
    // Default to tomorrow at 5pm
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(17, 0, 0, 0);
    deadline = tomorrow.toISOString();
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

  return {
    title: userInput.replace(/\b(by|at|takes|priority|urgent|hours|h|hrs|high|low|medium)\b.*/gi, "").trim() || userInput,
    deadline,
    estimatedHours,
    priority,
    type,
    isVague,
    clarifyingQuestion,
    confidence: 0.5,
    subtasks,
    isFallback: true,
    fallbackReason: errorMsg
  };
}

export async function optimizeScheduleWithGemini(tasks, meetings, profile, workDays) {
  const apiKey = localStorage.getItem("deadlineiq_gemini_api_key") || import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("Gemini API key is missing. Using local optimizer fallback.");
    return optimizeScheduleLocally(tasks, meetings, workDays);
  }

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

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema,
        }
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const errMsg = errData?.error?.message || `HTTP ${response.status}`;
      throw new Error(`Schedule Optimization Failed: ${errMsg}`);
    }

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Empty response from AI Optimizer.");
    return JSON.parse(text);
  } catch (err) {
    console.warn("AI Schedule Optimizer call failed. Falling back to local heuristic optimization:", err.message);
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
  const apiKey = localStorage.getItem("deadlineiq_gemini_api_key") || import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    return {
      successRate: 75,
      coachingText: "[Local Fallback] Maintain your streaks by executing habits in your morning Peak Focus window. Action breeds routine!"
    };
  }

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

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: schema,
        }
      })
    });

    if (!response.ok) throw new Error("API call failed");
    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    return JSON.parse(text);
  } catch (err) {
    console.warn("Habit Forecast call failed, using local heuristics:", err.message);
    return {
      successRate: 75,
      coachingText: "[Local Fallback] Maintain your streaks by executing habits in your morning Peak Focus window. Action breeds routine!"
    };
  }
}

export async function chatWithProductivityAgent(message, history, currentTasks, profile) {
  const apiKey = localStorage.getItem("deadlineiq_gemini_api_key") || import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    return {
      reply: "[Offline Mode] I'm here to help! Please configure your Gemini API Key in Settings to unlock task automation and coaching.",
      action: { type: "NONE", payload: {} }
    };
  }

  const serializedHistory = history.map(h => ({
    role: h.role === "user" ? "user" : "model",
    parts: [{ text: h.text }]
  }));

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

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

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
  const apiKey = localStorage.getItem("deadlineiq_gemini_api_key") || import.meta.env.VITE_GEMINI_API_KEY;
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
5. Type: Category, e.g. "Programming", "Writing", "Learning", "Admin", "Event", etc.
6. Subtasks: A list of 3-6 sequential action steps (each with 'title' and 'durationHours' matching estimatedHours).

Return the JSON matching the required schema.
`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

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



