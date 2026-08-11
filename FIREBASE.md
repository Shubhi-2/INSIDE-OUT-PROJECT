# Firebase (Spark) setup — INSIDE OUT

Project: **inside-out-57b55**

The Expo app no longer needs `EXPO_PUBLIC_BACKEND_URL` or the FastAPI host. Auth, data, and AI run on Firebase + Gemini.

## One-time console steps

1. **Authentication** → Sign-in method → enable **Email/Password**  
   https://console.firebase.google.com/project/inside-out-57b55/authentication/providers

2. **Storage** — not used on Spark. Images are stored as truncated data-URLs on Firestore project docs.

3. **Gemini API** → enable *Generative Language API* for the Google Cloud project, or create a key in [Google AI Studio](https://aistudio.google.com/apikey) and set `EXPO_PUBLIC_GEMINI_API_KEY` in `frontend/.env`.

## Deploy rules

```bash
firebase deploy --only firestore:rules,firestore:indexes --project inside-out-57b55
# after Storage is created:
firebase deploy --only storage --project inside-out-57b55
```

## Frontend env

Copy `frontend/.env.example` → `frontend/.env` (a working `.env` is already present for this project).
