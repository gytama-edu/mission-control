# Hotfix Phase 25B.6: Guardian Code Persistence

## Root Cause of Changing Guardian Codes
The user reported that guardian codes appeared to change every time the page refreshed or synced. 

After checking the frontend hooks and components for accidental UUID/math.random invocations on render, we found that **no UI element was generating these codes accidentally**. The only place a Guardian Code is generated is inside explicit backend functions (adding a student, or explicitly resetting a code).

The bug was actually in the Supabase query layer:
1. `fetchClasses` and `getStudentDashboardData` were mapping the `students` payload returned from Supabase, but completely omitted the `guardian_access_code` field from the mapping object.
2. Because it was omitted from the payload, `student.guardian_access_code` was always `undefined` when the teacher loaded the page.
3. The teacher would see "Generate" (because it was undefined) and click it. 
4. Clicking "Generate" saved a new code to the database and correctly set `optimisticGuardianCodes[studentId] = newCode` locally in React state, making it show up.
5. On the next refresh, `optimisticGuardianCodes` cleared, and the backend payload again dropped the existing `guardian_access_code`. The UI reverted back to "Generate".
6. The teacher, thinking it didn't save, would click "Generate" again, which issued *another* code to the database.

To the user, this felt like the code was changing "every time it refreshed". It was actually forcing the user to click Generate and generate a new code every time because the frontend couldn't read the existing one.

## Fixes Applied
1. **Added `guardian_access_code: s.guardian_access_code`** to the student payload map in `fetchClasses` (`src/services/missionControlData.ts`).
2. **Added `guardian_access_code: s.guardian_access_code`** to the student payload map in `getStudentDashboardData` (`src/services/missionControlData.ts`).
3. **Prevented copying empty codes** by adding a safety check in `handleCopyGuardianInfo` to alert "Generate a guardian code first." instead of copying "Not generated" as the code.

Guardian Access Codes are now accurately loaded from the database, persisted across refreshes, and fully functional for Guardian portal login.
