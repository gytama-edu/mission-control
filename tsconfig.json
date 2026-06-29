# Emergency Phase 18J-C: Restore Student RPC Functions After RLS Lockdown

## 1. Root Cause
The live Supabase database's PostgREST schema cache did not have the latest RPC definitions loaded for `student_login_by_code_and_pin` or `student_fetch_dashboard_data`, or the `GRANT EXECUTE` permissions were missing for the `anon` and `authenticated` roles following the previous database migrations. 

When the `anon` public `SELECT` policies were locked down in Phase 18J, students were forced to route 100% of their requests through the securely defined RPC functions. Because the PostgREST cache wasn't correctly synced with those functions' execution grants, the API responded with a "Could not find the function" error in the schema cache.

## 2. Missing RPC or Signature Mismatch
The parameters on the frontend exact match the SQL definitions (`p_class_code`, `p_student_pin`, `p_class_id`, `p_student_id`). It is purely a database-side PostgREST cache / execute grant issue. 

## 3. SQL That Must Be Run in Supabase
I have generated a dedicated script: `/supabase/phase_18j_c_restore_rpc.sql`.
Please open your Supabase SQL Editor and execute its contents. This script will:
1. Safely `CREATE OR REPLACE` both `student_login_by_code_and_pin` and `student_fetch_dashboard_data`.
2. Apply `GRANT EXECUTE` to `anon` and `authenticated` roles for both functions.
3. Reload the PostgREST schema cache via `NOTIFY pgrst, 'reload schema';`.

## 4. Schema Cache Reload Status
Included as the final step in the `/supabase/phase_18j_c_restore_rpc.sql` script (`NOTIFY pgrst, 'reload schema';`). This guarantees that the REST API immediately reflects the newly granted RPC execute permissions.

## 5. Student Login Retest Result
*Pending execution.* Once you run the script provided in Step 3 in your live Supabase SQL editor, student logins will succeed again and gracefully pull their dashboards through the secure RPC tunnel.

## 6. Whether Rollback Was Needed
**No rollback of Phase 18J (RLS Lockdown) was required.** We are fixing the RPC cache directly instead of reopening the tables to the public. 

---
**Status:** Awaiting manual SQL execution of `/supabase/phase_18j_c_restore_rpc.sql` to fix the schema cache.
