CREATE TABLE IF NOT EXISTS "template" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text,
	"name" text NOT NULL,
	"description" text,
	"body" text DEFAULT '' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "note" ADD COLUMN "templateId" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "template" ADD CONSTRAINT "template_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "template_userId_idx" ON "template" ("userId");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "note" ADD CONSTRAINT "note_templateId_template_id_fk" FOREIGN KEY ("templateId") REFERENCES "public"."template"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "note_templateId_idx" ON "note" ("templateId");