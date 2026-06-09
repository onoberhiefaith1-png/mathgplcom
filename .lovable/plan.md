## Goal
Make the student's board show the same per-line structures the teacher set in the lesson note. Specifically for the "one unknow" example: line 2 (`y = 3(5) − 2`) has a **bracket** structure on the teacher's board, but the student's line 2 shows no structure.

## Root cause (confirmed from live data)
Structures flow like this:

```text
lesson note floating_lines[].containers
        │  (snapshotted at assessment-create time)
        ▼
assessments.questions[].lines[].containers
        ▼
student board StructurePanel
```

For this lesson note, line 2 correctly stores `containers: ["bracket"]`. But the existing assessment row was created **before** the code that copies containers into the assessment. Every line in that assessment has `containers = null`, so the student board has nothing to display. New assessments created today already store containers correctly — this one is stale data.

A live re-derivation on the student side is not possible: students can't read the teacher's notebook (row-level security), and the equation is intentionally withheld from the student client. So the stored snapshot must be corrected.

## Fix

### 1. Backfill existing assessments (data migration)
Run a one-time migration that fills in `assessments.questions[].lines[].containers` from the matching lesson-note line. Matching is done by `lineId` (a globally unique id that matches exactly between the assessment line and the notebook's `floating_lines`), scoped to the assessment's own notebook. Lines that already have containers are left untouched; lines with no match get an empty list.

This immediately makes line 2 of the existing "one unknow" assessment show the bracket for students, with no need for the teacher to re-publish.

### 2. Keep new assessments correct (verify only)
`createAssessment.ts` already carries `containers` from each `floating_lines` line into the stored question, and `assessmentBoardSource.ts` already passes them through to the board. No code change needed — confirmed correct. This means assessments created from now on will not have the stale-structure problem.

## What the user will see
Open the existing assignment as a student → tap the structure (F) icon on line 2 → the bracket `( )` appears, exactly like the teacher's board.

## Technical details
Migration SQL (idempotent; preserves existing containers, only fills missing ones):

```sql
update assessments a
set questions = (
  select jsonb_agg(
    jsonb_set(q, '{lines}', (
      select jsonb_agg(
        ln || jsonb_build_object(
          'containers',
          coalesce(
            nullif(ln->'containers', 'null'::jsonb),
            (
              select fl.line->'containers'
              from notebook_subsections ss
              join notebook_sections sec on sec.id = ss.section_id
              cross join lateral
                jsonb_array_elements(coalesce(ss.floating_lines,'[]'::jsonb)) fl(line)
              where sec.notebook_id = a.notebook_id
                and fl.line->>'lineId' = ln->>'lineId'
                and jsonb_array_length(coalesce(fl.line->'containers','[]'::jsonb)) > 0
              limit 1
            ),
            '[]'::jsonb
          )
        )
      )
      from jsonb_array_elements(q->'lines') ln
    ))
  )
  from jsonb_array_elements(a.questions) q
)
where a.questions is not null;
```

Files/areas touched: one new Supabase migration. No frontend changes (existing student board already renders `containers`). No grading/answer-key changes — containers are display-only hints the teacher chose to show.

## Note for the user
Any assignments created before today carry the same stale snapshot; this single migration repairs all of them at once. Assignments you create from now on already include the structures automatically.
