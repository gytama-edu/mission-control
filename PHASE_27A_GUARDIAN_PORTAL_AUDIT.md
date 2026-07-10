# Phase 27A — Guardian Portal Security and Architecture Audit

## Status

Audit-only phase. No production UI, routing, schema, RPC, authentication, or deployment behavior is changed by this phase.

The active production baseline remains the stable Phase 26D AI Feedback Save Polish + Review Workflow Comfort checkpoint. Guardian Portal functionality previously attempted after that checkpoint is treated as rolled back and untrusted.

## Repository and Deployment Boundary

- Active repository: `gytama-edu/mission-control`
- Production branch: `main`
- Audit branch: `phase-27a-guardian-portal-audit`
- GitHub Pages Vite base path must remain `/mission-control/`.
- Phase 27A must not modify `vite.config.ts`, `App.tsx`, deployment workflows, Supabase migrations, or production tables.

## Verified Current Data Model

### `classes`

Verified fields relevant to a guardian-facing experience:

- `id`
- `name`
- `level`
- `max_lives`
- `join_code`
- `teacher_id`
- `is_archived`
- `class_category`
- `created_at`

`class_category` currently supports `regular` and `private`. Competitive visibility must therefore remain derived through existing classroom-mode utilities rather than introducing a second scoring-system source of truth.

### `students`

Verified fields:

- `id`
- `class_id`
- `name`
- `nickname`
- `pin`
- `lives`
- `points`
- `created_at`

There is currently no guardian credential field in the repository schema or frontend `Student` type. This is desirable for a clean rebuild.

The student PIN must never be exposed to a guardian response or reused as a guardian credential.

### `meetings`

Verified fields:

- `id`
- `class_id`
- `started_at`
- `ended_at`
- `status`
- `reset_lives_to`
- `summary`
- `teacher_id`

Meeting summaries can contain class-wide or student-comparative information. Raw meeting rows and raw summary JSON must not be returned to guardians.

### `activity_logs`

Verified fields:

- `id`
- `teacher_id`
- `class_id`
- `student_id`
- `meeting_id`
- `action_type`
- `points_delta`
- `lives_delta`
- `reason`
- `metadata`
- undo metadata
- `created_at`

Raw logs are teacher-owned and may contain internal reasons, IDs, metadata, or information about other students. Guardians must receive only a server-generated, student-specific, sanitized progress feed.

### `tasks`

Verified fields include title, description, type, status, due date, reward points, submission settings, resubmission setting, lifecycle metadata, teacher ID, and class ID.

Guardian access should receive only published or historically relevant student-visible task information. Draft, archived, teacher ownership, and internal lifecycle actor IDs must not be exposed.

### `task_submissions`

Verified fields:

- task/class/student/group identifiers
- submitter identifier
- submission text
- status
- teacher feedback
- awarded points
- review timestamps and reviewer ID
- created/updated timestamps

Guardian responses may include submission status, teacher feedback, awarded points, and relevant dates for the authenticated child only. Reviewer IDs, raw internal identifiers, and submission text should be excluded from the first MVP unless explicitly approved later.

### `submission_attachments`

Verified metadata includes storage path, bucket, type, size, and file name.

The first Guardian Portal MVP must not expose storage paths or downloadable attachment URLs. Attachment access introduces a separate signed-URL authorization surface and should be deferred.

### Badges

Frontend types verify the current model:

- `badge_definitions`
- `student_badges`

Safe guardian fields are badge name, description, icon, and awarded date. Unsafe fields include teacher ID, class ID, internal trigger configuration, thresholds, source metadata, and awarded-by IDs.

## Current Authentication Pattern Audit

Student access currently uses:

1. Class code plus student PIN login.
2. A secure RPC for initial verification.
3. A second secure RPC to fetch a deliberately assembled dashboard payload.
4. Local storage of class ID, student ID, and student PIN for refresh restoration.
5. Polling and visibility refresh.

The Guardian Portal may borrow the split-login-and-fetch concept, but must not copy the student credential storage model. Storing a reusable raw guardian secret in local storage is not recommended.

