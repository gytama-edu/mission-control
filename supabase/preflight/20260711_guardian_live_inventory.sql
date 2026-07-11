-- Phase 27G: Guardian Portal live database inventory
--
-- READ-ONLY. Safe to run before any Guardian migration.
-- Run in the Supabase SQL Editor or with psql as a database owner.
-- Save the complete result before making production changes.

begin transaction read only;

select
  'environment' as section,
  current_database() as database_name,
  current_user as database_user,
  current_timestamp as inspected_at,
  current_setting('server_version') as postgres_version;

-- Required extension availability. Phase 27B creates pgcrypto in the extensions
-- schema when it is not already installed.
select
  'extensions' as section,
  e.extname,
  n.nspname as extension_schema,
  e.extversion
from pg_extension e
join pg_namespace n on n.oid = e.extnamespace
where e.extname in ('pgcrypto')
order by e.extname;

-- Any existing Guardian/Parent table is material and must be reviewed. The two
-- guardian_* tables are approved only when they match the Phase 27B definition.
select
  'matching_tables' as section,
  n.nspname as schema_name,
  c.relname as object_name,
  case c.relkind
    when 'r' then 'table'
    when 'p' then 'partitioned table'
    when 'v' then 'view'
    when 'm' then 'materialized view'
    when 'S' then 'sequence'
    else c.relkind::text
  end as object_type,
  c.relrowsecurity as row_level_security_enabled,
  case
    when n.nspname = 'public'
      and c.relname in ('guardian_access_credentials', 'guardian_sessions')
      then 'APPROVED_NAME_REVIEW_DEFINITION'
    else 'BLOCKER_UNEXPECTED_OBJECT'
  end as release_status
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname not in ('pg_catalog', 'information_schema')
  and (
    c.relname ilike '%guardian%'
    or c.relname ilike '%parent%'
  )
order by n.nspname, c.relname;

-- Detect legacy columns added to unrelated tables, such as a plaintext parent
-- code on students or classes.
select
  'matching_columns' as section,
  table_schema,
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default,
  case
    when table_schema = 'public'
      and table_name = 'guardian_access_credentials'
      and column_name in (
        'id', 'student_id', 'secret_hash', 'secret_hint', 'is_active',
        'expires_at', 'last_used_at', 'failed_attempts', 'locked_until',
        'created_by', 'created_at', 'updated_at', 'rotated_at', 'lookup_key'
      ) then 'APPROVED_COLUMN'
    when table_schema = 'public'
      and table_name = 'guardian_sessions'
      and column_name in (
        'id', 'credential_id', 'session_hash', 'expires_at', 'revoked_at',
        'created_at', 'last_used_at'
      ) then 'APPROVED_COLUMN'
    else 'BLOCKER_UNEXPECTED_COLUMN'
  end as release_status
from information_schema.columns
where table_schema not in ('pg_catalog', 'information_schema')
  and (
    table_name ilike '%guardian%'
    or table_name ilike '%parent%'
    or column_name ilike '%guardian%'
    or column_name ilike '%parent%'
  )
order by table_schema, table_name, ordinal_position;

