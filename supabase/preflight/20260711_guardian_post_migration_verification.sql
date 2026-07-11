-- Phase 27G: Guardian Portal post-migration production verification
--
-- READ-ONLY. Run only after applying Phase 27B, 27C, and 27D in order.
-- Every critical_check row must return PASS before deploying the frontend.

begin transaction read only;

-- Critical object checks.
with checks(check_name, passed, detail) as (
  values
    (
      'pgcrypto_installed_in_extensions',
      exists (
        select 1
        from pg_extension e
        join pg_namespace n on n.oid = e.extnamespace
        where e.extname = 'pgcrypto' and n.nspname = 'extensions'
      ),
      'pgcrypto must exist in schema extensions'
    ),
    (
      'guardian_access_credentials_exists',
      to_regclass('public.guardian_access_credentials') is not null,
      'credential table must exist'
    ),
    (
      'guardian_sessions_exists',
      to_regclass('public.guardian_sessions') is not null,
      'session table must exist'
    ),
    (
      'credentials_rls_enabled',
      coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.guardian_access_credentials')), false),
      'RLS must be enabled on credentials'
    ),
    (
      'sessions_rls_enabled',
      coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.guardian_sessions')), false),
      'RLS must be enabled on sessions'
    ),
    (
      'no_guardian_table_policies',
      not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename in ('guardian_access_credentials', 'guardian_sessions')
      ),
      'Guardian tables intentionally have no direct browser policies'
    ),
    (
      'anon_has_no_credentials_table_access',
      not has_table_privilege('anon', 'public.guardian_access_credentials', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),
      'anon must have no direct credential-table privileges'
    ),
    (
      'authenticated_has_no_credentials_table_access',
      not has_table_privilege('authenticated', 'public.guardian_access_credentials', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),
      'authenticated must have no direct credential-table privileges'
    ),
    (
      'anon_has_no_sessions_table_access',
      not has_table_privilege('anon', 'public.guardian_sessions', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),
      'anon must have no direct session-table privileges'
    ),
    (
      'authenticated_has_no_sessions_table_access',
      not has_table_privilege('authenticated', 'public.guardian_sessions', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),
      'authenticated must have no direct session-table privileges'
    ),
    (
      'credential_update_trigger_exists',
      exists (
        select 1
        from pg_trigger
        where tgrelid = 'public.guardian_access_credentials'::regclass
          and tgname = 'guardian_credential_before_update_trigger'
          and not tgisinternal
      ),
      'rotation/disable updates must revoke active sessions through the trigger'
    ),
    (
      'lookup_key_is_required',
      exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'guardian_access_credentials'
          and column_name = 'lookup_key'
          and is_nullable = 'NO'
      ),
      'Phase 27C lookup key must be NOT NULL'
    ),
    (
      'lookup_key_unique_index_exists',
      to_regclass('public.guardian_access_credentials_lookup_key_unique_idx') is not null,
      'lookup segment must be unique'
    ),
    (
      'no_plaintext_code_column',
      not exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name in ('guardian_access_credentials', 'guardian_sessions')
          and column_name in (
            'guardian_code', 'parent_code', 'secret', 'session_token',
            'raw_secret', 'plaintext_secret', 'access_code'
          )
      ),
      'no reusable Guardian code or session token may be stored in plaintext'
    )
)
select
  'critical_check' as section,
  check_name,
  case when passed then 'PASS' else 'FAIL' end as status,
  detail
from checks
order by check_name;

-- Expected function definitions and SECURITY DEFINER posture.
with expected(function_name, identity_arguments, public_surface) as (
  values
    ('guardian_revoke_sessions_for_credential', 'p_credential_id uuid', 'internal'),
    ('guardian_credential_before_update', '', 'internal'),
    ('guardian_cleanup_expired_sessions', 'p_retention interval', 'internal'),
    ('guardian_begin_session', 'p_class_code text, p_guardian_secret text', 'guardian'),
    ('guardian_fetch_dashboard', 'p_session_token text', 'guardian'),
    ('guardian_end_session', 'p_session_token text', 'guardian'),
    ('guardian_generate_secret_internal', '', 'internal'),
    ('guardian_format_secret_internal', 'p_secret text', 'internal'),
    ('guardian_teacher_list_credentials', 'p_class_id uuid', 'teacher'),
    ('guardian_teacher_create_credential', 'p_student_id uuid', 'teacher'),
    ('guardian_teacher_rotate_credential', 'p_student_id uuid', 'teacher'),
    ('guardian_teacher_set_credential_active', 'p_student_id uuid, p_is_active boolean', 'teacher')
), actual as (
  select
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as identity_arguments,
    p.prosecdef as security_definer,
    p.proconfig,
    p.oid
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname like 'guardian_%'
)
select
  'function_definition_check' as section,
  e.function_name,
  e.identity_arguments,
  e.public_surface,
  case
    when a.oid is null then 'FAIL_MISSING'
    when not a.security_definer then 'FAIL_NOT_SECURITY_DEFINER'
    when not coalesce(a.proconfig @> array['search_path=public, pg_temp'], false)
      then 'FAIL_SEARCH_PATH'
    else 'PASS'
  end as status
from expected e
left join actual a
  on a.function_name = e.function_name
 and a.identity_arguments = e.identity_arguments