## Recommended Guardian Authentication Model

### Credential storage

Create a dedicated table rather than adding a plaintext code to `students`:

```sql
create table public.guardian_access_credentials (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  secret_hash text not null,
  secret_hint text,
  is_active boolean not null default true,
  expires_at timestamptz,
  last_used_at timestamptz,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  rotated_at timestamptz,
  unique(student_id)
);
```

Only a hash should be stored. The full generated secret is shown once to the teacher when created or rotated.

### Credential format

Use a high-entropy random secret generated server-side. A human-readable grouped format is acceptable, for example `AB7K-N4QX-P9RM`, but security must come from cryptographic randomness rather than six-character convenience.

Avoid ambiguous characters. Normalize spacing and hyphens only; do not weaken comparison rules further.

### Session model

After successful verification, issue an opaque short-lived guardian session token. Store only its hash server-side in a dedicated session table:

```sql
create table public.guardian_sessions (
  id uuid primary key default gen_random_uuid(),
  credential_id uuid not null references public.guardian_access_credentials(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  session_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
```

Recommended initial expiry: 12 hours, with no silent long-term persistence in the first MVP. Store the opaque session token in `sessionStorage`, not the original guardian secret.

### Revocation

Rotating or disabling a credential must immediately revoke all active guardian sessions linked to that credential.

Deleting a student or class should cascade-delete credentials and sessions.

### Rate limiting and enumeration resistance

- Return one generic invalid-credentials response.
- Do not reveal whether the class code or guardian secret was wrong.
- Apply per-credential and per-request-source throttling where available.
- Lock repeated failed attempts temporarily.
- Do not log raw credentials.
- Do not include student names in failed-login responses.

## Privacy Allowlist

The first Guardian Portal MVP may return:

### Class

- class display name
- level, when present
- category-derived neutral display mode

### Student

- display name
- nickname
- points when points mode applies
- lives when lives mode applies
- badges with safe presentation fields

### Tasks and progress

- task title
- short task description
- task type
- due date
- current student-specific status
- awarded points
- teacher feedback saved to the submission
- submitted/reviewed dates

### Sanitized recent progress

- timestamp
- neutral event label
- points/lives delta when appropriate
- teacher-facing reason only when explicitly categorized as guardian-safe

## Privacy Denylist

The Guardian Portal must never return:

- student PINs
- guardian hashes or full reusable secrets
- teacher IDs or emails
- other students' identities, points, lives, badges, submissions, group membership, or rank
- class roster or leaderboard data
- competitive rank, including in regular classes
- raw activity-log metadata
- raw meeting summaries
- submission AI-writing-check results
- unsaved or saved AI draft-generation internals
- AI prompts, model responses, confidence labels, or internal review signals
- reviewer IDs
- raw storage paths or unrestricted attachment URLs
- draft tasks
- archived internal records unless converted into an explicitly safe historical item
- database row objects returned wholesale

## Proposed RPC Boundary

Use three narrowly scoped functions instead of one giant RPC.

### 1. `guardian_begin_session`

Inputs:

- class code
- guardian secret

Behavior:

- normalize input
- locate class by `join_code`
- reject archived classes
- verify hashed credential
- enforce active/expiry/lock rules
- create short-lived guardian session
- return opaque session token and expiry only

### 2. `guardian_fetch_dashboard`

Input:

- guardian session token

Behavior:

- hash and validate session
- verify session, credential, class, and student are still active
- construct one student-specific JSON payload
- avoid returning raw table rows
- update `last_used_at`

### 3. `guardian_end_session`

Input:

- guardian session token

Behavior:

- revoke the matching session
- return success without revealing session details

## Proposed Response Contract

