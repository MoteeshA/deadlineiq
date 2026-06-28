# 🚀 DeadlineIQ Deployment Guide (Google Cloud & Firebase)

To submit your hackathon project successfully, it must be deployed on **Google Cloud** (using Cloud Run or Firebase Hosting). Follow this step-by-step guide to deploy your project in 10 minutes.

---

## 📦 Option 1: Deploy to Google Cloud Run (Recommended)
Cloud Run runs your containerized React application serverlessly, automatically scaling it.

### Prerequisites
Make sure you have the [Google Cloud SDK (gcloud CLI)](https://cloud.google.com/sdk/docs/install) installed.

### Steps
1. **Open your Terminal** inside the project folder:
   ```bash
   cd /Users/amoteesh/Desktop/deadlineiq
   ```

2. **Login to Google Cloud**:
   ```bash
   gcloud auth login
   ```

3. **Create or Set your Google Cloud Project**:
   ```bash
   gcloud projects create deadlineiq-hackathon --set-as-default
   ```
   *(Or link to an existing project: `gcloud config set project [YOUR_PROJECT_ID]`)*

4. **Deploy with a Single Command**:
   Run this command in the project root. It will package your app using the pre-configured multi-stage `Dockerfile`, build it via Cloud Build, and serve it:
   ```bash
   gcloud run deploy deadlineiq --source . --allow-unauthenticated
   ```
   - When prompted for **Region**, select one close to you (e.g., `us-central1` or `asia-south1`).
   - When asked if you want to enable required APIs, type `y` (yes).

5. **Get Your URL**:
   Once successful, the terminal will print a **Service URL** (e.g., `https://deadlineiq-xxxx-uc.a.run.app`). **Copy this URL** for your BlockseBlock submission!

---

## 🌐 Option 2: Deploy to Google Firebase Hosting
Firebase Hosting is optimized for fast, secure static web application serving.

### Steps
1. **Install the Firebase CLI**:
   ```bash
   npm install -g firebase-tools
   ```

2. **Authenticate with Firebase**:
   ```bash
   firebase login
   ```

3. **Initialize Hosting in the project directory**:
   ```bash
   firebase init hosting
   ```
   - Select **Use an existing project** (choose your Firebase project ID).
   - What do you want to use as your public directory? Type **`dist`**.
   - Configure as a single-page app (rewrite all urls to /index.html)? Type **`Yes`**.
   - Set up automatic builds and deploys with GitHub? Type **`No`**.

4. **Build and Deploy**:
   ```bash
   # Compile production assets
   npm run build

   # Deploy to Firebase Hosting
   firebase deploy --only hosting
   ```

5. **Get Your URL**:
   Firebase will print a Hosting URL (e.g., `https://[your-project-id].web.app`). Copy this link for your submission!

---

## 🔒 Firebase Firestore Rules setup
To secure your data, make sure to publish the project's security rules to your Firestore database.

1. Install Firestore rules via the Firebase Console, or deploy using the CLI:
   ```bash
   firebase deploy --only firestore:rules
   ```
   *(The rules are located in `firestore.rules` and restrict data access exclusively to the authenticated user owning the document).*
