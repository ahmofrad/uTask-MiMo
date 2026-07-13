-- Add Full-Text Search indexes
-- Migration: 20260703_add_fts_indexes

-- Task FTS index on title and description
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS fts tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("description", '')), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS "Task_fts_idx" ON "Task" USING GIN (fts);

-- Comment FTS index on bodyMarkdown
ALTER TABLE "Comment" ADD COLUMN IF NOT EXISTS fts tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce("bodyMarkdown", ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS "Comment_fts_idx" ON "Comment" USING GIN (fts);

-- CustomFieldValue FTS index on valueText
ALTER TABLE "CustomFieldValue" ADD COLUMN IF NOT EXISTS fts tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce("valueText", ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS "CustomFieldValue_fts_idx" ON "CustomFieldValue" USING GIN (fts);

-- Project FTS index on name and description
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS fts tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("name", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("description", '')), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS "Project_fts_idx" ON "Project" USING GIN (fts);
