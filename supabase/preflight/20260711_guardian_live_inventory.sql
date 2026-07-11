-- Phase 27G: Guardian Portal live database inventory
--
-- READ-ONLY. Safe to run before any Guardian migration.
-- Run in Supabase SQL Editor or with psql as a database owner.
-- Save the complete result before making production changes.
--
-- Mission Control legacy objects are expected in public. Supabase-managed auth,
-- storage, realtime, and extensions schemas are excluded so internal columns
-- such as auth.refresh_tokens.parent do not become false positives.

begin transaction read only;

select
  'environment' as section,
  current_database() as database_name,
  current_user as database_user,
  current_timestamp as inspected_at,
  current_setting('server_version') as postgres_version;

select
  'extensions' as section,
  e.extname,
  n.nspname as extension_schema,
  e.extversion
from pg_extension e
join pg_namespace n on n.oid = e.extnamespace
where e.extname = 'pgcrypto';

with approved(object_name) as (
  values
    ('guardian_access_credentials'),
    ('guardian_sessions'),
    ('guardian_access_credentials_active_state_idx'),
    ('guardian_sessions_active_credential_idx'),
    ('guardian_sessions_expiry_cleanup_idx'),
    ('guardian_access_credentials_lookup_key_unique_idx')
)
select
  'matching_public_relations' as section,
  c.relname as object_name,
  case c.relkind
    when 'r' then 'table'
    when 'p' then 'partitioned table'
    when 'i' then 'index'
    when 'v' then 'view'
    when 'm' then 'materialized view'
    when 'S' then 'sequence'
    else c.relkind::text
  end as object_type,
  c.relrowsecurity as row_level_security_enabled,
  case when a.object_name is not null
    then 'APPROVED_NAME_REVIEW_DEFINITION'
    else 'BLOCKER_UNEXPECTED_OBJECT'
  end as release_status
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join approved a on a.object_name = c.relname
where n.nspname = 'public'
  and (c.relname ilike '%guardian%' or c.relname ilike '%parent%')
order by c.relname;

select
  'matching_public_columns' as section,
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default,
  case
    when table_name = 'guardian_access_credentials'
      and column_name in (
        'id', 'student_id', 'secret_hash', 'secret_hint', 'is_active',
        'expires_at', 'last_used_at', 'failed_attempts', 'locked_until',
        'created_by', 'created_at', 'updated_at', 'rotated_at', 'lookup_key'
      ) then 'APPROVED_COLUMN'
    when table_name = 'guardian_sessions'
      and column_name in (
        'id', 'credential_id', 'session_hash', 'expires_at', 'revoked_at',
        'created_at', 'last_used_at'
      ) then 'APPROVED_COLUMN'
    else 'BLOCKER_UNEXPECTED_COLUMN'
  end as release_status
from information_schema.columns
where table_schema = 'public'
  and (
    table_name ilike '%guardian%'
    or table_name ilike '%parent%'
    or column_name ilike '%guardian%'
    or column_name ilike '%parent%'
  )
order by table_name, ordinal_position;

with approved(function_name) as (
  values
    ('guardian_revoke_sessions_for_credential'),
    ('guardian_credential_before_update'),
    ('guardian_cleanup_expired_sessions'),
    ('guardian_begin_session'),
    ('guardian_fetch_dashboard'),
    ('guardian_end_session'),
    ('guardian_generate_secret_internal'),
    ('guardian_format_secret_internal'),
    ('guardian_teacher_list_credentials'),
    ('guardian_teacher_create_credential'),
    ('guardian_teacher_rotate_credential'),
    ('guardian_teacher_set_credential_active')
)
select
  'matching_public_functions' as section,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  pg_get_userbyid(p.proowner) as owner_name,
  p.prosecdef as security_definer,
  case when a.function_name is not null
    then 'APPROVED_NAME_REVIEW_DEFINITION'
    else 'BLOCKER_UNEXPECTED_FUNCTION'
  end as release_status
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
left join approved a on a.function_name = p.proname
where n.nspname = 'public'
  and (p.proname ilike '%guardian%' or p.proname ilike '%parent%')
order by p.proname, identity_arguments;

select
  'matching_public_policies' as section,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check,
  'BLOCKER_POLICY_REQUIRES_REVIEW' as release_status
from pg_policies
where schemaname = 'public'
  and (
    tablename ilike '%guardian%'
    or tablename ilike '%parent%'
    or policyname ilike '%guardian%'
    or policyname ilike '%parent%'
  )
order by tablename, policyname;

select
  'matching_public_triggers' as section,
  event_object_table as table_name,
  trigger_name,
  action_timing,
  event_manipulation,
  action_statement,
  case
    when event_object_table = 'guardian_access_credentials'
      and trigger_name = 'guardian_credential_before_update_trigger'
      then 'APPROVED_TRIGGER'
    else 'BLOCKER_UNEXPECTED_TRIGGER'
  end as release_status
