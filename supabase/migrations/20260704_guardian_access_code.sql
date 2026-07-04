ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS guardian_access_code text;