```ts
interface GuardianDashboardData {
  access: {
    expiresAt: string;
  };
  class: {
    name: string;
    level?: string;
    category: 'regular' | 'private';
    displayMode: 'points' | 'lives';
  };
  student: {
    displayName: string;
    nickname?: string;
    points?: number;
    lives?: number;
  };
  badges: Array<{
    name: string;
    description?: string;
    icon?: string;
    awardedAt: string;
  }>;
  tasks: Array<{
    title: string;
    description?: string;
    taskType: 'individual' | 'group';
    dueAt?: string;
    status: 'not_submitted' | 'submitted' | 'late' | 'returned' | 'reviewed' | 'closed';
    awardedPoints?: number;
    teacherFeedback?: string;
    submittedAt?: string;
    reviewedAt?: string;
  }>;
  recentProgress: Array<{
    occurredAt: string;
    label: string;
    pointsDelta?: number;
    livesDelta?: number;
  }>;
}
```

No IDs are required by the initial read-only UI contract.

## Group Task Boundary

Group submissions create a privacy trap because a response may accidentally reveal classmates or the submitting group member. The Guardian Portal must show only:

- that the child was assigned to a group task
- the task's student-specific status
- shared teacher feedback and awarded points when applicable

It must not show group names, member names, submitter identity, or other students' work.

## Frontend Isolation Plan

Do not place guardian state inside `StudentAccess.tsx` or teacher dashboard hooks.

Future files should be isolated:

- `src/components/GuardianAccess.tsx`
- `src/services/guardianData.ts`
- guardian-only interfaces in `src/types.ts` or a dedicated type module

The component should remain read-only and must not import submission mutation helpers, badge-award helpers, class mutation hooks, or teacher AI services.

Routing should be added only after database and service tests pass. The existing placeholder can remain until that gate.

## Implementation Phases

### Phase 27B — Database Foundation Only

- Add credential and session tables.
- Add indexes, constraints, RLS lockdown, and revocation helpers.
- Add no frontend fields and no routing.
- Include rollback SQL.
- Verify existing teacher and student RPCs remain unchanged.

### Phase 27C — Authentication RPCs Only

- Add begin/fetch/end RPCs.
- Add generic errors and session expiry.
- Test wrong class, wrong secret, archived class, expired secret, locked secret, rotated secret, expired session, and revoked session.
- Confirm no cross-student data leakage.

### Phase 27D — Teacher Credential Controls

- Add teacher-owned generate, copy-once, rotate, disable controls.
- Do not display stored full secrets after creation.
- Preserve points, lives, PIN, roster ordering, and optimistic classroom controls.

### Phase 27E — Guardian Read-Only UI

- Replace placeholder with isolated login and dashboard.
- Use session token only.
- No attachments, rank, roster, AI signals, mutations, or realtime subscriptions.
- Add manual refresh and conservative visibility refresh.

### Phase 27F — Security and Regression Review

- Build and TypeScript checks.
- Teacher ownership tests.
- Student-login regression tests.
- Guardian cross-account and cross-student tests.
- GitHub Pages route and refresh tests.
- Mobile layout and logout/session-expiry tests.

## Required Regression Checklist

Before any Guardian Portal phase is merged:

- teacher login works
- teacher-owned classes remain isolated
- student Class Code + PIN login works
- student dashboard refresh works
- points/lives rapid controls remain stable
- alphabetical roster order remains stable
- task creation and review work
- AI Writing Check remains teacher-only
- AI Feedback drafts remain teacher-only
- reports and session history remain unchanged
- private classes never expose rank
- production build succeeds
- GitHub Pages renders from built assets with `/mission-control/`

## Known Limitation of This Audit

This audit verifies the repository schema and code at the current `main` branch. It cannot prove which previously removed guardian objects may still exist in the live Supabase database. Before Phase 27B, the deployed database must be inspected manually for leftover columns, tables, functions, grants, and policies with names containing `guardian`, `parent`, or prior access-code variants.

Do not run new migrations until that live-database inventory is completed.

## Phase 27A Decision

Proceed with the dedicated hashed-credential plus short-lived-session architecture.

Do not restore the former plaintext `guardian_access_code` column or the former all-in-one anonymous dashboard RPC.

Phase 27A is complete when this report has been reviewed. The next implementation phase is Phase 27B Database Foundation Only, beginning with a live Supabase leftover-object inventory and a reversible migration draft.