order by e.public_surface, e.function_name;

-- Browser execution grants. These are the only approved public surfaces.
with expected_grants(function_signature, anon_execute, authenticated_execute) as (
  values
    ('public.guardian_begin_session(text,text)', true, true),
    ('public.guardian_fetch_dashboard(text)', true, true),
    ('public.guardian_end_session(text)', true, true),
    ('public.guardian_teacher_list_credentials(uuid)', false, true),
    ('public.guardian_teacher_create_credential(uuid)', false, true),
    ('public.guardian_teacher_rotate_credential(uuid)', false, true),
    ('public.guardian_teacher_set_credential_active(uuid,boolean)', false, true),
    ('public.guardian_revoke_sessions_for_credential(uuid)', false, false),
    ('public.guardian_credential_before_update()', false, false),
    ('public.guardian_cleanup_expired_sessions(interval)', false, false),
    ('public.guardian_generate_secret_internal()', false, false),
    ('public.guardian_format_secret_internal(text)', false, false)
)
select
  'function_grant_check' as section,
  function_signature,
  case
    when has_function_privilege('anon', function_signature, 'EXECUTE') = anon_execute
      and has_function_privilege('authenticated', function_signature, 'EXECUTE') = authenticated_execute
      then 'PASS'
    else 'FAIL'
  end as status,
  anon_execute as expected_anon_execute,
  has_function_privilege('anon', function_signature, 'EXECUTE') as actual_anon_execute,
  authenticated_execute as expected_authenticated_execute,
  has_function_privilege('authenticated', function_signature, 'EXECUTE') as actual_authenticated_execute
from expected_grants
order by function_signature;

-- Exact Guardian-table columns. Additional columns require explicit review.
with expected_columns(table_name, column_name) as (
  values
    ('guardian_access_credentials', 'id'),
    ('guardian_access_credentials', 'student_id'),
    ('guardian_access_credentials', 'secret_hash'),
    ('guardian_access_credentials', 'secret_hint'),
    ('guardian_access_credentials', 'is_active'),
    ('guardian_access_credentials', 'expires_at'),
    ('guardian_access_credentials', 'last_used_at'),
    ('guardian_access_credentials', 'failed_attempts'),
    ('guardian_access_credentials', 'locked_until'),
    ('guardian_access_credentials', 'created_by'),
    ('guardian_access_credentials', 'created_at'),
    ('guardian_access_credentials', 'updated_at'),
    ('guardian_access_credentials', 'rotated_at'),
    ('guardian_access_credentials', 'lookup_key'),
    ('guardian_sessions', 'id'),
    ('guardian_sessions', 'credential_id'),
    ('guardian_sessions', 'session_hash'),
    ('guardian_sessions', 'expires_at'),
    ('guardian_sessions', 'revoked_at'),
    ('guardian_sessions', 'created_at'),
    ('guardian_sessions', 'last_used_at')
), actual_columns as (
  select table_name, column_name
  from information_schema.columns
  where table_schema = 'public'
    and table_name in ('guardian_access_credentials', 'guardian_sessions')
)
select
  'column_shape_check' as section,
  coalesce(e.table_name, a.table_name) as table_name,
  coalesce(e.column_name, a.column_name) as column_name,
  case
    when e.column_name is null then 'FAIL_UNEXPECTED_COLUMN'
    when a.column_name is null then 'FAIL_MISSING_COLUMN'
    else 'PASS'
  end as status
from expected_columns e
full join actual_columns a
  on a.table_name = e.table_name
 and a.column_name = e.column_name
order by table_name, column_name;

-- Counts should normally be zero immediately after initial production migration
-- and before a teacher generates the first family code. Non-zero values require
-- explicit confirmation, not automatic deletion.
select
  'data_count_review' as section,
  (select count(*) from public.guardian_access_credentials) as credential_rows,
  (select count(*) from public.guardian_sessions) as session_rows,
  case
    when (select count(*) from public.guardian_access_credentials) = 0
      and (select count(*) from public.guardian_sessions) = 0
      then 'PASS_EMPTY_INITIAL_STATE'
    else 'REVIEW_EXISTING_ROWS'
  end as status;

-- One-row final summary. FAIL must be zero before frontend deployment.
with critical_failures as (
  select count(*) as failure_count
  from (
    select not coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.guardian_access_credentials')), false) as failed
    union all
    select not coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.guardian_sessions')), false)
    union all
    select exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename in ('guardian_access_credentials', 'guardian_sessions')
    )
    union all
    select has_table_privilege('anon', 'public.guardian_access_credentials', 'SELECT,INSERT,UPDATE,DELETE')
    union all
    select has_table_privilege('authenticated', 'public.guardian_access_credentials', 'SELECT,INSERT,UPDATE,DELETE')
    union all
    select has_table_privilege('anon', 'public.guardian_sessions', 'SELECT,INSERT,UPDATE,DELETE')
    union all
    select has_table_privilege('authenticated', 'public.guardian_sessions', 'SELECT,INSERT,UPDATE,DELETE')
  ) failures
  where failed
)
select
  'release_summary' as section,
  failure_count,
  case when failure_count = 0 then 'PASS' else 'FAIL' end as status
from critical_failures;

rollback;