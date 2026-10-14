# Architecture

FastAPI + synchronous SQLAlchemy 2 sessions + Psycopg 3; Alembic owns schema changes. React + TypeScript + Vite + React Router + TanStack Query; native fetch; Tiptap for formatted teaching content.

One Postgres database. Each feature owns commands (writes/transactions) and queries (authorized projections). No bus, generic repository, event sourcing, separate read database, or runtime schema repair.

Opaque hashed server sessions, HttpOnly cookies and session CSRF tokens; Argon2 passwords. Parent/child resources are scoped by authenticated role, offering ownership/enrollment and section targeting. Restricted fields must never enter student responses.

Files remain outside webroot and are delivered by an authorized API. Drafts use compare-and-swap revisions; published documents and grade snapshots are immutable.

Approved schema/lifecycles: IMPLEMENTATION_PLAN.md sections 3-4. AI retrieval restrictions: section 6.


### Additions: learning order, paging and chat deletion
- `learning_item.position` orders items inside a chapter/topic; students read them in syllabus order, then position (`teaching/items.ordered_published`, the single source for the lesson list, the dashboard next step and the Next link). `PUT /api/teach/offerings/{id}/items-order` reorders one group. Learner payloads add `completed`, `up_next`, `next_lesson`; work payloads add `bucket` and `late_allowed` (`assessments/learner.bucket_of`, shared with the dashboard).
- Paging: `GET /api/admin/issues` takes `page`, `page_size` (max 100), `status`, `type`, `q` and returns `total`; study conversations and messages take `limit` and a `before` timestamp cursor and return `has_more` / `has_earlier`; announcements take `limit`.
- `DELETE /api/learn/offerings/{id}/study/conversations/{cid}` hard-deletes the student's own conversation (allowed after withdrawal or term close).

## Study slice (Milestone 5)

`features/study` owns derived study text (`content_chunk`, from published learning-item revisions only), private conversations, reference-link text snapshots, AI quiz generation records, lesson completions and progress events. It calls `teaching` and `assessments` only through their access helpers and models; `assessments` calls only `study.events.record_event`, which has no other imports, to avoid cycles.

All provider traffic goes through `study/provider.py` (safe error codes, no provider bodies). Retrieval (`study/retrieval.py`) is the single place that decides what the model may read; chat and quiz generation use separate pipelines. AI quiz drafts are ordinary unpublished assessment drafts flagged `ai_generated`, published only when `reviewed_counter == draft_counter`. Progress events are unique per (student, type, ref) and are written in the same transaction as the action that earned them. Details: `docs/AI.md`, `docs/DECISIONS.md`.

## Exports, support and backup (Milestone 6)

`features/exports` builds one format-independent table per request (`tables.py`: published releases from their own snapshots, or a working preview marked as such) and renders it to real XLSX/PDF (`render.py`); the router is faculty-only and audits each download. `features/support` holds issue reports (students/faculty create, administrators review). `app/backup.py` computes the manifest and verifies restored copies; `scripts/` orchestrates Docker/pg_dump/restore around it. Browser verification lives in `frontend/e2e/` (headless Edge via playwright-core). Commands and results: `docs/OPERATIONS.md`, `docs/ACCEPTANCE.md`.

## Versions actually selected (from the manifests, 2026-10-06)

Python 3.12.14 (the interpreter inside backend/.venv); FastAPI 0.142.2, Uvicorn 0.54.0, SQLAlchemy 2.1.3 (synchronous sessions), Psycopg 3.3.6, Alembic 1.20.0, Pydantic 2.13.5 / pydantic-settings 2.15.0, Argon2 (argon2-cffi 25.1.0 via pwdlib 0.3.1), httpx 0.28.1, nh3 0.3.7 (lesson sanitising), pypdf 6.19.0 / python-docx 1.2.0 / python-pptx 1.0.2 (text extraction), ReportLab 4.5.1 and openpyxl 3.1.5 (exports); tests: pytest 9.1.1, ruff 0.16.10. Postgres 16.15 (Docker, `postgres:16-alpine`) and Mailpit 1.27.10. Node 24.21; React 19, React Router 7, TanStack Query 5, Tiptap 3, Vite 7, TypeScript 5.9; browser checks: playwright-core 1.63 driving the installed Microsoft Edge, axe-core 4.14. Exact pins: `backend/requirements*.txt`, `frontend/package-lock.json`.

