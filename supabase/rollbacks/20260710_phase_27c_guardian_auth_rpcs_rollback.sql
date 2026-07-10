-- Phase 27C rollback: Guardian authentication RPCs
-- Run only when intentionally reverting Phase 27C.

begin;

revoke all on function public.guardian_end_session(text) from public, anon, authenticated;
revoke all on function public.guardian_fetch_dashboard(text) from public, anon, authenticated;
revoke all on function public.guardian_begin_session(text, text) from public, anon, authenticated;

drop function if exists public.guardian_end_session(text);
drop function if exists public.guardian_fetch_dashboard(text);
drop function if exists public.guardian_begin_session(text, text);

drop index if exists public.guardian_access_credentials_lookup_key_unique_idx;

alter table public.guardian_access_credentials
  drop constraint if exists guardian_access_credentials_lookup_key_format;

alter table public.guardian_access_credentials
  drop column if exists lookup_key;

commit;
