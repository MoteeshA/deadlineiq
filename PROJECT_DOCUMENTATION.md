# DeadlineIQ Project Documentation Template
> **Tip for User**: Copy the content below, paste it into a Google Doc, format it nicely, and share the public link in your BlockseBlock submission to fulfill the mandatory **Project Description (Google Doc Link)** requirement!

---

# 🧠 DeadlineIQ: Cognitive-Load AI Task Planner & Companion

## 1. Selected Problem Statement
**The Last-Minute Life Saver**: Building an AI-powered productivity companion that proactively assists users in planning, prioritizing, and completing tasks before deadlines are breached. The solution must focus on helping users take meaningful action rather than ignoring passive notifications.

---

## 2. Solution Overview
**DeadlineIQ** is a premium, AI-driven productivity companion designed to defeat procrastination and optimize cognitive focus. Traditional productivity tools rely on passive push alerts that users easily snooze. DeadlineIQ takes a proactive approach:
1. **Understands Procrastination Habits**: Analyzes user rescheduling logs (deferral patterns) to build a behavioral fingerprint (e.g. *Fear of Failure* or *Task Ambiguity*).
2. **Mitigates Friction**: Generates personalized action plans, micro-starting steps (like a "10-Min Ugly Draft Timer"), and schedules tasks around cognitive energy levels.
3. **Orchestrates Schedules**: Features a dynamic calendar view with an AI-driven schedule optimizer that maps task steps to Peak Focus Windows and existing calendar meetings.
4. **Agentic Conversational Automation**: Features an integrated floating sidebar agent ("IQ Coach") that lets users converse naturally to create, reschedule, or complete tasks on Firestore.

DeadlineIQ is wrapped in a high-fidelity slate dark-mode user interface utilizing Tailwind CSS v4, circular SVG progress charts, glassmorphic layouts, and audio alerts.

---

## 3. Key Features
- **🎙️ Voice-Enabled Task Planner**:dictate tasks hands-free using the Web Speech API. Gemini automatically parses messy text (e.g. *"finish outline by tomorrow at 3, high priority"*) into a parent task with categorized subtasks and confidence metrics.
- **🔍 Procrastination Forensics**: Recalculates behavioral logs to diagnose why tasks are delayed. Categorizes delays into five cognitive patterns: *Fear of Failure*, *Task Ambiguity*, *Overwhelm*, *Energy Mismatch*, and *Emotional Avoidance*.
- **⚡ Crisis Triage Mode**: Automatically triggers when the active workload due in 48 hours exceeds capacity (16 hours). Generates a dynamic consequence map highlighting the exact trade-offs of postponing high, medium, and low priority tasks.
- **🧠 AI Schedule Optimizer**: Re-layouts weekly tasks into empty calendar slots using a multi-constraint Gemini optimizer, positioning demanding tasks in morning Peak Windows and avoiding meeting blocks.
- **🔥 Goals & Habits Tracker**: Monitors recurring routines with circular progress streaks. Features a Gemini-powered **Habit Success Likelihood Forecast** dial explaining success probability.
- **💬 Conversational Sidebar Agent ("IQ Coach")**: A co-pilot chat that executes actions. If you ask it to *"snooze the report"* or *"add coding task"*, it autonomously writes updates to Firestore in real time.
- **🧠 Custom Client-Side Neural Network (LightMLP)**: Built a custom Multi-Layer Perceptron neural network in pure JavaScript. It runs client-side online learning to predict procrastination risk on individual tasks based on the user's historical completion and deferral actions. It trains on-the-fly (supervised backpropagation) when tasks are completed or deferred, saving weights locally, and displays a dynamic "Local Neural Net Risk: X%" badge on each TaskCard.
- **🔊 Subtle Audio Alerts**: Employs Web Audio API synthesizers to sound chimes on notifications and task completions.

---

## 4. Google Technologies Utilized (7 Core Integrations)
DeadlineIQ leverages the Google Cloud ecosystem to deliver high-performance logic and serverless infrastructure:

1. **Google Gemini API (`gemini-2.5-flash`)**:
   - Powering the natural language task parser.
   - Running the schedule optimizer engine.
   - Performing procrastination fingerprint forensics classifications.
   - Calculating habit success likelihood forecasting models.
   - Acting as the conversational agent co-pilot in the sidebar chat.
2. **Google Firebase Authentication**: Provides secure, authenticated sessions, supporting seamless Google OAuth logins.
3. **Google Cloud Firestore**: Real-time NoSQL cloud database storing user profiles, tasks, calendar slots, habits, and goals under isolated document security references.
4. **Google Calendar API**: Synchronizes dynamically allocated calendar slots and deadlines with the user's primary Google Calendar account.
5. **Google Sheets API (Simulated Sync)**: Exports completed task history and commitment velocity metrics into Sheets-compatible CSV spreadsheets.
6. **Google Cloud Run**: Serves the containerized React application globally using serverless scaling.
7. **Google Firebase Hosting**: Delivers production assets over SSL under verified endpoints.

---

## 5. Technical Implementation Details
- **Frontend Stack**: React 18, Vite, Tailwind CSS v4 (Glassmorphism, custom transition layers, responsive layouts).
- **Backend Stack**: Firestore real-time snapshots, Google OAuth session handlers.
- **Security Rules**: Firestore Rules enforce ownership, rejecting read/write access unless the user ID matches the authenticated token:
  ```javascript
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      match /users/{userId}/{document=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
  ```
- **Containerization**: Multi-stage `Dockerfile` compiling compiled static bundles and serving via a custom Nginx router config to manage SPA HTML5 routing fallbacks.
