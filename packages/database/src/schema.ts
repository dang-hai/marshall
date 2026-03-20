import { sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type {
  NoteTranscriptionMode,
  NoteTranscriptionProvider,
  NoteTranscriptionSegment,
  NoteTranscriptionStatus,
  NoteTranscriptionUtterance,
} from "@marshall/shared";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expiresAt", { mode: "date" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    activeOrganizationId: text("activeOrganizationId"),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => ({
    userIdIdx: index("session_userId_idx").on(table.userId),
  })
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("accountId").notNull(),
    providerId: text("providerId").notNull(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    idToken: text("idToken"),
    accessTokenExpiresAt: timestamp("accessTokenExpiresAt", { mode: "date" }),
    refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt", { mode: "date" }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index("account_userId_idx").on(table.userId),
  })
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expiresAt", { mode: "date" }).notNull(),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    identifierIdx: index("verification_identifier_idx").on(table.identifier),
  })
);

export const organization = pgTable(
  "organization",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    logo: text("logo"),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
    metadata: text("metadata"),
  },
  (table) => ({
    slugIdx: index("organization_slug_idx").on(table.slug),
  })
);

export const member = pgTable(
  "member",
  {
    id: text("id").primaryKey(),
    organizationId: text("organizationId")
      .notNull()
      .references(() => organization.id),
    userId: text("userId")
      .notNull()
      .references(() => user.id),
    role: text("role").notNull().default("member"),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    organizationIdIdx: index("member_organizationId_idx").on(table.organizationId),
    userIdIdx: index("member_userId_idx").on(table.userId),
  })
);

export const invitation = pgTable(
  "invitation",
  {
    id: text("id").primaryKey(),
    organizationId: text("organizationId")
      .notNull()
      .references(() => organization.id),
    email: text("email").notNull(),
    role: text("role"),
    status: text("status").notNull().default("pending"),
    expiresAt: timestamp("expiresAt", { mode: "date" }).notNull(),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
    inviterId: text("inviterId")
      .notNull()
      .references(() => user.id),
  },
  (table) => ({
    organizationIdIdx: index("invitation_organizationId_idx").on(table.organizationId),
    emailIdx: index("invitation_email_idx").on(table.email),
  })
);

export const note = pgTable(
  "note",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull().default(""),
    body: text("body").notNull().default(""),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
    trashedAt: timestamp("trashedAt", { mode: "date" }),
  },
  (table) => ({
    userIdIdx: index("note_userId_idx").on(table.userId),
    userIdUpdatedAtIdx: index("note_userId_updatedAt_idx").on(table.userId, table.updatedAt),
  })
);

export const noteTranscription = pgTable(
  "note_transcription",
  {
    id: text("id").primaryKey(),
    noteId: text("noteId")
      .notNull()
      .references(() => note.id, { onDelete: "cascade" }),
    status: text("status").$type<NoteTranscriptionStatus>().notNull().default("draft"),
    provider: text("provider").$type<NoteTranscriptionProvider>().notNull().default("local"),
    mode: text("mode").$type<NoteTranscriptionMode>(),
    language: text("language").notNull().default("en"),
    model: text("model"),
    transcriptText: text("transcriptText").notNull().default(""),
    finalText: text("finalText").notNull().default(""),
    interimText: text("interimText").notNull().default(""),
    segments: jsonb("segments")
      .$type<NoteTranscriptionSegment[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    utterances: jsonb("utterances")
      .$type<NoteTranscriptionUtterance[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    lastSegmentIndex: integer("lastSegmentIndex"),
    durationSeconds: doublePrecision("durationSeconds").notNull().default(0),
    recordingDurationSeconds: doublePrecision("recordingDurationSeconds").notNull().default(0),
    error: text("error"),
    startedAt: timestamp("startedAt", { mode: "date" }),
    completedAt: timestamp("completedAt", { mode: "date" }),
    lastPartialAt: timestamp("lastPartialAt", { mode: "date" }),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    noteIdIdx: uniqueIndex("note_transcription_noteId_idx").on(table.noteId),
    statusIdx: index("note_transcription_status_idx").on(table.status),
    noteIdUpdatedAtIdx: index("note_transcription_noteId_updatedAt_idx").on(
      table.noteId,
      table.updatedAt
    ),
  })
);
