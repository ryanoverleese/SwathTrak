import type { SpraySession, Tank } from '../types';

const SESSIONS_KEY = 'spraymarker_sessions';
const ACTIVE_SESSION_KEY = 'spraymarker_active_session';

/** Migrate old sessions that have swaths but no tanks */
function migrateSession(raw: any): SpraySession {
  if (raw.tanks && raw.tanks.length > 0) return raw as SpraySession;

  // Old format: swaths lived directly on the session
  const swaths = raw.swaths || [];
  const tank: Tank = {
    id: raw.id + '_t0',
    swaths,
    gallons: raw.gallons,
    startTime: swaths.length > 0 ? swaths[0].startTime : Date.now(),
    endTime: swaths.length > 0 ? swaths[swaths.length - 1].endTime : undefined,
  };

  return {
    ...raw,
    tanks: swaths.length > 0 ? [tank] : [],
    swaths: undefined,
  };
}

export function loadSessions(): SpraySession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    const sessions: any[] = raw ? JSON.parse(raw) : [];
    return sessions.map(migrateSession);
  } catch {
    return [];
  }
}

export function saveSession(session: SpraySession): void {
  const sessions = loadSessions();
  const idx = sessions.findIndex((s) => s.id === session.id);
  if (idx >= 0) {
    sessions[idx] = session;
  } else {
    sessions.unshift(session);
  }
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

export function deleteSession(id: string): void {
  const sessions = loadSessions().filter((s) => s.id !== id);
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

export function renameSession(id: string, name: string): void {
  const sessions = loadSessions();
  const session = sessions.find((s) => s.id === id);
  if (session) {
    session.name = name;
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  }
}

export function saveActiveSession(session: SpraySession): void {
  localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
}

export function loadActiveSession(): SpraySession | null {
  try {
    const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
    if (!raw) return null;
    return migrateSession(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function clearActiveSession(): void {
  localStorage.removeItem(ACTIVE_SESSION_KEY);
}