from information_schema.triggers
where event_object_schema = 'public'
  and (
    event_object_table ilike '%guardian%'
    or event_object_table ilike '%parent%'
    or trigger_name ilike '%guardian%'
    or trigger_name ilike '%parent%'
  )
order by event_object_table, trigger_name;

select
  'matching_public_table_grants' as section,
  table_name,
  grantee,
  privilege_type,
  is_grantable,
  case when grantee in ('anon', 'authenticated', 'PUBLIC')
    then 'BLOCKER_BROWSER_TABLE_GRANT'
    else 'OWNER_OR_SERVICE_GRANT_REVIEW'
  end as release_status
from information_schema.role_table_grants
where table_schema = 'public'
  and (table_name ilike '%guardian%' or table_name ilike '%parent%')
order by table_name, grantee, privilege_type;

select
  'matching_public_function_grants' as section,
  routine_name,
  grantee,
  privilege_type,
  is_grantable
from information_schema.role_routine_grants
where routine_schema = 'public'
  and (routine_name ilike '%guardian%' or routine_name ilike '%parent%')
order by routine_name, grantee;

-- Catalog-only and safe even when the Supabase migration tracking relation has
-- not been created yet. If present, inspect its records separately after saving
-- this inventory.
select
  'supabase_migration_tracking' as section,
  to_regclass('supabase_migrations.schema_migrations')::text as tracking_relation,
  case
    when to_regclass('supabase_migrations.schema_migrations') is null
      then 'NOT_PRESENT_REVIEW_DEPLOYMENT_METHOD'
    else 'PRESENT_REVIEW_RECORDS'
  end as release_status;

with approved_relations(object_name) as (
  values
    ('guardian_access_credentials'),
    ('guardian_sessions'),
    ('guardian_access_credentials_active_state_idx'),
    ('guardian_sessions_active_credential_idx'),
    ('guardian_sessions_expiry_cleanup_idx'),
    ('guardian_access_credentials_lookup_key_unique_idx')
), approved_functions(function_name) as (
  values
    ('guardian_revoke_sessions_for_credential'),
    ('guardian_credential_before_update'),
    ('guardian_cleanup_expired_sessions'),
    ('guardian_begin_session'),
    ('guardian_fetch_dashboard'),
    ('guardian_end_session'),
    ('guardian_generate_secret_internal'),
    ('guardian_format_secret_internal'),
    ('guardian_teacher_list_credentials'),
    ('guardian_teacher_create_credential'),
    ('guardian_teacher_rotate_credential'),
    ('guardian_teacher_set_credential_active')
), unexpected_relations as (
  select c.oid
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  left join approved_relations a on a.object_name = c.relname
  where n.nspname = 'public'
    and (c.relname ilike '%guardian%' or c.relname ilike '%parent%')
    and a.object_name is null
), unexpected_columns as (
  select 1
  from information_schema.columns
  where table_schema = 'public'
    and (column_name ilike '%guardian%' or column_name ilike '%parent%')
    and table_name not in ('guardian_access_credentials', 'guardian_sessions')
), unexpected_functions as (
  select p.oid
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  left join approved_functions a on a.function_name = p.proname
  where n.nspname = 'public'
    and (p.proname ilike '%guardian%' or p.proname ilike '%parent%')
    and a.function_name is null
), matching_policies as (
  select 1
  from pg_policies
  where schemaname = 'public'
    and (
      tablename ilike '%guardian%'
      or tablename ilike '%parent%'
      or policyname ilike '%guardian%'
      or policyname ilike '%parent%'
    )
), unexpected_triggers as (
  select 1
  from information_schema.triggers
  where event_object_schema = 'public'
    and (
      event_object_table ilike '%guardian%'
      or event_object_table ilike '%parent%'
      or trigger_name ilike '%guardian%'
      or trigger_name ilike '%parent%'
    )
    and not (
      event_object_table = 'guardian_access_credentials'
      and trigger_name = 'guardian_credential_before_update_trigger'
    )
), browser_table_grants as (
  select 1
  from information_schema.role_table_grants
  where table_schema = 'public'
    and (table_name ilike '%guardian%' or table_name ilike '%parent%')
    and grantee in ('anon', 'authenticated', 'PUBLIC')
)
select 'release_blocker_summary' as section, 'unexpected_relations' as blocker, count(*)::bigint as blocker_count
from unexpected_relations
union all
select 'release_blocker_summary', 'unexpected_columns', count(*)::bigint from unexpected_columns
union all
select 'release_blocker_summary', 'unexpected_functions', count(*)::bigint from unexpected_functions
union all
select 'release_blocker_summary', 'matching_policies', count(*)::bigint from matching_policies
union all
select 'release_blocker_summary', 'unexpected_triggers', count(*)::bigint from unexpected_triggers
union all
select 'release_blocker_summary', 'browser_table_grants', count(*)::bigint from browser_table_grants
order by blocker;

rollback;