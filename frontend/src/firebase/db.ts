import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  increment,
  writeBatch,
} from 'firebase/firestore';
import { db } from './config';
import { DEFAULT_GEMINI_MODEL, ProjectDoc, UserProfile, ChatMessage } from './models';

function nowIso() {
  return new Date().toISOString();
}

export function toPublicUser(data: any, uid: string): UserProfile {
  return {
    id: uid,
    name: data?.name || 'Engineer',
    email: data?.email || '',
    experience_level: data?.experience_level || 'Beginner',
    xp: data?.xp ?? 0,
    projects_count: data?.projects_count ?? 0,
    preferred_model: data?.preferred_model || DEFAULT_GEMINI_MODEL,
    created_at: data?.created_at,
  };
}

export async function createUserProfile(
  uid: string,
  input: { name: string; email: string; experience_level: string },
): Promise<UserProfile> {
  const profile = {
    id: uid,
    name: input.name,
    email: input.email.toLowerCase(),
    experience_level: input.experience_level || 'Beginner',
    xp: 0,
    projects_count: 0,
    preferred_model: DEFAULT_GEMINI_MODEL,
    created_at: nowIso(),
  };
  await setDoc(doc(db, 'users', uid), profile);
  return toPublicUser(profile, uid);
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return toPublicUser(snap.data(), uid);
}

export async function ensureUserProfile(
  uid: string,
  fallback: { name?: string; email?: string; experience_level?: string },
): Promise<UserProfile> {
  const existing = await getUserProfile(uid);
  if (existing) return existing;
  return createUserProfile(uid, {
    name: fallback.name || 'Engineer',
    email: fallback.email || '',
    experience_level: fallback.experience_level || 'Beginner',
  });
}

export async function updateUserPreferences(
  uid: string,
  update: { preferred_model?: string; experience_level?: string },
): Promise<UserProfile> {
  const ref = doc(db, 'users', uid);
  const payload: Record<string, string> = {};
  if (update.preferred_model != null) payload.preferred_model = update.preferred_model;
  if (update.experience_level != null) payload.experience_level = update.experience_level;
  if (Object.keys(payload).length) await updateDoc(ref, payload);
  const fresh = await getUserProfile(uid);
  if (!fresh) throw new Error('User not found');
  return fresh;
}

export async function listProjects(uid: string): Promise<ProjectDoc[]> {
  // Single-field filter avoids waiting on composite index deploy; sort client-side.
  const q = query(collection(db, 'projects'), where('userId', '==', uid), limit(200));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => {
      const data = d.data() as ProjectDoc;
      const { image_base64: _drop, ...rest } = data as any;
      return { ...rest, id: d.id } as ProjectDoc;
    })
    .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
}

export async function getProject(uid: string, projectId: string): Promise<ProjectDoc | null> {
  const snap = await getDoc(doc(db, 'projects', projectId));
  if (!snap.exists()) return null;
  const data = snap.data() as ProjectDoc;
  if (data.userId !== uid) return null;
  return { ...data, id: snap.id };
}

function stripUndefined<T extends Record<string, any>>(obj: T): T {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as T;
}

export async function upsertProject(project: ProjectDoc, isNew: boolean, uid: string) {
  await setDoc(doc(db, 'projects', project.id), stripUndefined(project as any), { merge: true });
  if (isNew) {
    await updateDoc(doc(db, 'users', uid), {
      projects_count: increment(1),
      xp: increment(25),
    });
  } else {
    await updateDoc(doc(db, 'users', uid), {
      xp: increment(10),
    });
  }
}

export async function deleteProject(uid: string, projectId: string) {
  const proj = await getProject(uid, projectId);
  if (!proj) throw new Error('Not found');

  const chatsSnap = await getDocs(collection(db, 'projects', projectId, 'chats'));
  const batch = writeBatch(db);
  chatsSnap.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(db, 'projects', projectId));
  await batch.commit();

  await updateDoc(doc(db, 'users', uid), {
    projects_count: increment(-1),
  });
}

export async function listChatMessages(uid: string, projectId: string): Promise<ChatMessage[]> {
  const proj = await getProject(uid, projectId);
  if (!proj) return [];
  const q = query(
    collection(db, 'projects', projectId, 'chats'),
    orderBy('created_at', 'asc'),
    limit(500),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ChatMessage, 'id'>) }));
}

export async function addChatMessage(
  projectId: string,
  message: Omit<ChatMessage, 'id'> & { id?: string },
) {
  const id = message.id || doc(collection(db, 'projects', projectId, 'chats')).id;
  const payload: ChatMessage = {
    id,
    role: message.role,
    content: message.content,
    created_at: message.created_at || nowIso(),
    userId: message.userId,
  };
  await setDoc(doc(db, 'projects', projectId, 'chats', id), payload);
  return payload;
}

export async function deleteAllUserData(uid: string) {
  const projects = await listProjects(uid);
  for (const p of projects) {
    const chatsSnap = await getDocs(collection(db, 'projects', p.id, 'chats'));
    const batch = writeBatch(db);
    chatsSnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(doc(db, 'projects', p.id));
    await batch.commit();
  }
  await deleteDoc(doc(db, 'users', uid));
}
