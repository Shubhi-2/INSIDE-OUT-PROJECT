# INSIDE OUT

Expo mobile app for AI-powered reverse-engineering of physical devices.

## Backend

The FastAPI/Mongo backend is **replaced by Firebase (Spark)**:

- **Auth** — Firebase Email/Password  
- **Data** — Cloud Firestore  
- **Images** — Firebase Storage (with Firestore data-URL fallback)  
- **AI** — Gemini from the client (`@google/generative-ai`)

See [FIREBASE.md](FIREBASE.md) for project setup (`inside-out-57b55`).

Legacy server code remains under `backend/` for reference only and is not required at runtime.

## Frontend

```bash
cd frontend
npm install
npx expo start
```

Configure `frontend/.env` from `frontend/.env.example`.
