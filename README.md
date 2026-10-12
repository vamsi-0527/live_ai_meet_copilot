# Live AI Meeting Copilot

A high-performance, real-time AI assistant built for live meeting augmentation. This application handles continuous audio capture, multi-stage reasoning (suggestions + chat), and secure data management using a locally-stored, server-proxied API strategy.

## Vision & Purpose

TwinMind is designed to solve the "Context Gap" during live meetings. By transcribing audio in 15-second windows and using Large Language Models (LLMs) to reason over that text immediately, the app surfaces actionable insights while the user is still speaking.

---

## System Architecture

### 1. Audio Processing Pipeline
*   **Capture**: Browser `MediaRecorder` API captures audio in `audio/webm` format.
*   **Segmentation**: Instead of using silence detection (which adds latency), we use a **15-second rotating buffer**. Every 15 seconds, the recorder flushes its buffer to ensure the system is always processing recent context.
*   **Transcription**: Audio blobs are converted to Base64 and proxied via Next.js routes to the **Groq Whisper-Large-V3** model.

### 2. Multi-Stage Reasoning (The "Brain")
*   **Stage 1: Real-time Suggestions**: A sliding window of the last 10 transcription batches is sent to **Llama 3.3 70B**. It generates exactly 3 categorized suggestions:
    *   `Question`: Deep curiosity to move the meeting forward.
    *   `Talking Point`: Data or context to support the current speaker.
    *   `Answer`: Rapid response to questions asked in the transcript.
    *   `Fact`: Real-time fact-checking of claims.
*   **Stage 2: Detailed Expansion**: Clicking a suggestion triggers a specialized prompt that treats the suggestion as a research query against the entire meeting history.
*   **Stage 3: Interactive Chat**: A dedicated chat session allowing for ad-hoc follow-up questions with memory of previous chat turns.

### 3. Security & BYOK (Bring Your Own Key)
*   **The Problem**: Conventional BYOK apps store keys in `localStorage`, where they can be stolen by any malicious browser extension or script (XSS).
*   **The Solution**: We implemented a **Secure Proxy Pattern**.
    *   User enters their key on the `/settings` page.
    *   A **Next.js Server Action** sets the key as an **HttpOnly, Secure, SameSite=Strict Cookie**.
    *   JavaScript on the frontend *cannot* see or touch the key.
    *   The browser automatically attaches the cookie to our internal `/api` routes, where the server extracts it and makes the final request to Groq.

---

## Tech Stack

| Layer | Technology | Rationale |
| :--- | :--- | :--- |
| **Framework** | Next.js 14 (App Router) | Server-side security and edge-ready routes. |
| **Styling** | Tailwind CSS | Rapid UI iteration with a "Dark/Cyber" aesthetic. |
| **State** | Zustand | Lightweight, multi-column state sync without prop-drilling. |
| **Inference** | Groq Cloud | Sub-second latency for 70B parameter models. |
| **Models** | Llama 3.3 70B & Whisper V3 | Best-in-class performance-to-latency ratio. |

---

## Prompt Strategy

We utilize **Structured Context Injection**. Instead of dumping the entire transcript, we format it as a timestamped "Conversation Log":

```text
[10:05 AM] User A: "We need to scale the database by Q3."
[10:05 AM] User B: "Which database, the legacy one or the new RDS?"
```

This timestamped format helps the model understand **recency weighting**, ensuring suggestions are relevant to the *immediate* moment rather than a topic discussed 20 minutes ago.

---

## Configuration & Customization

The app includes a comprehensive **Advanced Settings** suite:
*   **Custom Prompts**: Every AI layer (Suggestions, Expansion, Chat) has a user-editable "System Message."
*   **Sizing Windows**: Adjust how many batches of history the AI "looks back" at for suggestions or chat answers.
*   **Default Defaults**: Hardcoded with optimal prompt engineering patterns found through rigorous testing during the development phase.

---

## Data Persistence & Export

*   **Session-Only**: In compliance with privacy standards, no meeting data is stored in any database. Refreshing the tab wipes all local stores.
*   **One-Click Export**: Generates a `.txt` bundle of:
    1.  Full Timestamped Transcript.
    2.  All AI-generated Suggestion Batches.
    3.  Complete Chat History (Questions & Detailed Answers).

---

## Setup Instructions

```bash
# 1. Clone & Install
git clone https://github.com/your-repo/twinmind.git
npm install

# 2. Run Local
npm run dev
```

1.  Navigate to **Settings**.
2.  Input your **Groq API Key**.
3.  Customize your **Prompts**.
4.  Start your meeting!
