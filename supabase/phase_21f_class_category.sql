-- Phase 21F: Class Category Migration
-- Safely add class_category column

ALTER TABLE public.classes
ADD COLUMN IF NOT EXISTS class_category text NOT NULL DEFAULT 'regular'
CHECK (class_category IN ('regular', 'private'));

-- Ensure PostgREST cache is reloaded
NOTIFY pgrst, 'reload schema';
