# 🧠 DeadlineIQ

DeadlineIQ is a premium, AI-driven cognitive-load task planner designed to mitigate deadline paralysis and optimize focus schedules. It combines advanced natural language scheduling, behavioral forensics, dynamic calendar slot allocation, and gamified commitment metrics into a sleek, deep slate dark-mode interface built on Tailwind CSS v4.

---

## 🚀 Key Features

- **Natural Language Task Planner**: Parse chaotic inputs (e.g., *"Write report by 5 PM tomorrow, high priority, will take 4h"*) into structured tasks with subtasks automatically using Gemini AI.
- **Procrastination Forensics**: Recalculate your behavioral fingerprint to identify patterns like "Fear of Failure" or "Perfectionism Delay" based on deferrals and scheduling logs.
- **Dynamic Weekly Calendar Grid**: Allocate task slots into Peak Focus Windows based on daily energy levels.
- **Commitment Velocity Score**: Track daily completion metrics and view AI-powered forecasts of score trends via native, responsive SVG charting.
- **Real-Time Notification Center**: Stay aligned with smart, context-aware nudge alerts for shifts in focus windows and imminent deadlines.
- **Google Sheets & CSV Integration**: One-click extraction of completed tasks to CSV with simulated Google Sheets synchronization.

---

## 🛠️ Google Technologies Stack (7 Core Integrations)

DeadlineIQ leverages **7 Google Cloud, Firebase, and Workspace technologies** to power its logic and cloud infrastructure:

1. **Google Firebase Authentication**: Provides secure, seamless Google OAuth identity management and session validation.
2. **Google Cloud Firestore**: Real-time NoSQL database storing user profiles, task documents, calendar slots, and behavioral metrics under isolated document references.
3. **Google Gemini API (`gemini-1.5-flash`)**: Drives the AI task parsing engines, automatic subtask generation, and cognitive load forecasting models.
4. **Google Calendar API**: Synchronizes allocated focus slots and task deadlines directly to the user's primary Google Calendar account.
5. **Google Sheets API (Simulated Sync)**: Exports productivity logs and completed task data into Google Sheets-compatible CSV formats with simulated OAuth sync checks.
6. **Google Cloud Run**: Preconfigured containerized setups ready for serverless production scaling.
7. **Google Firebase Hosting**: Serves the optimized production assets globally under verified SSL endpoints (`*.web.app` / `*.firebaseapp.com`).

---

## 🏗️ Architecture & Security

- **Front-End**: React 18, Vite, Tailwind CSS v4 (Glassmorphism, custom transitions, responsive layout).
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
Open [http://localhost:5173](http://localhost:5173) in your browser to view the application.

### 5. Seeding Demo Data
To test the Kanban layout and analytics dashboards immediately with realistic metrics:
1. Navigate to **Settings** in the sidebar.
2. Click the **Seed Demo Tasks** button.
3. Five tasks with rich histories (including deferral logs, prioritization tags, and completions) will be written to your database.

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
