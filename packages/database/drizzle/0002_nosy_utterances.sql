ALTER TABLE "note_transcription"
ADD COLUMN "utterances" jsonb DEFAULT '[]'::jsonb NOT NULL;
