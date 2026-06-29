import { db } from "../firebase";
import { collection, addDoc } from "firebase/firestore";
import { callGroqJson, getConfiguredGeminiApiKey, getConfiguredGroqApiKey } from "./gemini";

// 1. Silent Background Avoidance Logger
export async function logAvoidanceEvent(userId, task, newDeadline, reason) {
  try {
    const now = new Date();
    const hours = now.getHours();
    
    let timeOfDay = "night";
    if (hours >= 5 && hours < 12) timeOfDay = "morning";
    else if (hours >= 12 && hours < 17) timeOfDay = "afternoon";
    else if (hours >= 17 && hours < 22) timeOfDay = "evening";

    const deadlineDate = task.deadline
      ? (task.deadline.toDate ? task.deadline.toDate() : new Date(task.deadline))
      : new Date();
    const diffMs = deadlineDate - now;
    const daysToDeadline = Math.max(0, Math.round((diffMs / (1000 * 60 * 60 * 24)) * 10) / 10);

    const eventData = {
      taskId: task.id,
      taskTitle: task.title,
      taskType: task.type || "General",
      timestamp: new Date(),
      oldDeadline: deadlineDate,
      newDeadline: newDeadline,
      timeOfDay,
      daysToDeadline,
      deferralCount: (task.deferralCount || 0) + 1,
      reason: reason || "Snoozed",
    };

    await addDoc(collection(db, "users", userId, "avoidance_events"), eventData);
  } catch (err) {
    console.error("Failed to log avoidance event:", err);
  }
}

// Helper to make custom cloud AI calls, with Groq as the primary engine.
async function callGemini(promptText, responseSchema) {
  const groqApiKey = getConfiguredGroqApiKey();
  const apiKey = getConfiguredGeminiApiKey();

  if (groqApiKey) {
    try {
      return await callGroqJson({ promptText, apiKey: groqApiKey });
    } catch (err) {
      console.warn("Groq analyzer call failed. Falling back to Gemini if available:", err.message);
    }
  }

  if (!apiKey) {
    throw new Error("Cloud AI key missing in Settings");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

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
    throw new Error(`Gemini Call Failed: ${errMsg}`);
  }

  const result = await response.json();
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty response from Gemini.");
  return JSON.parse(text);
}

// 2. Procrastination Pattern Classifier with local fallback
export async function classifyProcrastinationPattern(tasks, avoidanceEvents) {
  const schema = {
    type: "OBJECT",
    properties: {
      primaryPattern: { 
        type: "STRING", 
        enum: ["Fear of Failure", "Task Ambiguity", "Overwhelm", "Energy Mismatch", "Emotional Avoidance"] 
      },
      percentage: { type: "NUMBER" },
      explanation: { type: "STRING" },
      triggerCategories: { type: "ARRAY", items: { type: "STRING" } },
      safeZoneCategories: { type: "ARRAY", items: { type: "STRING" } },
      avgHoursBeforeDeadline: { type: "NUMBER" },
      trendImprovement: { type: "STRING", enum: ["Improving", "Stable", "Worsening"] }
    },
    required: [
      "primaryPattern", 
      "percentage", 
      "explanation", 
      "triggerCategories", 
      "safeZoneCategories", 
      "avgHoursBeforeDeadline", 
      "trendImprovement"
    ]
  };

  const serializedTasks = tasks.map(t => ({
    title: t.title,
    type: t.type || "General",
    status: t.status,
    deferralCount: t.deferralCount || 0,
  }));

  const serializedEvents = avoidanceEvents.map(e => ({
    taskTitle: e.taskTitle,
    taskType: e.taskType,
    timeOfDay: e.timeOfDay,
    daysToDeadline: e.daysToDeadline,
    reason: e.reason,
  }));

  const prompt = `
You are the Procrastination Forensics Engine of DeadlineIQ.
Analyze the user's tasks and avoidance event logs (rescheduling patterns) to classify their procrastination fingerprint.

User Tasks: ${JSON.stringify(serializedTasks)}
Avoidance Logs: ${JSON.stringify(serializedEvents)}

Based on this historical data:
1. Identify their primary procrastination style:
   - 'Fear of Failure' (perfectionism, avoiding creative/writing/presentation tasks until last minute)
   - 'Task Ambiguity' (avoiding tasks because they feel vague or don't know the first step)
   - 'Overwhelm' (freezing because total volume of work is too high)
   - 'Energy Mismatch' (scheduling heavy tasks at times of low energy/night)
   - 'Emotional Avoidance' (avoiding tasks that trigger discomfort/anxiety)
2. Calculate what percentage of their reschedules align with this primary pattern.
3. List categories of tasks that trigger procrastination ('triggerCategories') and categories they run to as 'safe zones' ('safeZoneCategories').
4. Compute an approximate average number of hours before deadlines that they finally act on trigger tasks.
5. Identify if their trend is 'Improving', 'Stable', or 'Worsening'.

Return the classification matching the requested schema.
`;

  try {
    return await callGemini(prompt, schema);
  } catch (err) {
    console.warn("Forensic Classifier call failed. Using local heuristics engine fallback:", err.message);
    
    // Heuristic Local Classification
    const totalDefers = tasks.reduce((sum, t) => sum + (t.deferralCount || 0), 0);
    const writingTasks = tasks.filter(t => t.type === "Writing" || t.title.toLowerCase().includes("report") || t.title.toLowerCase().includes("write"));
    const writingDefers = writingTasks.reduce((sum, t) => sum + (t.deferralCount || 0), 0);

    let primaryPattern = "Task Ambiguity";
    let explanation = "You tend to snooze tasks because they lack clear actionable next steps. Breaking tasks down into smaller parts will help you build momentum.";
    let percentage = 60;

    if (writingDefers > totalDefers * 0.4) {
      primaryPattern = "Fear of Failure";
      explanation = "You frequently reschedule Writing or Creative tasks. This perfect-standard anxiety causes starting friction. Set a short timed goal (e.g. 10 minutes) to beat it.";
      percentage = 75;
    } else if (tasks.length > 8) {
      primaryPattern = "Overwhelm";
      explanation = "Your total volume of active tasks is high, leading to cognitive paralysis. Try focusing on a single task card in Tunnel Vision Mode.";
      percentage = 70;
    }

    return {
      primaryPattern,
      percentage,
      explanation: `[Local Heuristics Fallback] ${explanation}`,
      triggerCategories: ["Writing", "Presentations"],
      safeZoneCategories: ["Research", "Admin"],
      avgHoursBeforeDeadline: 2.5,
      trendImprovement: "Stable"
    };
  }
}

