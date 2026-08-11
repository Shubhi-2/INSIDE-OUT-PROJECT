# INSIDE OUT — Product Requirements

## Concept
AI-powered physical technology learning and reverse-engineering platform.
Tagline: **See it. Understand it. Reverse it. Build it.**

## MVP Core Loop
SCAN → IDENTIFY → EXPLAIN → DECOMPOSE → REVERSE ENGINEER → CHAT

## Stack
- Frontend: Expo Router (React Native), dark-first blueprint theme
- Backend: FastAPI + MongoDB
- AI: Claude Sonnet 4.6 (vision + reasoning) via Emergent LLM Key
- Image gen: Gemini Nano Banana (exploded diagrams) via Emergent LLM Key
- Auth: JWT email/password

## Core Screens
- Sign In / Sign Up (JWT)
- Home (3 primary actions, XP, recent projects)
- Scan (image picker → base64)
- Analysis Result (INSIDE OUT LAYERS 1-8, confidence badges)
- BOM viewer
- AI Engineer chat
- Projects list, Profile

## Signature Features
- **INSIDE OUT LAYERS** (1 Surface → 8 Build)
- **AI Confidence Transparency**: VERIFIED / INFERRED / ESTIMATED / UNKNOWN
- Response format: 🔎 What I See, 🧩 Components, ⚡ How It Works, 🔗 Connections, 🧠 Why, 🛠 Rebuild, 💰 Cost, ⚠️ Safety
