CREATE TABLE IF NOT EXISTS "note" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"trashedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "note_transcription" (
	"id" text PRIMARY KEY NOT NULL,
	"noteId" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"provider" text DEFAULT 'local' NOT NULL,
	"mode" text,
	"language" text DEFAULT 'en' NOT NULL,
	"model" text,
	"transcriptText" text DEFAULT '' NOT NULL,
	"finalText" text DEFAULT '' NOT NULL,
	"interimText" text DEFAULT '' NOT NULL,
	"segments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"lastSegmentIndex" integer,
	"durationSeconds" double precision DEFAULT 0 NOT NULL,
	"recordingDurationSeconds" double precision DEFAULT 0 NOT NULL,
	"error" text,
	"startedAt" timestamp,
	"completedAt" timestamp,
	"lastPartialAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "note" ADD CONSTRAINT "note_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "note_transcription" ADD CONSTRAINT "note_transcription_noteId_note_id_fk" FOREIGN KEY ("noteId") REFERENCES "public"."note"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "note_userId_idx" ON "note" ("userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "note_userId_updatedAt_idx" ON "note" ("userId","updatedAt");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "note_transcription_noteId_idx" ON "note_transcription" ("noteId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "note_transcription_status_idx" ON "note_transcription" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "note_transcription_noteId_updatedAt_idx" ON "note_transcription" ("noteId","updatedAt");