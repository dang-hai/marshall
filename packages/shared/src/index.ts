// Shared types and utilities

export interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Auth user from Better Auth session */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  image?: string;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Minimal user info for UI display */
export type DisplayUser = Pick<AuthUser, "id" | "email" | "name" | "image">;

export interface Session {
  id: string;
  userId: string;
  expiresAt: Date;
}

export const NOTE_TRANSCRIPTION_STATUSES = [
  "draft",
  "recording",
  "transcribing",
  "completed",
  "failed",
  "cancelled",
] as const;

export type NoteTranscriptionStatus = (typeof NOTE_TRANSCRIPTION_STATUSES)[number];

export const NOTE_TRANSCRIPTION_PROVIDERS = [
  "local",
  "deepgram",
  "assemblyAI",
  "speechmatics",
] as const;

export type NoteTranscriptionProvider = (typeof NOTE_TRANSCRIPTION_PROVIDERS)[number];

export const NOTE_TRANSCRIPTION_MODES = ["streaming", "batch"] as const;

export type NoteTranscriptionMode = (typeof NOTE_TRANSCRIPTION_MODES)[number];

export interface NoteTranscriptionSegment {
  start: number;
  end: number;
  text: string;
}

export interface SaveNoteTranscriptionInput {
  status: NoteTranscriptionStatus;
  provider: NoteTranscriptionProvider;
  mode: NoteTranscriptionMode | null;
  language: string;
  model: string | null;
  transcriptText: string;
  finalText: string;
  interimText: string;
  segments: NoteTranscriptionSegment[];
  lastSegmentIndex: number | null;
  durationSeconds: number;
  recordingDurationSeconds: number;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  lastPartialAt: string | null;
}

export interface NoteTranscriptionSnapshot extends SaveNoteTranscriptionInput {
  id: string;
  noteId: string;
  createdAt: string;
  updatedAt: string;
}

export interface NoteRecord {
  id: string;
  userId: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  trashedAt: string | null;
  transcription: NoteTranscriptionSnapshot | null;
}

export interface CreateNoteInput {
  title?: string;
  body?: string;
  createdAt?: string;
  updatedAt?: string;
  trashedAt?: string | null;
}

export interface UpdateNoteInput {
  title?: string;
  body?: string;
  trashedAt?: string | null;
}

export const APP_NAME = "Marshall";
export const APP_VERSION = "0.0.1";

export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
