-- Phase 27D rollback: Teacher-owned Guardian credential controls
-- Run only when intentionally reverting Phase 27D.

begin;

drop function if exists public.guardian_teacher_set_credential_active(uuid, boolean);
drop function if exists public.guardian_teacher_rotate_credential(uuid);
drop function if exists public.guardian_teacher_create_credential(uuid);
drop function if exists public.guardian_teacher_list_credentials(uuid);
drop function if exists public.guardian_format_secret_internal(text);
drop function if exists public.guardian_generate_secret_internal();

commit;