### UX rework, Phase 1 (skeleton-first setup)
`assessments/planning.py` owns three commands, all faculty-only and scoped to the teacher's own offering: `POST /api/teach/offerings/{id}/assessments/plan` creates up to 30 hidden draft assessments in one transaction (idempotent through a `plan_key` stored in the audit event; category and period are checked against the draft or published policy), `PUT /api/teach/offerings/{id}/schedule` stores `offering.meeting_days` (bitmask, Monday = 1, migration `29f75f29e858`), and `POST /api/teach/offerings/{id}/copy-from/{source_id}` copies one of the teacher's own earlier subjects into an EMPTY one as drafts only (syllabus draft, lessons, links, files with their bytes duplicated, assessments with questions; never sections, dates, attempts, scores, submissions, students, announcements or attendance). Offering summaries carry `meeting_days`.

### UX rework, Phase 2 (steppers and question entry)
`assessments/question_import.py` parses pasted plain text into questions (multiple choice from lettered choices, true/false from an answer of True or False, short answer with accepted answers separated by `|`; optional `Points:` and `Why:`), returns valid blocks and reports every problem block by line number, and never guesses. `POST /api/teach/offerings/{id}/assessments/parse-questions` previews it without saving; the teacher adds the questions to the draft explicitly. `POST /api/teach/offerings/{id}/assessments/{aid}/duplicate` makes a hidden draft (same settings and questions, title prefixed "Copy of", sections kept, dates and records never copied; an AI-drafted source stays flagged so it needs review again). The assessment editor is a three-step stepper for online quizzes (Basics, Questions, Review and assign) and one short screen for the other kinds; the publish button's label follows the state: Assign, Add to gradebook (teacher-scored kinds), Update for students.

### UX rework, Phase 3 (grades and publication)
`PUT /api/teach/offerings/{id}/gradebook/scores` (`assessments/gradebook_edit.py`) saves up to 500 gradebook cells in one transaction, ALL OR NOTHING: each cell runs through `scores.apply_score` (the single-score rules without the commit: published, student applies, not above the maximum, quiz rules, expected revision); if any cell is rejected the transaction is rolled back and a 409 `batch_rejected` lists every rejected cell in `error.field_errors`, keyed `assessmentId:studentId`. `app.errors.fail` accepts an optional `fields` dict that the error handler passes through. `faculty_rows` carries `to_return` (a scored result the student does not yet see exactly as it is), which drives "Return N graded results". The UI replaces every native `confirm()` with `components/confirm.tsx` (promise-based, Cancel first and focused, `data-confirm` / `data-confirm-yes` / `data-confirm-no` for scripts) and uses `components/undo.tsx` (a persistent live region with a 10-second Undo) for reversible removals of a question, a chapter and the grading policy. Publishing grades is a review-then-publish dialog computed from the working values already on the page.

### UX rework, Phase 4 (attendance grid)
No new endpoint: `PUT /api/teach/offerings/{id}/attendance` has always been a PARTIAL save per (section, date): only the students named in `marks` change (a null clears), everyone else on that date is untouched, and a date's grading period is locked once recorded (409 `period_locked`). The grid depends on exactly that and `tests/test_attendance_grid.py` pins it. The grid's columns are the dates in the visible week or month that are recorded, fall on a class day (`offering.meeting_days`), or were added by hand; they are computed in the browser, so nothing is stored for a date until a mark is saved. Each cell change is debounced per date (600 ms) into one partial save; a failed save keeps the typed value, outlines the cell and offers Retry; leaving the page tries to flush first (`useFlushOnLeave`). There is no per-cell version check: two tabs editing the same cell are last-write-wins, as before.

