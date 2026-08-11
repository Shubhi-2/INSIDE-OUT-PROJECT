import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  deleteUser,
  updateProfile,
} from 'firebase/auth';
import { auth } from '@/src/firebase/config';
import {
  createUserProfile,
  deleteAllUserData,
  ensureUserProfile,
  getUserProfile,
  updateUserPreferences,
} from '@/src/firebase/db';
import { DEFAULT_GEMINI_MODEL, UserProfile } from '@/src/firebase/models';
import { deleteProjectImage } from '@/src/firebase/storage';
import { listProjects } from '@/src/firebase/db';

export type User = UserProfile;

type Ctx = {
  user: User | null;
  /** Firebase uid — kept as `token` so existing screens keep working */
  token: string | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string, level: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  updatePreferences: (prefs: {
    preferred_model?: string;
    experience_level?: string;
  }) => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      try {
        if (!fbUser) {
          setUser(null);
          setToken(null);
        } else {
          setToken(fbUser.uid);
          const profile = await ensureUserProfile(fbUser.uid, {
            name: fbUser.displayName || undefined,
            email: fbUser.email || undefined,
          });
          setUser(profile);
        }
      } catch {
        if (fbUser) {
          setToken(fbUser.uid);
          setUser({
            id: fbUser.uid,
            name: fbUser.displayName || 'Engineer',
            email: fbUser.email || '',
            experience_level: 'Beginner',
            xp: 0,
            projects_count: 0,
            preferred_model: DEFAULT_GEMINI_MODEL,
          });
        }
      } finally {
        setReady(true);
      }
    });
    return unsub;
  }, []);

  const mapAuthError = (e: any, fallback: string) => {
    const code = e?.code || '';
    if (code === 'auth/email-already-in-use') return 'Email already registered';
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
      return 'Invalid email or password';
    }
    if (code === 'auth/weak-password') return 'Password must be 6+ chars';
    if (code === 'auth/invalid-email') return 'Invalid email address';
    if (code === 'auth/operation-not-allowed') {
      return 'Email/Password sign-in is disabled. Enable it in Firebase Console → Authentication.';
    }
    return e?.message || fallback;
  };

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const profile = await ensureUserProfile(cred.user.uid, {
        name: cred.user.displayName || undefined,
        email: cred.user.email || email,
      });
      setToken(cred.user.uid);
      setUser(profile);
    } catch (e: any) {
      throw new Error(mapAuthError(e, 'Login failed'));
    }
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string, level: string) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (name) {
        try {
          await updateProfile(cred.user, { displayName: name });
        } catch {
          /* optional */
        }
      }
      const profile = await createUserProfile(cred.user.uid, {
        name,
        email,
        experience_level: level,
      });
      setToken(cred.user.uid);
      setUser(profile);
    } catch (e: any) {
      throw new Error(mapAuthError(e, 'Registration failed'));
    }
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
    setToken(null);
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const profile = await getUserProfile(uid);
    if (profile) setUser(profile);
  }, []);

  const updatePreferences = useCallback(
    async (prefs: { preferred_model?: string; experience_level?: string }) => {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('Not signed in');
      const profile = await updateUserPreferences(uid, prefs);
      setUser(profile);
    },
    [],
  );

  const deleteAccount = useCallback(async () => {
    const fbUser = auth.currentUser;
    if (!fbUser) throw new Error('Not signed in');
    const uid = fbUser.uid;
    try {
      const projects = await listProjects(uid);
      for (const p of projects) {
        await deleteProjectImage(uid, p.id);
      }
    } catch {
      /* best-effort storage cleanup */
    }
    await deleteAllUserData(uid);
    await deleteUser(fbUser);
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthCtx.Provider
      value={{
        user,
        token,
        ready,
        signIn,
        signUp,
        signOut,
        refresh,
        updatePreferences,
        deleteAccount,
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const c = useContext(AuthCtx);
  if (!c) throw new Error('useAuth must be inside AuthProvider');
  return c;
}

/** @deprecated Backend API removed — use Firebase helpers instead */
export const API_URL = '';

/** @deprecated Backend API removed — use Firebase helpers instead */
export async function apiFetch(_path: string, _token: string | null, _options: RequestInit = {}) {
  throw new Error('REST backend removed. Use Firebase modules under src/firebase/.');
}
