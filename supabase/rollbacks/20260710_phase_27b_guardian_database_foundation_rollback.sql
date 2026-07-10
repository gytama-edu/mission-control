-- Phase 27B rollback: Guardian Portal database foundation
--
-- Run manually only when Phase 27B must be fully removed.
-- This intentionally destroys all guardian credentials and sessions.

begin;

drop trigger if exists guardian_credential_before_update_trigger
  on public.guardian_access_credentials;

drop function if exists public.guardian_credential_before_update();
drop function if exists public.guardian_cleanup_expired_sessions(interval);
drop function if exists public.guardian_revoke_sessions_for_credential(uuid);

drop table if exists public.guardian_sessions;
drop table if exists public.guardian_access_credentials;

-- pgcrypto and the shared extensions schema are intentionally not dropped.

commit;