## Phase 5 endpoints
- `GET /api/dashboard/faculty/review`: activity submissions waiting for a grade across the teacher's subjects, oldest first.
- `GET /api/teach/offerings/{id}/exports/attendance?format=xlsx|pdf&section_id=&start=&end=`: attendance file for one section (teacher of the offering only; recorded dates only; audited without names).
- `POST /api/teach/offerings/{id}/assessments/{aid}/unpublish`: published revision becomes superseded and a draft is kept or created; refused with 409 `has_history` once attempts, uploads, scores, released results or exceptions exist.

## Bulk assignment and the paginated section roster
- `POST /api/terms/{id}/offerings/bulk` `{faculty_id, items:[{subject_id, section_ids, placement_override_reason?}]}`: one teacher, several subjects, each with its own sections, all or nothing. A refusal names the subject and saves nothing; the same subject twice is `duplicate_subject`. Single `POST .../offerings` and `PATCH /offerings/{id}` are unchanged.
- `GET /api/sections/{id}/roster?page&page_size&search&status=active|withdrawn|all`: a section's students a page at a time (admin only).
- `GET /api/sections/{id}/candidates?page&page_size&search&account=all|active|invited`: students who can be added, excluding anyone already active in a section of the same term.
- `DELETE /api/sections/{id}/members/{student}?reason=` now requires a reason (3 to 1000 characters, 422 `reason_required`); it is stored in the `section.member_withdrawn` audit event.
- Admin route `/admin/terms/:termId/sections/:sectionId/students` (the old Manage students dialog is gone).

## Files and links as lessons (Phase 6)
- Lessons, files and links are one sequence (`SEQUENCE_KINDS` in `teaching/items.py`): each can be marked done through the same `POST /api/learn/offerings/{id}/lessons/{item}/complete` (idempotent, one `lesson_completed` event per student and item), each is a progress step (steps now carry `kind`), "Up next" and "Next lesson" run through all three (`next_lesson` and `first_incomplete` carry `kind`). Chat grounding and the chat's "Next in your lessons" suggestion are unchanged.
- `GET /api/files/{id}/preview`: inline delivery for course material only, and only when the stored type is PDF, PNG or JPEG AND the first bytes match that type; same access rule as download (so unpublished, archived, other-section and other-teacher files are 404); `Content-Disposition: inline`, `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'self'`, `no-store`. Everything else, and `/download`, stays an attachment (now also `nosniff`).

## Activities without a file, and hidden scheduling (2026-10-13)
- `assessment_revision.requires_file` (default true) and a nullable `activity_submission.file_id` (migration `a1c5d7e93b21`). `POST /api/learn/offerings/{id}/assessments/{aid}/mark-done` (student, body `{note}`) records one submission with no file when the activity does not require one; a file upload to such an activity answers 422 `no_file_needed`, a mark-done on an ordinary activity 422 `file_required`, a second mark-done 409 `already_done`. Submission views carry `marked_done` and a null `file`.
- `learner.scheduled(rev)`: a published quiz or activity whose `available_from` is in the future does not exist for students (`listing`, `student_assessment`, the To-do and the dashboard all go through those), so a direct address answers 404. Teachers' lists are unchanged.
- `GET /api/files/{id}/preview` also serves a submitted PDF to its owner and the assigned teacher (same access as the download).

## Classroom alignment round (2026-10-13)
- `GET /api/teach/offerings/{id}/assessments` adds `counts` (`total, graded, turned_in, assigned, to_return`) to each published, unarchived item (`assessments/status.py`). Turned in = handed in (activity submission or submitted quiz attempt) and not yet returned; Graded = has a released result; Assigned = none of handed in, scored or released; To return = scored but never released.
- `GET /api/dashboard/student/todo` adds `missing` (closed bucket: past due, nothing handed in, late work not accepted) and `done` (returned or finished work, with `result`).
- Gradebook columns carry `deadline`; activity cells carry `turned_in`.
- New assessments other than online quizzes start at 100 points.

