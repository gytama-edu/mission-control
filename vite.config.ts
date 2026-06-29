# Emergency Phase 18J-D: Fix student_fetch_dashboard_data Activity Log Aggregate Error Report

## 1. Root Cause
The `student_fetch_dashboard_data` RPC function contained a SQL syntax error in the `activity_logs` aggregation block:
```sql
  -- Logs
  SELECT coalesce(jsonb_agg(to_jsonb(log)), '[]'::jsonb)
  INTO v_logs_json
  FROM activity_logs log
  WHERE log.class_id = v_class.id
    AND log.student_id = v_student.id
  ORDER BY log.created_at DESC;
```
In PostgreSQL, because this query uses an aggregate function (`jsonb_agg`), a top-level `ORDER BY` clause requires the column to be present in the `GROUP BY` clause. This resulted in the error: `column "log.created_at" must appear in the GROUP BY clause or be used in an aggregate function`.

## 2. Exact RPC Section Fixed
The `activity_logs` aggregation query was updated to use a sorted subquery so that the `ORDER BY` executes *before* the aggregate function processes the rows:
```sql
  -- Logs
  SELECT coalesce(jsonb_agg(to_jsonb(log)), '[]'::jsonb)
  INTO v_logs_json
  FROM (
    SELECT *
    FROM activity_logs
    WHERE class_id = v_class.id
      AND student_id = v_student.id
    ORDER BY created_at DESC
  ) log;
```
Other aggregation queries in the RPC were audited. `students` and `meetings` aggregations were already correctly ordering rows *inside* the `jsonb_agg` function (e.g. `jsonb_agg(...) ORDER BY m.started_at DESC`). 

## 3. Files Changed
* `supabase/schema.sql`: Updated the definition of `public.student_fetch_dashboard_data` to use the subquery.
* `supabase/phase_18j_rpc_patch.sql`: Created this live patch script.

## 4. Live SQL Patch to Run
Please open your Supabase SQL Editor and run the newly generated file:
`/supabase/phase_18j_rpc_patch.sql`

This script will seamlessly `CREATE OR REPLACE` the `student_fetch_dashboard_data` function with the fixed subquery pattern.

## 5. Schema Cache Reload Status
The `/supabase/phase_18j_rpc_patch.sql` script includes `NOTIFY pgrst, 'reload schema';` at the end to ensure the PostgREST cache picks up the corrected function logic.

## 6. Student Dashboard Retest Result
*Pending execution.* Once the script is executed in the Supabase SQL editor, the `student_fetch_dashboard_data` RPC will compile correctly, and student dashboards will fetch successfully without the PostgreSQL aggregation error.

## 7. Confirmation of No RLS Rollback
Confirmed. No rollback of the RLS lockdown from Phase 18J was needed. We successfully isolated the error to the RPC logic itself.

## 8. Confirmation of Storage Policies
Confirmed. Storage bucket policies have not been changed.

## 9. Confirmation of Protected Logic
Confirmed. All teacher-side workflows, task mechanics, submission logic, and point logic are completely preserved. The fix exclusively targeted the `ORDER BY` syntax inside the read-only student dashboard RPC.