// 3. Consequence Map Generator for Triage Mode
export async function generateConsequences(overloadedTasks) {
  const taskDetails = overloadedTasks.map(t => ({
    id: t.id,
    title: t.title,
    priority: t.priority,
    estimatedHours: t.estimatedHours,
  }));

  const prompt = `
You are the DeadlineIQ Crisis Triage Engine.
The user's schedule is overloaded (time-deficit). They cannot finish all these tasks.
For each task in the list, write a concise, one-sentence consequence explaining the realistic impact/cost of dropping or deprioritizing it. Be realistic, specific, and slightly direct to highlight the trade-offs clearly.

Tasks: ${JSON.stringify(taskDetails)}

Return a map/object where keys are task IDs and values are the consequence strings.
`;

  const schema = {
    type: "OBJECT",
    properties: overloadedTasks.reduce((props, t) => {
      props[t.id] = { type: "STRING", description: `Consequence of dropping "${t.title}"` };
      return props;
    }, {}),
    required: overloadedTasks.map(t => t.id)
  };

  try {
    return await callGemini(prompt, schema);
  } catch (err) {
    console.warn("Crisis Triage consequence call failed. Using local heuristic mapper:", err.message);
    
    // Heuristic consequences based on priority
    const consequenceMap = {};
    overloadedTasks.forEach((t) => {
      if (t.priority === "high") {
        consequenceMap[t.id] = `[Local Fallback] High impact: Will stall critical deliveries and trigger team-wide delays.`;
      } else if (t.priority === "medium") {
        consequenceMap[t.id] = `[Local Fallback] Moderate impact: Will miss review cycles or push secondary milestones back.`;
      } else {
        consequenceMap[t.id] = `[Local Fallback] Low impact: Minor delay on backlog item; easily deferrable.`;
      }
    });
    return consequenceMap;
  }
}

// 4. Gemini Coaching Blocker Assistant
export async function getCoachingResponse(task, blockerText) {
  const prompt = `
You are the DeadlineIQ Empathy Coach.
The user is procrastinating on the task: "${task.title}" (Priority: ${task.priority}, Estimate: ${task.estimatedHours}h).
They have deferred this task ${task.deferralCount || 0} times already.
They reported the following blocker: "${blockerText}"

Provide a concise, highly actionable, and empathetic coaching advice (exactly 2-3 sentences).
Do not be generic. Give them one extremely small next step (e.g. "open the editor and write 3 bullet points") to break the emotional friction of starting.
`;

  const schema = {
    type: "OBJECT",
    properties: {
      advice: { type: "STRING" }
    },
    required: ["advice"]
  };

  try {
    const result = await callGemini(prompt, schema);
    return result.advice;
  } catch (err) {
    console.warn("Coaching Coach call failed. Using local advice generator:", err.message);
    
    // Deterministic advice responses based on simple keyword parsing
    const normalizedBlocker = blockerText.toLowerCase();
    let advice = "Open your project workspace and commit to working on this task for just 5 minutes. Action breeds motivation, and starting is the hardest part.";

    if (normalizedBlocker.includes("tire") || normalizedBlocker.includes("energy") || normalizedBlocker.includes("sleep")) {
      advice = "[Local Coach] Energy levels are low. Instead of starting the whole task, set a 10-minute timer to simply organize your references, then take a short active break.";
    } else if (normalizedBlocker.includes("start") || normalizedBlocker.includes("know") || normalizedBlocker.includes("how")) {
      advice = "[Local Coach] Lack of clear starting steps creates friction. Open a blank notepad, write down the single easiest action step, and do just that one thing right now.";
    } else if (normalizedBlocker.includes("perfect") || normalizedBlocker.includes("good") || normalizedBlocker.includes("fail")) {
      advice = "[Local Coach] Perfectionism is stalling you. Write a quick, low-stakes draft that nobody else will see—you can edit bad writing, but you cannot edit blank space.";
    }

    return advice;
  }
}
