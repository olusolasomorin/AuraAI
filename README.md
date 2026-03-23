# 🧠 Aura AI - Multimodal Emotional Companion

Aura AI is a real-time, multimodal emotional companion and journaling platform built for the **Reanest Hackathon**. 

In high-pressure environments, the hardest challenge isn't always the workload—it’s managing the mental toll and finding a safe space to decompress. Aura AI serves as a "digital first-aid kit for the mind," leveraging real-time voice and video processing to provide empathetic, conversational support and automated emotional tracking.

---

## 🚨 Important Note for Hackathon Judges (Live Demo)
This project is deployed using a serverless architecture on Google Cloud Run with an SQLite database. Because serverless containers spin down when idle, **the database resets periodically**. 

**When testing the live URL, please click "Sign Up" to create a fresh test account.** Previously created accounts may not persist between sessions due to the ephemeral nature of the cloud environment.


## 🌐 How to Use the Live App (For Judges)
Live Demo Link: Already provided in the submission form

**Step 1:** Create a Fresh Account
Because the cloud database resets periodically, please click Sign Up on the login page to create a new test account. You can use any dummy name, email, and password.

**Step 2:** Explore the Dashboard
Once logged in, you will land on your personal dashboard. Here you can toggle between your Session Journals (which will be empty at first) and a library of Coping Strategies designed for immediate grounding.

**Step 3:** Start a Live AI Session
Click the "Start AI Session" button.

Note: Your browser will ask for Microphone and Camera permissions. These are required for the Gemini Live API to process your voice and facial expressions. No audio or video data is recorded or stored.

**Step 4:** Talk to Aura
Once the interface loads, just start talking!

Speak naturally about your day, or anything bothering you.

You can toggle your microphone or switch your camera view using the on-screen controls.

Emergency Protocol Test: If you want to test the safety guardrails, mention feeling in severe danger or distress. Aura will instantly trigger the Emergency Resources modal.

**Step 5:** End the Session (The Magic Part)
When you are done talking, click the red End Session (Power) button.

Do not refresh the page. * Wait about 5-6 seconds. In the background, Aura is silently executing a tool to summarize your entire conversation and assess your mood.

You will be automatically redirected back to your dashboard once the AI finishes writing your journal.

**Step 6:** Read Your Journal
Back on the dashboard, you will see your newly generated session card complete with a date and mood tag. Click "Read Full Entry" to open the sleek modal and read the clinical summary Aura wrote for you!

---

## ✨ Key Features

* 🎙️ **Real-Time Active Listening:** Built using the Google Gemini Live API via bi-directional WebSockets, Aura processes voice and facial expressions in real-time to provide conversational, empathetic support.
* 📝 **Zero-Click Automated Journaling:** When a session ends, the AI silently executes a background tool to generate a clinical summary and mood analysis of the conversation, instantly saving it to the user's dashboard.
* 🌬️ **Coping Strategies Library:** A built-in UI toolkit of grounding exercises (like 4-7-8 breathing and Cognitive Behavioral Therapy reframing) right at the user’s fingertips.
* 🏥 **Emergency Safety Protocol:** A custom-engineered safety guardrail. If the AI detects signs of severe distress or self-harm, it triggers a system override to instantly push local mental health crisis hotlines to the user's screen.

---

## 🛠️ Tech Stack

**Frontend (Deployed on Vercel):**
* React.js (Vite)
* Tailwind CSS (Styling & Animations)
* Lucide React (Icons)
* React Router (SPA Navigation)

**Backend (Deployed on Google Cloud Run):**
* FastAPI (Python)
* Google GenAI SDK (Gemini 2.5 Flash Native Audio Preview)
* WebSockets (Real-time audio/video streaming)
* SQLite (Database)

---

## ⚙️ How the Architecture Works

1.  **The Live Connection:** The React frontend captures raw PCM audio and video frames using the browser's MediaDevices API and sends them over a secure WebSocket (`wss://`) to the FastAPI backend.
2.  **The AI Stream:** FastAPI acts as a bridge, instantly forwarding the media chunks to Google's Gemini Live API. Gemini streams audio responses back down the pipe, which the React app decodes and plays using the Web Audio API.
3.  **The Automated Journal:** When the user clicks "End Session", the frontend sends a silent `end_session` trigger. The backend intercepts this, forces the AI to execute a `save_journal_entry` function call using the context of the live conversation, saves the output to SQLite, and signals the frontend to route the user to their updated dashboard.

---

## 🚀 Running the Project Locally

If you wish to run the code on your local machine:

### 1. Clone the repository
```bash
git clone [https://github.com/YOUR_GITHUB_USERNAME/aura-ai.git](https://github.com/YOUR_GITHUB_USERNAME/aura-ai.git)
cd aura-ai
```
### 2. Setup the backend
```bash
cd backend
python -m venv virtual_env
source virtual_env/Scripts/activate  # (Windows: virtual_env\Scripts\activate)
pip install -r requirements.txt
```

**Create a .env file in the backend directory and add your Gemini API Key:**
```bash
GEMINI_API_KEY=your_api_key_here
```

**Run the FastAPI server:**
```bash
uvicorn main:app --reload --port 8000
```

### 3. Setup the Frontend
**Open a new terminal window:**
```bash
cd frontend
npm install
npm run dev
```