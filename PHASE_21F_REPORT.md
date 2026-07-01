# Phase 21F: Class Category + Submission Word Counter

## Overview
Successfully implemented Phase 21F updates to Mission Control Remastered.

### Features Added:
1. **Class Category**
   - Added `class_category` (`regular` or `private`) to the database schema.
   - Teachers can select the category when creating a new class.
   - Teachers can update the category in the Class Settings panel.
   - Badges now clearly display "Regular" or "Private" on the teacher dashboard.
   - Handled gracefully in code so the frontend does not crash if the database migration hasn't been applied yet (it simply defaults to 'regular').

2. **Student Submission Word Counter**
   - Added a live word counter directly below the text answer box in the student task submission form.
   - The counter updates instantly as students type, splitting words by whitespace and filtering out empty tokens.
   - Display format follows the "X words" structure seamlessly (e.g. "0 words", "1 word", "25 words").

## Mandatory Migration Action
Because this environment operates on Supabase without direct backend execution tools, you must manually run the new migration script to add the `class_category` column to the `classes` table.

Please open your Supabase SQL Editor and run the contents of:
`/supabase/phase_21f_class_category.sql`

*Note: Without this migration, the UI will continue to function and default to 'regular', but changing the category will fail until the column is created.*
