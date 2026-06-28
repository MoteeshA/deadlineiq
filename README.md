# DeadlineIQ: Cognitive-Load AI Task Planner & Focus Companion

**Live Application URL**: [https://deadlineiq-6321f.web.app](https://deadlineiq-6321f.web.app)

DeadlineIQ is a proactive, AI-driven productivity companion designed to defeat procrastination and optimize cognitive focus. It analyzes user behavioral patterns, predicts task completion risks using local machine learning, and orchestrates focus windows directly around existing commitments.

---

## Core Interface & Feature Walkthrough

### 1. Spatial Telemetry Dashboard
The primary dashboard serves as a central hub displaying active multi-agent status banners, floating telemetry modules, and real-time commitment progress.

<p align="center">
  <img src="screenshots/dashboard1.png" width="100%" alt="Primary Navigation HUD" />
</p>

### 2. Conversational Sidebar Agent
Slide open the interactive "IQ Coach" sidebar to command, complete, or reschedule tasks. The co-pilot agent executes actions and commits updates to Firestore in real time.

<p align="center">
  <img src="screenshots/chatbot and mic.png" width="100%" alt="Interactive Co-pilot Sidebar" />
</p>

### 3. Borderless Calendar Grid
The weekly calendar view maps task steps directly to empty calendar slots, positioning demanding tasks in Peak Focus Windows while avoiding existing Google Calendar meetings.

<p align="center">
  <img src="screenshots/calander.png" width="100%" alt="Weekly Calendar Grid" />
</p>

### 4. Behavioral Forensics & Score Forecasting
Analyze rescheduling logs to diagnose your procrastination fingerprint (e.g., *Fear of Failure* or *Task Ambiguity*) and review score trend forecasts.

<p align="center">
  <img src="screenshots/insights.png" width="100%" alt="Behavioral Forensics Dashboard" />
</p>

---

<details>
<summary>🔍 Click to view additional interface screens (Neural Net, Task Creation, Habit Tracker, and Chrome Extension)</summary>

### Local Neural Network Risk Model
<p align="center">
  <img src="screenshots/dashboard2.png" width="80%" alt="Local Neural Net Risk" />
</p>

### Capacity Mapping and Task Actions
<p align="center">
  <img src="screenshots/dashboard3.png" width="80%" alt="Capacity Mapping" />
</p>

### Natural Language Task Parser
<p align="center">
  <img src="screenshots/gemini AI planner.png" width="80%" alt="Gemini AI Planner" />
</p>

### Task Deconstruction & Details
<p align="center">
  <img src="screenshots/taskcreation.png" width="80%" alt="Subtask Builder" />
</p>

<p align="center">
  <img src="screenshots/taskbuilder.png" width="80%" alt="Task Builder Details" />
</p>

### Kanban Progress Board
<p align="center">
  <img src="screenshots/tasks.png" width="80%" alt="Kanban Board" />
</p>

### Habit Streak Tracker
<p align="center">
  <img src="screenshots/habits.png" width="80%" alt="Habits Tracker" />
</p>

### Chrome Extension Utility
<p align="center">
  <img src="screenshots/extension.png" width="80%" alt="Chrome Extension" />
</p>

### Settings Panel
<p align="center">
  <img src="screenshots/settings.png" width="80%" alt="Settings Panel" />
</p>

</details>

---

## Google Technologies Stack

1. **Google Firebase Authentication**: Provides secure, seamless Google OAuth identity management and session validation.
2. **Google Cloud Firestore**: Real-time NoSQL database storing user profiles, task documents, calendar slots, and behavioral metrics under isolated document references.
3. **Google Gemini API (`gemini-2.5-flash`)**: Drives the AI task parsing engines, automatic subtask generation, and cognitive load forecasting models.
4. **Google Calendar API**: Synchronizes allocated focus slots and task deadlines directly to the user's primary Google Calendar account.
5. **Google Sheets API (Simulated Sync)**: Exports productivity logs and completed task data into Google Sheets-compatible CSV formats with simulated OAuth sync checks.
6. **Google Cloud Run**: Preconfigured containerized setups ready for serverless production scaling.
7. **Google Firebase Hosting**: Serves the optimized production assets globally under verified SSL endpoints (`*.web.app` / `*.firebaseapp.com`).

---

## Technical Architecture

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

## Local Setup Guide

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

## Docker Deployment

To build and run the application locally using Docker:

```bash
# Build the container image
docker build -t deadlineiq .

# Run the container exposing port 80
docker run -d -p 8080:80 deadlineiq
```
Access the served app at [http://localhost:8080](http://localhost:8080).

---

## Firebase Deployment

To deploy to Firebase Hosting:
```bash
# Authenticate with your Firebase Google Account
npx firebase login

# Compile assets and deploy
npm run build
npx firebase deploy --only hosting
```
