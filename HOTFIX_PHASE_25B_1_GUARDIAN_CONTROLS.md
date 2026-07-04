# Hotfix Phase 25B.1: Guardian Code Controls

## Issue
While the guardian code foundation and Guardian Access pathway were implemented, teachers did not have a clear UI in the ClassDetail roster to generate, view, reset, or copy guardian codes to send to parents.

## Resolution
- Modified `ClassDetail.tsx` to include explicit Guardian Code controls within the teacher dashboard.
- **Roster Enhancements:**
  - In the Desktop Table view, changed the "PIN" header to "Credentials" to reflect its dual purpose.
  - Displayed the Guardian Code explicitly in both Table and Grid views, adjacent to the student PIN, with a distinctive sky-blue UI theme and a shield icon to prevent confusion.
- **Edit Student Modal Updates:**
  - Expanded the modal's credentials section to clearly separate "Student Credentials" from "Guardian Access".
  - Added a **"Copy Parent Info"** button which formats a secure message containing the Class Code, Student Name, and Guardian Code (expressly omitting the student PIN).
  - Added a **"Reset Code"** button to regenerate the guardian code without altering the student's PIN, points, or lives.

## Confirmations
- Teachers can now easily manage and distribute Guardian Codes.
- Guardian Codes remain structurally distinct from Student PINs.
- Guardian credentials can be reset independently of any other student data.
- Read-only parent boundaries and AI privacy logic from prior phases are unaffected.
