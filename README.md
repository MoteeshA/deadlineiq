# 🧠 DeadlineIQ: Cognitive-Load AI Task Planner & Focus Companion

**DeadlineIQ** is an ultra-premium, AI-driven productivity companion designed to defeat procrastination and optimize cognitive focus. Traditional productivity tools rely on passive push alerts that users easily ignore. DeadlineIQ introduces a proactive, spatial, and cognitive approach: it analyzes your behavioral patterns, predicts task completion risks using local machine learning, and orchestrates your focus windows directly around existing commitments.

---

## 🌟 Immersive Spatial User Interface Tour

Here is a visual walkthrough of the custom spatial screens and AI modules built into DeadlineIQ:

### 1. Spatial Computing Telemetry Dashboards

#### 🖥️ Primary Navigation HUD
The main dashboard page features floating telemetry modules, active multi-agent status banners, and live task trackers styled in a premium VisionOS-inspired slate dark-mode.
![Primary Navigation HUD](screenshots/dashboard1.png)

#### 🛡️ Local Neural Network Risk Model
An integrated client-side neural net assesses active task parameters in real time to calculate a personalized procrastination probability score.
![Local Neural Network Risk Model](screenshots/dashboard2.png)

#### 🕒 Capacity mapping and Nudges
Features floating telemetry modules indicating focus scores, active priority hours, and audio controls.
![Capacity mapping and Nudges](screenshots/dashboard3.png)

---

### 2. Conversational & Agentic Planning

#### 🎙️ Gemini Natural Language Task Parser
Dictate chaotic schedules (e.g., *"Finish presentation slides by tomorrow at 4 PM, high priority, will take 3h"*). Gemini parses them automatically, estimating cognitive load metrics and establishing confidence scores.
![Gemini Natural Language Task Parser](screenshots/gemini%20AI%20planner.png)

#### 💬 Interactive Co-pilot ("IQ Coach") Sidebar
Sliding sidebar chat where you can naturally command, complete, or reschedule tasks. The AI agent executes actions and commits updates to Firestore in real time.
![Interactive Co-pilot Sidebar](screenshots/chatbot%20and%20mic.png)

#### 📋 Task Deconstruction and Subtask Builder
Gemini automatically breaks down complex deadlines into discrete actions, allowing you to edit subtask parameters, estimated times, and track incremental completion.
![Task Deconstruction and Subtask Builder](screenshots/taskcreation.png)
![Task Builder Details](screenshots/taskbuilder.png)

---

### 3. Workload Orchestration & Forensics

#### 📊 Kanban Progress Board
Drag and track your commitments across progress columns (Due Today, In Progress, Completed), triggering chimes on completion.
![Kanban Progress Board](screenshots/tasks.png)

#### 📅 Glassmorphic VisionOS Calendar Grid
An borderless, edge-to-edge weekly view displaying tasks alongside Google Calendar events, optimizing slots based on Peak Focus Windows.
![Borderless Calendar Grid](screenshots/calander.png)

#### 🔍 Procrastination Forensics & Score Forecasting
Recalculates behavioral delays to catalog your procrastination fingerprint (e.g., *Fear of Failure* or *Task Ambiguity*) and charts predictive score trends using SVGs.
![Procrastination Forensics](screenshots/insights.png)

#### 🔄 Habit Streak routines Tracker
Monitors routine completions with glowing circular progress gauges and fetches Gemini success probability forecasts.
![Habit Streak Tracker](screenshots/habits.png)

#### 🧩 Chrome Extension Panel
Synchronize web browsing tabs, capture research snippets, and push tasks directly to your DeadlineIQ cloud dashboard.
![Chrome Extension Panel](screenshots/extension.png)

#### ⚙️ Settings and API Keys Config
Easily configure custom Gemini Developer API keys and personal preference settings.
![Settings Config](screenshots/settings.png)

---

## 🛠️ Google Technologies Stack (7 Core Integrations)

DeadlineIQ leverages **7 Google Cloud, Firebase, and Workspace technologies** to power its logic and cloud infrastructure:

1. **Google Firebase Authentication**: Provides secure, seamless Google OAuth identity management and session validation.
2. **Google Cloud Firestore**: Real-time NoSQL database storing user profiles, task documents, calendar slots, and behavioral metrics under isolated document references.
3. **Google Gemini API (`gemini-2.5-flash`)**: Drives the AI task parsing engines, automatic subtask generation, and cognitive load forecasting models.
4. **Google Calendar API**: Synchronizes allocated focus slots and task deadlines directly to the user's primary Google Calendar account.
5. **Google Sheets API (Simulated Sync)**: Exports productivity logs and completed task data into Google Sheets-compatible CSV formats with simulated OAuth sync checks.
6. **Google Cloud Run**: Preconfigured containerized setups ready for serverless production scaling.
7. **Google Firebase Hosting**: Serves the optimized production assets globally under verified SSL endpoints (`*.web.app` / `*.firebaseapp.com`).

---

## 🏗️ Technical Architecture

- **Front-End**: React 18, Vite, Tailwind CSS (Glassmorphism, custom transitions, responsive layout).
- **Security Rules**: Production `firestore.rules` enforcing authenticated-owner-only reads/writes on all collection paths:
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
- **Containerization**: Multi-stage `Dockerfile` serving compiled static bundles via a custom `nginx.conf` routing configuration to handle client-side HTML5 history fallbacks.
- **Client-Side MLP Neural Network**: A custom Multi-Layer Perceptron neural network built in pure JavaScript (`src/utils/localML.js`). It runs client-side online learning using supervised backpropagation over 10 epochs to adapt dynamically to user completion and deferral trends.

---

## 💻 Local Setup Guide

### 1. Prerequisites
Ensure you have **Node.js (v18 or v20)** and **npm** installed.

### 2. Clone and Install Dependencies
```bash
# Navigate to the project directory
cd deadlineiq

# Install dependencies
npm install
```

### 3. Environment Variables Configuration
Create a `.env` file in the root of the project and add your Firebase and Gemini credentials:
```env
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_firebase_app_id
```
*Note: The Gemini Developer API Key can also be entered directly in the web UI under **Settings**.*

### 4. Running the Development Server
```bash
npm run dev
```
Open [http://localhost:5174](http://localhost:5174) in your browser to view the application.

---

## 🐳 Docker Deployment

To build and run the application locally using Docker:

```bash
# Build the container image
docker build -t deadlineiq .

# Run the container exposing port 80
docker run -d -p 8080:80 deadlineiq
```
Access the served app at [http://localhost:8080](http://localhost:8080).

---

## 🚀 Google Cloud / Firebase Deployment

To deploy to Firebase Hosting:
```bash
# Authenticate with your Firebase Google Account
npx firebase login

# Compile assets and deploy
npm run build
npx firebase deploy --only hosting
```
