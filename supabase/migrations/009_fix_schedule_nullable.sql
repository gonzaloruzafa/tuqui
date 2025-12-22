-- Migration: Fix schedule column to allow NULL for conditional tasks
-- Run on tenant database: ancgbbzvfhoqqxiueyoz

-- Allow NULL in schedule column for conditional tasks
ALTER TABLE prometeo_tasks ALTER COLUMN schedule DROP NOT NULL;

-- Verify
SELECT column_name, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'prometeo_tasks' AND column_name = 'schedule';
