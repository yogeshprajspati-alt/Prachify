# Geet 🎵 
*Formerly Prachify*

An intimate, premium, minimalist music streaming web application curated specifically for late-night emotional vibes. Built with a focus on seamless performance, a distraction-free experience, and deeply personalized AI capabilities.

## ✨ Key Features

### 🤖 AI-Powered Experience
* **Hannah AI Copilot:** A deeply integrated, warm, conversational AI companion that acts as your personal DJ.
* **Voice Interactions:** Speak your mind using the built-in microphone feature powered by Whisper (speech-to-text) to search, chat, or request songs.
* **Hannah's Choice:** Intelligent home page recommendations powered by `openai/gpt-oss-120b`, learning from your listening history and actively tracking your taste drift.
* **Smart Search Optimizer:** Converts messy, natural language queries ("sad songs for a rainy evening") into clean search terms via AI.
* **AI Smart Queue (Auto-Radio):** Automatically queues similar songs endlessly when your playlist finishes.

### 🎧 Pro Player Capabilities
* **Karaoke Mode:** Real-time synced lyrics that auto-scroll and highlight the current line.
* **Speed Control:** Slow down to 0.75x to learn a song, or speed up to 1.5x.
* **A-B Looping:** Loop a specific section of a track to hear your favorite part repeatedly.
* **Skip Counter:** The app tracks frequently skipped songs and actively removes them from your recommendations.

### 📱 Premium UX
* **Crossfade & Background Playback:** Seamless 400ms crossfade between tracks with auto-resume on mobile.
* **Progressive Web App (PWA):** Install natively on your mobile phone or desktop with an offline network guard.
* **Dynamic Profiles & Security:** Multi-profile support with a self-service dynamic PIN authentication flow and security questions.
* **Volume Fade on Call:** Intelligent volume ducking when switching tabs or taking calls.

## 🚀 Tech Stack
* **Frontend:** React 19, TailwindCSS v4, Vite, Zustand
* **Audio Engine:** Howler.js for robust, low-latency audio manipulation.
* **Backend:** JioSaavn API for music catalog.
* **AI Models:** Groq API (running `openai/gpt-oss-120b`, `qwen/qwen3.6-27b`, and `whisper-large-v3`).
* **Caching:** Workbox for offline PWA capabilities.

## 🛠️ Setup for Development

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd prachify-main
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Variables:**
   Copy the example environment file and fill in your Supabase and Groq keys.
   ```bash
   cp .env.example .env
   ```
   *Note: Provide comma-separated keys in `VITE_GROQ_API_KEY` for automatic rate-limit rotation.*

4. **Run the dev server:**
   ```bash
   npm run dev
   ```

## 📦 Deployment
The application is built to be hosted on any modern static hosting provider (Vercel, Netlify, Cloudflare Pages). 
Run the build command:
```bash
npm run build
```
The output will be inside the `dist` directory. Ensure that your host is set to rewrite all routes to `index.html` (SPA routing).

---
*Built with ❤️ for when the world is quiet.*
