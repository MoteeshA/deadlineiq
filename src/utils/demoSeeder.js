import { db } from "../firebase";
import { collection, writeBatch, doc, serverTimestamp } from "firebase/firestore";

/**
 * Seeds a high-fidelity workspace for Demo Mode.
 * Creates 20 tasks (with history), habits, goals, and calendar items.
 */
export async function seedDemoData(userId) {
  const batch = writeBatch(db);
  const now = new Date();

  // Helper for generating relative dates
  const offsetDate = (days = 0, hours = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    d.setHours(d.getHours() + hours);
    return d;
  };

  // 1. Mock Tasks (20 Tasks: 5 completed, 3 in progress, 12 pending)
  const taskData = [
    // Completed Tasks (for historical metrics)
    {
      title: "Design Relational DBMS Architecture",
      estimatedHours: 4,
      priority: "high",
      status: "completed",
      type: "Programming",
      subtasks: [
        { title: "Normalize schemas to 3NF", completed: true, durationHours: 1.5 },
        { title: "Draw Entity-Relationship Diagram", completed: true, durationHours: 1.5 },
        { title: "Draft SQL create scripts", completed: true, durationHours: 1.0 }
      ],
      deferralCount: 0,
      deferralHistory: [],
      createdAt: offsetDate(-4)
    },
    {
      title: "Write Abstract for AI Research Paper",
      estimatedHours: 2,
      priority: "medium",
      status: "completed",
      type: "Writing",
      subtasks: [
        { title: "Summarize methodology", completed: true, durationHours: 1.0 },
        { title: "Format citation list", completed: true, durationHours: 1.0 }
      ],
      deferralCount: 1,
      deferralHistory: [
        { timestamp: offsetDate(-3), oldDeadline: offsetDate(-3, -4), newDeadline: offsetDate(-3), reason: "Felt fatigued" }
      ],
      createdAt: offsetDate(-4)
    },
    {
      title: "Google Cloud SDK Installation",
      estimatedHours: 1.5,
      priority: "low",
      status: "completed",
      type: "Admin",
      subtasks: [{ title: "Run gcloud init", completed: true, durationHours: 1.5 }],
      deferralCount: 0,
      deferralHistory: [],
      createdAt: offsetDate(-5)
    },
    {
      title: "Implement OAuth Firebase Flow",
      estimatedHours: 3,
      priority: "high",
      status: "completed",
      type: "Programming",
      subtasks: [
        { title: "Enable Google provider in console", completed: true, durationHours: 1.0 },
        { title: "Code redirect router logic", completed: true, durationHours: 2.0 }
      ],
      deferralCount: 0,
      deferralHistory: [],
      createdAt: offsetDate(-3)
    },
    {
      title: "Set up Web Speech Dictation UI",
      estimatedHours: 2,
      priority: "medium",
      status: "completed",
      type: "Writing",
      subtasks: [{ title: "Integrate dictation button", completed: true, durationHours: 2.0 }],
      deferralCount: 0,
      deferralHistory: [],
      createdAt: offsetDate(-2)
    },

    // In Progress Tasks
    {
      title: "Submit Google Hackathon Presentation",
      estimatedHours: 5,
      priority: "high",
      status: "progress",
      type: "Writing",
      subtasks: [
        { title: "Record demo video walk", completed: false, durationHours: 2.0 },
        { title: "Refine Google Doc templates", completed: true, durationHours: 1.5 },
        { title: "Review judging slides deck", completed: false, durationHours: 1.5 }
      ],
      deferralCount: 2,
      deferralHistory: [
        { timestamp: offsetDate(-2), oldDeadline: offsetDate(-2), newDeadline: offsetDate(-1), reason: "Polishing details" },
        { timestamp: offsetDate(-1), oldDeadline: offsetDate(-1), newDeadline: offsetDate(0, 4), reason: "Refining visual presentation" }
      ],
      createdAt: offsetDate(-3)
    },
    {
      title: "Review DBMS Final Exam Materials",
      estimatedHours: 4,
      priority: "high",
      status: "progress",
      type: "Learning",
      subtasks: [
        { title: "Revise transaction isolation levels", completed: true, durationHours: 2.0 },
        { title: "Practice B-Tree index construction", completed: false, durationHours: 2.0 }
      ],
      deferralCount: 3,
      deferralHistory: [
        { timestamp: offsetDate(-2), oldDeadline: offsetDate(-2), newDeadline: offsetDate(-1), reason: "Too tired" },
        { timestamp: offsetDate(-1), oldDeadline: offsetDate(-1), newDeadline: offsetDate(0, 6), reason: "Topic felt overly complex" },
        { timestamp: offsetDate(0), oldDeadline: offsetDate(0), newDeadline: offsetDate(1), reason: "Energy level mismatch" }
      ],
      createdAt: offsetDate(-4)
    },
    {
      title: "Build Client-Side ML Model",
      estimatedHours: 3.5,
      priority: "medium",
      status: "progress",
      type: "Programming",
      subtasks: [
        { title: "Write feedforward forward logic", completed: true, durationHours: 1.5 },
        { title: "Implement backpropagation weight updates", completed: false, durationHours: 2.0 }
      ],
      deferralCount: 0,
      deferralHistory: [],
      createdAt: offsetDate(-1)
    },

    // Pending Tasks (Due Today/Tomorrow/This Week)
    {
      title: "Optimize Firebase Security Rules",
      estimatedHours: 1.5,
      priority: "low",
      status: "today",
      type: "Admin",
      subtasks: [{ title: "Lock subcollections to owner auth", completed: false, durationHours: 1.5 }],
      deferralCount: 0,
      deferralHistory: [],
      createdAt: offsetDate(-1)
    },
    {
      title: "Deploy Container to Google Cloud Run",
      estimatedHours: 2.5,
      priority: "high",
      status: "today",
      type: "Admin",
      subtasks: [
        { title: "Configure Dockerfile stages", completed: false, durationHours: 1.0 },
        { title: "Push build and run deploy command", completed: false, durationHours: 1.5 }
      ],
      deferralCount: 1,
      deferralHistory: [
        { timestamp: offsetDate(-1), oldDeadline: offsetDate(-1), newDeadline: offsetDate(0, 2), reason: "Awaiting domain names setup" }
      ],
      createdAt: offsetDate(-2)
    },
    {
      title: "Design Landing Page Visual Theme",
      estimatedHours: 3.0,
      priority: "medium",
      status: "today",
      type: "Writing",
      subtasks: [
        { title: "Select color gradient tokens", completed: false, durationHours: 1.0 },
        { title: "Add custom interactive Orb assets", completed: false, durationHours: 2.0 }
      ],
      deferralCount: 4,
      deferralHistory: [
        { timestamp: offsetDate(-3), oldDeadline: offsetDate(-3), newDeadline: offsetDate(-2), reason: "Felt ambiguous" },
        { timestamp: offsetDate(-2), oldDeadline: offsetDate(-2), newDeadline: offsetDate(-1), reason: "Design choice paralysis" },
        { timestamp: offsetDate(-1), oldDeadline: offsetDate(-1), newDeadline: offsetDate(0, 3), reason: "Fear of poor results" },
        { timestamp: offsetDate(0), oldDeadline: offsetDate(0), newDeadline: offsetDate(0, 8), reason: "Focusing on core APIs" }
      ],
      createdAt: offsetDate(-4)
    },
    {
      title: "Test Voice Conversation Dialogs",
      estimatedHours: 2.0,
      priority: "medium",
      status: "today",
      type: "Programming",
      subtasks: [{ title: "Verify continuous speech loop responses", completed: false, durationHours: 2.0 }],
      deferralCount: 0,
      deferralHistory: [],
      createdAt: offsetDate(0)
    },
    {
      title: "Practice DBMS Query Indexing Scenarios",
      estimatedHours: 3.0,
      priority: "high",
      status: "today",
      type: "Learning",
      subtasks: [{ title: "Analyze query optimizer paths", completed: false, durationHours: 3.0 }],
      deferralCount: 0,
      deferralHistory: [],
      createdAt: offsetDate(0)
    },
    {
      title: "Format Project Documentation PDF",
      estimatedHours: 1.0,
      priority: "low",
      status: "today",
      type: "Writing",
      subtasks: [{ title: "Check headings style structure", completed: false, durationHours: 1.0 }],
      deferralCount: 0,
      deferralHistory: [],
      createdAt: offsetDate(0)
    },
    {
      title: "Integrate Web Audio Synthesizer Chimes",
      estimatedHours: 2.0,
      priority: "low",
      status: "today",
      type: "Programming",
      subtasks: [{ title: "Code oscillator tone frequency sweep", completed: false, durationHours: 2.0 }],
      deferralCount: 0,
      deferralHistory: [],
      createdAt: offsetDate(0)
    },
    {
      title: "Perform Multi-Agent Sync Validation",
      estimatedHours: 3.0,
      priority: "high",
      status: "today",
      type: "Admin",
      subtasks: [
        { title: "Test Planning Agent task overrides", completed: false, durationHours: 1.5 },
        { title: "Validate Calendar sync triggers", completed: false, durationHours: 1.5 }
      ],
      deferralCount: 0,
      deferralHistory: [],
      createdAt: offsetDate(0)
    }
  ];

  // Write tasks to database
  taskData.forEach((task) => {
    // Determine deadline relative to now
    let deadline;
    if (task.status === "completed") {
      deadline = offsetDate(-1);
    } else if (task.status === "today") {
      deadline = offsetDate(0, 4); // due in 4 hours
    } else {
      deadline = offsetDate(1, 2); // due tomorrow
    }

    const taskRef = doc(collection(db, "users", userId, "tasks"));
    batch.set(taskRef, {
      ...task,
      deadline,
      createdAt: task.createdAt || serverTimestamp()
    });
  });

  // 2. Habits (4 Habits with streaks)
  const habitsData = [
    { title: "Deep Work morning block", frequency: "daily", streak: 8, createdAt: serverTimestamp() },
    { title: "Review task queue before bed", frequency: "daily", streak: 5, createdAt: serverTimestamp() },
    { title: "Gym / Physical exercise", frequency: "daily", streak: 3, createdAt: serverTimestamp() },
    { title: "Learn one new API technique", frequency: "weekly", streak: 2, createdAt: serverTimestamp() }
  ];

  habitsData.forEach((habit) => {
    const habitRef = doc(collection(db, "users", userId, "habits"));
    batch.set(habitRef, habit);
  });

  // 3. Goals (3 Goals with milestones)
  const goalsData = [
    { title: "Submit Google Cloud AI Hackathon Project", targetDate: offsetDate(1), progress: 90, createdAt: serverTimestamp() },
    { title: "Ace Semester DBMS Exam", targetDate: offsetDate(3), progress: 75, createdAt: serverTimestamp() },
    { title: "Complete Fullstack Portfolio projects", targetDate: offsetDate(30), progress: 45, createdAt: serverTimestamp() }
  ];

  goalsData.forEach((goal) => {
    const goalRef = doc(collection(db, "users", userId, "goals"));
    batch.set(goalRef, goal);
  });

  // 4. Save a mock procrastination pattern to LocalStorage to feed the dashboard UI
  const patternCacheKey = `deadlineiq_pattern_${userId}`;
  localStorage.setItem(patternCacheKey, JSON.stringify({
    primaryPattern: "Fear of Failure",
    percentage: 82,
    explanation: "You delay tasks when you expect high quality. Use Ugly Draft timers to get started.",
    triggerCategories: ["Writing", "Presentations"],
    safeZoneCategories: ["Admin", "Research"],
    avgHoursBeforeDeadline: 2.8,
    trendImprovement: "Improving"
  }));

  // Commit batch
  await batch.commit();
}