-- Inventory every matching function. Approved names are the complete Phase
-- 27B-27D function surface.
with approved_function_names(function_name) as (
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
  'matching_functions' as section,
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  pg_get_userbyid(p.proowner) as owner_name,
  p.prosecdef as security_definer,
  case
    when n.nspname = 'public' and a.function_name is not null
      then 'APPROVED_NAME_REVIEW_DEFINITION'
    else 'BLOCKER_UNEXPECTED_FUNCTION'
  end as release_status
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
left join approved_function_names a on a.function_name = p.proname
where n.nspname not in ('pg_catalog', 'information_schema')
  and (
    p.proname ilike '%guardian%'
    or p.proname ilike '%parent%'
  )
order by n.nspname, p.proname, identity_arguments;

-- Guardian tables intentionally have RLS enabled with no browser policies.
-- Any legacy Guardian/Parent policy is a release blocker until reviewed.
select
  'matching_policies' as section,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check,
  'BLOCKER_POLICY_REQUIRES_REVIEW' as release_status
from pg_policies
where schemaname not in ('pg_catalog', 'information_schema')
  and (
    tablename ilike '%guardian%'
    or tablename ilike '%parent%'
    or policyname ilike '%guardian%'
    or policyname ilike '%parent%'
  )
order by schemaname, tablename, policyname;

-- Inventory matching triggers. Only the Phase 27B credential-update trigger is
-- approved.
select
  'matching_triggers' as section,
  event_object_schema as schema_name,
  event_object_table as table_name,
  trigger_name,
  action_timing,
  event_manipulation,
  action_statement,
  case
    when event_object_schema = 'public'
      and event_object_table = 'guardian_access_credentials'
      and trigger_name = 'guardian_credential_before_update_trigger'
      then 'APPROVED_TRIGGER'
    else 'BLOCKER_UNEXPECTED_TRIGGER'
  end as release_status
from information_schema.triggers
where
  event_object_table ilike '%guardian%'
  or event_object_table ilike '%parent%'
  or trigger_name ilike '%guardian%'
  or trigger_name ilike '%parent%'
order by event_object_schema, event_object_table, trigger_name;

-- Direct grants on Guardian/Parent relations. Browser-role access to either
-- Guardian table is always a blocker.
select
  'matching_table_grants' as section,
  table_schema,
  table_name,
  grantee,
  privilege_type,
  is_grantable,
  case
    when grantee in ('anon', 'authenticated', 'PUBLIC')
      then 'BLOCKER_BROWSER_TABLE_GRANT'
    else 'OWNER_OR_SERVICE_GRANT_REVIEW'
  end as release_status
from information_schema.role_table_grants
where table_schema not in ('pg_catalog', 'information_schema')
  and (
    table_name ilike '%guardian%'
    or table_name ilike '%parent%'
  )
order by table_schema, table_name, grantee, privilege_type;

-- Function execute grants are reviewed precisely after migrations. This query
-- exposes any pre-existing browser grants before deployment.
select
  'matching_function_grants' as section,
  routine_schema,
  routine_name,
  grantee,
  privilege_type,
  is_grantable
from information_schema.role_routine_grants
where routine_schema not in ('pg_catalog', 'information_schema')
  and (
    routine_name ilike '%guardian%'
    or routine_name ilike '%parent%'
  )
order by routine_schema, routine_name, grantee;

-- Supabase migration history, when available. Absence of rows is not itself a
-- blocker because this repository historically used consolidated SQL files.
select
  'supabase_migration_history' as section,
  version,
  name,
  statements
from supabase_migrations.schema_migrations
where version like '20260710%'
order by version;

-- Compact blocker summary. Zero rows is the expected clean pre-migration result
-- unless approved Phase 27 objects have already been intentionally applied.
with matching_relations as (
  select n.nspname, c.relname
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname not in ('pg_catalog', 'information_schema')
    and (c.relname ilike '%guardian%' or c.relname ilike '%parent%')
),
unexpected_relations as (
  select *
  from matching_relations
  where not (
    nspname = 'public'
    and relname in ('guardian_access_credentials', 'guardian_sessions')
  )
),
unexpected_columns as (
  select table_schema, table_name, column_name
  from information_schema.columns
  where table_schema not in ('pg_catalog', 'information_schema')
    and (column_name ilike '%guardian%' or column_name ilike '%parent%')
    and not (
      table_schema = 'public'
      and table_name in ('guardian_access_credentials', 'guardian_sessions')
    )
),
unexpected_policies as (
  select schemaname, tablename, policyname
  from pg_policies
  where
    tablename ilike '%guardian%'
    or tablename ilike '%parent%'
    or policyname ilike '%guardian%'
    or policyname ilike '%parent%'
)
select 'release_blocker_summary' as section, 'unexpected_relations' as blocker, count(*)::bigint as blocker_count
from unexpected_relations
union all
select 'release_blocker_summary', 'unexpected_columns', count(*)::bigint
from unexpected_columns
union all
select 'release_blocker_summary', 'matching_policies', count(*)::bigint
from unexpected_policies
order by blocker;

rollback;