## Excuse and attachments (2026-10-13)
- `assessment_score.excused` (migration `b3d9e1f27a44`). `PUT /api/teach/offerings/{id}/assessments/{aid}/excuse/{student_id}` body `{excused}`; excused items are skipped in `grading.assessment_category` (left out of earned and possible), skipped by `results.release_one`, flagged for review through `flag_graded_change`, and shown to the student as `excused` (bucket `done`). Gradebook cells and score rows carry `excused`; status counts carry `excused`.
- `assessment_attachment` (migration `c5e1f3a07d92`): `kind` file or link, per revision. `POST .../assessments/{aid}/draft/attachments` (multipart: file, title), `POST .../draft/links` (JSON), `DELETE .../draft/attachments/{id}`; revision views and the student item view carry `attachments`. Files use purpose `assessment_attachment`; `GET /api/files/{id}/download` allows the owning teacher, or an enrolled, targeted student of a published, unarchived, already-open version.

## Notifications, private comments and Unsubmit (2026-10-13)
- Migration `d7a2b8c4e611`: tables `notification` and `assessment_comment`, column `activity_submission.withdrawn_at`. The notification model is imported in `migrations/env.py` and `app/backup.py` (the backup manifest test fails if a table is missing).
- `features/notifications/service.py`: `notify`, `notify_students`, `recent`, `mark_read`. Notices are written inside the caller's transaction (publish, release, grade publication, turn-in, comment), so a rolled-back action leaves no notice. In-app only: no email is sent. A scheduled assessment is announced when it opens for students, not when it is saved. Routes: `GET /api/me/notifications` (`{unread, items}`), `POST /api/me/notifications/read` (`{ids}` or empty for all; another person's id does nothing).
- Comments (`assessments/comments.py`): `GET/POST /api/learn/offerings/{id}/assessments/{aid}/comments` (the student's own thread), `GET/POST /api/teach/offerings/{id}/assessments/{aid}/comments/{student_id}` (the offering's teacher; the student must be targeted by the assessment). 2000 characters, empty is 422. Each side is notified of the other's comment.
- Unsubmit: `POST /api/learn/offerings/{id}/assessments/{aid}/unsubmit` (204). 409 `nothing_to_unsubmit`, 409 `already_graded` (a score or excuse exists, or a result was returned). The row is kept with `withdrawn_at`; `versions()`, `latest()`, status counts, grading and standing ignore withdrawn rows; the next turn-in takes the next version number, so history is preserved. The student item view carries `can_unsubmit`.

## Admin notices (2026-10-14)
`notifications.service.notify_admins(db, kind, title, link, detail)` writes a notice for every active administrator. Used by `support.issues.create` (kind `report`, link `/admin/issues`) and `accounts.commands.consume_token` for accepted invitations (kind `accepted`, link `/admin/accounts?role=...`). No schema change.

## Class themes and the activity line (2026-10-14)
- Migration `e1b4c6d8f203`: `offering.theme_color` and `offering.theme_art` (small integers, null = derived). `GET /api/me/class-themes` returns `{offering_id: {color, art}}` for the classes the caller teaches or is enrolled in (all for an admin) where a look was chosen; `PUT /api/teach/offerings/{id}/theme` `{color, art}` (the offering's own teacher; 422 outside 0-9 and 0-5; allowed in a closed term). The limits live in `academics/themes.py` and `components/classes.tsx`.
- `GET /api/dashboard/faculty`: each subject carries `activity`, seven daily counts (oldest first, today last) of valid learning events for that offering.

## Streak and badges (2026-10-14)
`GET /api/dashboard/student` also returns `streak` (consecutive local days up to today, or up to yesterday while today has no event yet) and `badges` (`key`, `label`, `hint`, `earned`), computed from the student's own `learning_event` rows only (`dashboard/student.py: streak_and_badges`). No schema change.
