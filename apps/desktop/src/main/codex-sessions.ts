import Store from "electron-store";

interface CodexSessionData {
  conversationId: string;
  createdAt: string;
  lastUsedAt: string;
}

interface CodexSessionsStore {
  sessions: Record<string, CodexSessionData>;
}

const store = new Store<CodexSessionsStore>({
  name: "marshall-codex-sessions",
  defaults: {
    sessions: {},
  },
});

export function getConversationId(noteId: string): string | null {
  const sessions = store.get("sessions");
  return sessions[noteId]?.conversationId ?? null;
}

export function setConversationId(noteId: string, conversationId: string): void {
  const sessions = store.get("sessions");
  const now = new Date().toISOString();

  sessions[noteId] = {
    conversationId,
    createdAt: sessions[noteId]?.createdAt ?? now,
    lastUsedAt: now,
  };

  store.set("sessions", sessions);
}

export function updateLastUsed(noteId: string): void {
  const sessions = store.get("sessions");
  if (sessions[noteId]) {
    sessions[noteId].lastUsedAt = new Date().toISOString();
    store.set("sessions", sessions);
  }
}

export function clearConversationId(noteId: string): void {
  const sessions = store.get("sessions");
  delete sessions[noteId];
  store.set("sessions", sessions);
}

export function clearAllSessions(): void {
  store.set("sessions", {});
}
