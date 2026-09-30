# VoxFlow - AI Vocal Coach with Lyra 🎤✨

> Interactive prototype built for the **AssemblyAI Voice Agent Hackathon** on [lablab.ai](https://lablab.ai/ai-hackathons/assemblyai-voice-agent-hackathon).

**VoxFlow** is an interactive AI vocal coach that guides singers and music enthusiasts through real-time vocal warm-up routines, pedagogical exercises, and song practice. Powered by **Lyra** on the **AssemblyAI Voice Agent API**, it delivers end-to-end speech-to-speech interaction with ultra-low latency, fluid interruptions (*barge-in*), bilingual code-switching, and voice-driven tool calling.

---

## 🌟 Key Features

1. **End-to-End Conversational Voice:** Fluid, low-latency speech-to-speech dialogue powered by the AssemblyAI Voice Agent API.
2. **Default English with Voice "Eve":** Warm, natural, and expressive English vocal coaching voice by default.
3. **Bilingual Mastery & Code-Switching ("Lola" for Spanish):** Seamlessly detects language switches. When Spanish or mixed Spanglish is spoken, Lyra automatically responds in fluent Spanish and switches to AssemblyAI's native Spanish voice **Lola**.
4. **Natural Turn Detection & Interruption Handling (Barge-in):** You can interrupt Lyra at any moment during explanations or vocal instructions. The client audio immediately stops and Lyra prioritizes your question.
5. **Hands-Free Interface Control via Tool Calling:**
   - `show_vocal_tip`: Displays visual anatomical/pedagogical guidance cards on screen (diaphragmatic breath, lip trills, head voice, posture, sirens).
   - `control_accompaniment`: Starts or stops the active accompaniment and reports the actual browser playback state.
   - `adjust_accompaniment`: Applies relative or absolute changes to accompaniment pitch, speed, and volume.
   - `switch_language`: Updates the interface language while preserving the voice selected before the session.
   - `select_exercise`: Switches the active vocal warm-up routine upon voice command.
6. **High-Performance Audio Pipeline:** Utilizes browser `AudioWorklet` to stream 16-bit linear PCM audio at 24 kHz directly to AssemblyAI via base64 JSON frames, coupled with a seamless streaming PCM audio queue.
7. **Secure Proxy Architecture:** Your secret AssemblyAI API key is never exposed to the client browser. The Python FastAPI backend acts as a secure, authenticated WebSocket proxy.

---

## 🛠️ Tech Stack

- **Frontend:** React 19, Vite 8, Tailwind CSS v4, Lucide Icons, Web Audio API (`AudioWorklet`). Package Manager: **pnpm**.
- **Backend:** Python 3.10+, FastAPI, Uvicorn, WebSockets, Pydantic Settings.
- **AI Voice Engine:** [AssemblyAI Voice Agent API](https://www.assemblyai.com/docs/voice-agents/voice-agent-api).

---

## 🚀 Quickstart Guide

### 1. Configure Environment Variables

#### Backend (`backend/.env`):
Create or edit `backend/.env` and add your AssemblyAI API key:
```ini
ASSEMBLYAI_API_KEY=your_assemblyai_api_key_here
ENVIRONMENT=development
PORT=8000
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
ASSEMBLYAI_WS_URL=wss://agents.assemblyai.com/v1/ws
```

#### Frontend (`frontend/.env.development`):
Ensure the development environment points to your local backend:
```ini
VITE_API_BASE_URL=http://localhost:8000/api
VITE_WS_PROXY_URL=ws://localhost:8000/ws/agent
```

---

### 2. Start the Backend (FastAPI)

```bash
cd backend

# Activate virtual environment (Windows PowerShell)
.\.venv\Scripts\Activate.ps1

# Launch the FastAPI server
uvicorn app.main:app --reload --port 8000
```

The backend will be running at `http://localhost:8000`. You can verify connection status at `http://localhost:8000/api/health`.

---

### 3. Start the Frontend (Vite + PNPM)

In a new terminal:
```bash
cd frontend

# Run the development server with pnpm
pnpm dev
```

Open your browser at `http://localhost:5173`. Click **"Start with Lyra"**, allow microphone permissions, and start speaking with your vocal coach!

---

## 💡 Voice Interaction Examples

- *"Hi Lyra! I'd like to warm up my voice for a performance."*
- *"How do I do a proper lip trill?"* *(Lyra will explain and render the technique tip on your screen)*.
- *"This section is too high for me, can you lower the key by one semitone?"* *(Lyra will adjust the pitch settings)*.
- *"¿Lyra, podemos practicar en español?"* *(Lyra will switch to Spanish and activate the 'Lola' voice profile)*.
- *"Let's move to vocal sirens."* *(Lyra will switch the active exercise)*.

---

## 📁 Monorepo Layout

```text
ai-voice-agent/
├── AGENTS/             # Agent guidelines and system prompts (GEMINI.md)
├── CONTEXT/            # Roadmap and priority task tracking (tasks.md)
├── IDEAS/              # Concept and architecture specifications
├── backend/            # FastAPI Server & WebSocket Proxy
│   ├── app/
│   │   ├── api/        # REST endpoints (/health, /exercises, /tips)
│   │   ├── core/       # Settings and Lyra prompt/tools configuration
│   │   ├── services/   # Secure WebSocket proxy to AssemblyAI
│   │   └── main.py     # Main application entry point
│   ├── .env.example
│   ├── Dockerfile      # Production deployment ready (Render / Railway)
│   └── requirements.txt
├── frontend/           # React 19 + Vite 8 + Tailwind CSS v4 Client
│   ├── public/         # AudioWorklet processor (audio-recorder-worklet.js)
│   ├── src/
│   │   ├── audio/      # StreamingPCMPlayer with barge-in support
│   │   ├── components/ # VoiceOrb, TipCard, ExerciseSelector, TranscriptView, Header
│   │   ├── hooks/      # useVoiceAgent (WebSocket orchestration & microphone)
│   │   └── App.jsx
│   ├── package.json
│   └── vite.config.js
├── .gitignore
└── README.md
```

---

## 📄 License

Developed for the AssemblyAI Voice Agent Hackathon on lablab.ai.
