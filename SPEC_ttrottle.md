# TukTukRental Internal Task Management System — MVP Build Brief

## 1. Project Overview

Build a lightweight internal task and project management web application for TukTukRental.

The application should replace the basic task-management functionality currently handled through tools such as Asana, but it should **not attempt to reproduce Asana in full**.

This is an internal business tool for a relatively small team.

The focus should be:

* simplicity
* speed
* clear ownership
* visibility of overdue work
* recurring operational tasks
* project organisation
* minimal clicks
* easy future expansion

The first release should be a desktop-responsive web application. A dedicated mobile app is not required.

---

## 2. Core Product Structure

The basic hierarchy should be:

Company

→ Projects

→ Tasks (Level 1)

→ Subtasks (Level 2)

Tasks should be capable of existing either:

1. inside a project, or
2. as standalone/general company tasks.

---

## 3. Time Zone

The entire application operates on a single fixed business time zone: **`Asia/Colombo` (UTC+05:30)**.

Sri Lanka does not observe daylight saving, so this is a constant offset. There is no DST arithmetic.

Rules:

* `due_date` is stored as a Postgres `DATE`, not a timestamp. A due date is a calendar day, not a moment in time.
* "Today", "overdue" and "due this week" are evaluated against the current date in `Asia/Colombo`, regardless of where the user's browser is.
* Audit timestamps (`created_at`, `updated_at`, `completed_at`, comment times, activity log) are stored as `timestamptz` in UTC and **displayed** converted to `Asia/Colombo`.
* Do not use the browser's local time zone anywhere in the UI. Users in Australia, India, Sri Lanka and Cambodia must see the same due dates and the same overdue set.
* Define a single helper (e.g. `lib/time.ts`) exposing `businessToday()` and the date formatters. Nothing else in the codebase should call `new Date()` for business logic.

---

# 4. Required MVP Features

## 4.1 Users

Users must be able to:

* log in
* log out
* see tasks assigned to them
* see other users
* assign tasks to another user

For the MVP, all users can have approximately the same access level.

Complex permissions are NOT required.

Include a simple admin role for:

* creating users
* deactivating users
* managing basic system settings

---

## 4.2 Projects

Users must be able to:

* create projects
* edit projects
* archive projects
* view active projects
* view archived projects

Each project should include:

* Project Name
* Description
* Project Owner
* Status
* Start Date
* Target Completion Date
* Created Date
* Archived status

Project statuses:

* Not Started
* Active
* On Hold
* Completed
* Archived

---

## 4.3 Tasks

Users must be able to create tasks.

Every task should support:

* Task title
* Description
* Project
* Assignee
* Due date
* Priority
* Status
* Created by
* Created date
* Updated date
* Completed date
* Recurrence
* Dependencies
* Comments
* File attachments

Task statuses:

* Not Started
* In Progress
* Waiting
* Completed

Priorities:

* Low
* Normal
* High
* Urgent

---

## 4.4 Task Hierarchy — exactly two levels

* **L1** — a top-level task. Belongs to a project, or is a general company task.
* **L2** — a subtask. Belongs to an L1 task.
* **There is no L3.** An L2 task cannot have children. The "Add subtask" action must not be offered on an L2 task.

L2 tasks are full tasks. They have the same fields and the same capabilities as L1 tasks: assignee, due date, priority, status, description, comments, attachments, dependencies, recurrence and activity history.

There is no separate `subtasks` table. The `tasks` table with `parent_task_id` handles both levels.

### Enforcing the depth limit

Add a `level` column (`smallint`, CHECK `level IN (1, 2)`), derived on write:

* `parent_task_id IS NULL` → `level = 1`
* `parent_task_id IS NOT NULL` → `level = 2`

Enforce with a database trigger that rejects any insert or update where the parent task's `level` is not 1. A CHECK constraint cannot inspect another row, so the trigger is required. Do not rely on application code alone.

Also enforce: an L2 task inherits its parent's `project_id` and cannot be moved to a different project independently of its parent.

### Where L2 tasks appear — OPEN, NEEDS CONFIRMATION BEFORE BUILDING THE DASHBOARD

L2 tasks are assignable and can be overdue, so they must appear somewhere. Proposed default:

* **My Tasks** — include L2, shown with their parent task named alongside.
* **Dashboard counts** (My Overdue, Company Overdue, Due This Week) — include L2. Counting only L1 would hide real overdue work from the person responsible for it.
* **Project view** — L1 rows with L2 nested beneath, collapsible.
* **All Tasks** — include L2, with a Parent column, and a toggle to show top-level only.

Consequence: a task with six subtasks contributes seven rows and up to seven overdue counts. Confirm this is acceptable before building the dashboard.

---

## 4.5 Task Dependencies

Tasks should be able to depend on another task.

For example: Task B cannot logically commence until Task A is completed.

Display:

"Waiting on: [Task A]"

and/or:

"Blocking: [Task B]"

Do NOT build complex dependency scheduling or automatic date changes.

Dependencies are primarily for visibility.

---

## 4.6 Recurring Tasks

Recurrence is **schedule-driven, not completion-driven**.

A recurring task is defined by a **recurrence template**. The template generates task instances on a fixed schedule. Generation is not triggered by completion. If an occurrence is never completed, the next occurrence is still created on schedule.

Any task can be recurring, at either level.

### 4.6.1 Table: `task_recurrences`

```
id
project_id            (nullable — a recurrence can be a general company task)
level                 smallint, CHECK (level IN (1, 2))
parent_task_id        (nullable, FK -> tasks.id)              -- mode 2
parent_recurrence_id  (nullable, FK -> task_recurrences.id)   -- mode 3
title
description
assignee_id
priority
frequency             enum: daily | weekly | monthly | annually   (null for mode 3)
interval_count        integer, default 1                          (null for mode 3)
anchor_date           date                                        (null for mode 3)
next_due_date         date                                        (null for mode 3)
due_offset_days       integer, default 0   -- mode 3 only
active                boolean, default true
created_by
created_at
updated_at
```

`anchor_date` is the first occurrence and also fixes the day-of-week or day-of-month.

`next_due_date` is the next occurrence still to be generated.

Exactly one of `parent_task_id` / `parent_recurrence_id` may be set, and both must be null when `level = 1`. Enforce with a CHECK constraint.

Recurrence templates follow the same two-level limit as tasks. A mode-2 or mode-3 recurrence cannot itself have child recurrences.

### 4.6.2 Frequencies

`frequency` + `interval_count` covers the full requirement:

| Requirement    | frequency | interval_count |
| -------------- | --------- | -------------- |
| Daily          | daily     | 1              |
| Weekly         | weekly    | 1              |
| Monthly        | monthly   | 1              |
| Quarterly      | monthly   | 3              |
| Annually       | annually  | 1              |
| Every X days   | daily     | X              |
| Every X weeks  | weekly    | X              |
| Every X months | monthly   | X              |

Do not add a separate `quarterly` value. Quarterly is monthly with `interval_count = 3`.

### 4.6.3 Recurrence modes

**Mode 1 — recurring L1 task.**
`level = 1`, both parent columns null. Generates top-level tasks on its own schedule.

**Mode 2 — recurring L2 task under a fixed parent.**
`level = 2`, `parent_task_id` set to an existing L1 task, own schedule. Each occurrence is created as a subtask of that same parent task.

Example: the standing task "Vehicle 12 — maintenance" with a weekly subtask "fuel and tyre check". The parent task never completes and never repeats; the subtask repeats underneath it.

If the parent task is later completed or archived, generation continues unless the recurrence is deactivated. Surface this in the admin recurrence list so schedules under dead parents are visible.

**Mode 3 — recurring L2 task tied to a recurring L1 task (checklist pattern).**
`level = 2`, `parent_recurrence_id` set to a level-1 recurrence. This is how a recurring task carries the same subtasks every cycle.

* The child has **no schedule of its own** — `frequency`, `interval_count`, `anchor_date` and `next_due_date` are all null. It fires exactly once per parent occurrence.
* Whenever the generator creates a parent occurrence, it immediately creates one L2 task for each active child recurrence, attached to that new parent task.
* The child occurrence's due date is the parent occurrence's due date plus `due_offset_days` (default 0). This allows staged subtasks within a cycle — e.g. a monthly inspection where the report is due three days after the site visit.

Example: "Monthly vehicle inspection" (mode 1, monthly) with eight mode-3 children — brakes, tyres, lights, fluids and so on. Each month the generator creates one parent task and its eight subtasks.

**Not supported:** a mode-3 child with an independent frequency. A weekly subtask under a monthly parent has no defined answer to which parent occurrence it belongs to. A user needing that wants mode 2 with a fixed parent instead. The UI must not offer a frequency selector when the parent is a recurring task.

### 4.6.4 Link from tasks

Add to the `tasks` table:

```
recurrence_id         (nullable, FK -> task_recurrences.id)
```

Add a unique constraint on `(recurrence_id, due_date)`. This makes the generator idempotent — a job that runs twice cannot create duplicate occurrences.

### 4.6.5 The generator

A scheduled job runs once daily at **00:15 Asia/Colombo**.

Process `level = 1` recurrences first, then `level = 2`, so a child recurrence can attach to a parent occurrence created in the same run.

For each active recurrence with its own schedule (modes 1 and 2), while `next_due_date <= businessToday() + LEAD_DAYS`:

1. Create a task with `due_date = next_due_date`, copying title, description, assignee, priority and project from the template. Status = Not Started.
2. If this is a mode-1 recurrence, create one L2 task for each of its active mode-3 children, attached to the new task.
3. Advance `next_due_date` by `interval_count` units of `frequency`.

`LEAD_DAYS` defaults to **7**, so upcoming occurrences appear in "Due This Week" before they are due rather than materialising on the morning they are needed. Keep this as a single configurable constant.

The `while` loop matters: if the job does not run for several days, it catches up on the next run instead of silently skipping occurrences.

### 4.6.6 Generator implementation

Use a **Vercel Cron job** hitting a Next.js route handler (e.g. `/api/cron/generate-recurrences`), authenticated with a shared secret in an environment variable and using the Supabase service role key server-side.

The logic stays in TypeScript where it is readable and testable, it can be triggered manually during development, and it needs no additional infrastructure.

Postgres `pg_cron` inside Supabase is an acceptable alternative if there is a reason to prefer it. Do not build both.

Provide a manual "Run now" trigger for admins so recurrence behaviour can be tested without waiting a day.

### 4.6.7 Behaviour notes

* Completing an occurrence does nothing to the schedule. It completes that task only.
* If an occurrence is still incomplete when the next is generated, both exist. The older one is simply overdue. This is intended.
* Deactivating a recurrence (`active = false`) stops future generation. Already generated tasks are untouched.
* Editing a recurrence changes future occurrences only. Never retro-edit generated tasks.
* Deleting a recurrence must not delete its historical tasks. Set `ON DELETE SET NULL` on `recurrence_id`, or block deletion in favour of deactivation.

---

## 4.7 Comments

Each task should have a comment thread. This applies to both L1 and L2 tasks.

Comments must display:

* User
* Date/time
* Comment content

Comments should be chronological.

Users should be able to add comments without editing the task description.

---

## 4.8 File Attachments

Users must be able to attach files to tasks, at both levels.

Examples: PDF, Word, Excel, images, screenshots.

Display:

* filename
* uploaded by
* upload date
* download/open link

Use Supabase Storage rather than storing file binary data in the database. The bucket must be private, with access via signed URLs requiring authentication.

---

## 4.9 List / Table View

The PRIMARY task interface is a table/list.

A Kanban board is NOT required.

The task table should show:

| Task | Project | Assignee | Status | Priority | Due Date |
| ---- | ------- | -------- | ------ | -------- | -------- |

The user should be able to sort the table.

Prefer inline editing where practical. For example, clicking the status should allow the status to be changed without opening the full task.

---

## 4.10 Search and Filters

Users must be able to search tasks.

Filtering should support:

* Assignee
* Project
* Status
* Priority
* Due date
* Completed/not completed
* Level (top-level only / include subtasks)

Allow multiple filters to be active simultaneously.

Example:

Project = Sri Lanka Operations
Assignee = John
Status != Completed

---

## 4.11 Dashboard

A management dashboard IS required.

Advanced reporting is NOT required.

The dashboard should focus on immediate operational information.

### Dashboard cards

* **My Tasks Today** — tasks assigned to the current user due today.
* **My Overdue Tasks** — overdue incomplete tasks assigned to the current user.
* **Company Overdue** — total overdue incomplete tasks across the company.
* **Due This Week** — tasks due within the next 7 days.
* **Waiting** — tasks currently marked Waiting.
* **Active Projects** — number of active projects.

All counts evaluated against `businessToday()` in `Asia/Colombo`.

### Dashboard task sections

**My Tasks** — current user's incomplete tasks ordered by:

1. overdue
2. due today
3. upcoming due date
4. no due date

**Overdue Tasks** — all company overdue tasks. Columns: Task, Project, Assignee, Due Date, Priority.

**Recently Completed** — recently completed tasks.

**Projects** — active projects with project name, project owner, target completion date, number of incomplete tasks, number of overdue tasks.

The dashboard should allow the user to click through to the relevant task or project.

---

# 5. Explicitly NOT Required

Do NOT build the following for the MVP:

* Kanban boards
* mobile apps
* push notifications
* email notifications
* Gmail integration
* Outlook integration
* Microsoft Teams integration
* Slack integration
* advanced permissions
* complex role-based access control
* automation/rule builder
* advanced reporting
* Gantt charts
* workload management
* time tracking
* invoicing
* CRM functionality
* chat/messaging system
* custom fields
* forms
* portfolio management
* goals/OKRs
* AI features
* seed/demo data

These may be considered later.

Do not add these to the first release unless specifically requested.

---

# 6. User Interface

The UI should be extremely simple.

Think: Asana's list view combined with a lightweight modern admin dashboard.

Avoid excessive visual design.

Prioritise:

* speed
* readability
* minimal clicks
* desktop usability
* responsive layout
* clear status indicators
* easy task creation

## Navigation

Persistent left sidebar, two zones:

```
Dashboard
My Tasks
All Tasks
Completed
─────────────
PROJECTS
  Sri Lanka Operations      >   (expand to show L1 tasks, then L2 beneath)
  Cambodia Operations       >
  India Operations          >
  ...
  General / No Project      >
─────────────
Admin
```

* Projects are listed directly in the sidebar and expand to reveal their tasks.
* Expanding an L1 task in the sidebar reveals its L2 subtasks.
* Only active (non-archived) projects appear. Archived projects live behind a link at the bottom of the project list.
* Clicking a project name opens Project Detail. Clicking a task opens the task detail drawer.
* The sidebar tree must stay fast. Load project names eagerly; load each project's tasks only when that project is expanded. Do not fetch the entire company task tree on page load.
* Preserve expanded/collapsed state across navigation within a session.

---

# 7. Task Detail Interface

Clicking a task should open a task detail panel or page.

Prefer a side drawer/modal so users do not lose their place in the task list.

Task detail should contain:

Task title

Project

Parent task (L2 only)

Assignee

Status

Priority

Due Date

Recurrence

Description

Subtasks (L1 only)

Dependencies

Attachments

Comments

Activity/history

---

# 8. Activity History

Maintain a simple activity log for important task changes.

Examples:

Tom created task

Sarah changed status from Not Started to In Progress

John changed due date from 12 August to 15 August

Sarah assigned task to Michael

Michael completed task

System generated task from recurrence

The activity history does not need to record every minor technical database change.

---

# 9. Recommended Technology

Unless there is a strong technical reason to change it, build using:

## Frontend

Next.js

React

TypeScript

Tailwind CSS

shadcn/ui

## Backend

Supabase

## Database

PostgreSQL through Supabase

## Authentication

Supabase Auth

## File Storage

Supabase Storage

## Scheduled jobs

Vercel Cron

## Hosting

Vercel for the application

Supabase for database/auth/storage

Keep the architecture simple.

Do NOT introduce microservices.

Do NOT introduce Kubernetes.

Do NOT create unnecessary infrastructure.

This application is initially intended for a small internal team.

---

# 10. Database Structure

## users / profiles

id

email

full_name

avatar_url

role

active

created_at

---

## projects

id

name

description

owner_id

status

start_date

target_date

archived

created_at

updated_at

---

## tasks

id

project_id

parent_task_id

level

title

description

assignee_id

created_by

status

priority

due_date

completed_at

recurrence_id

created_at

updated_at

archived

Constraints:

* CHECK `level IN (1, 2)`
* Trigger rejecting any row whose parent task has `level != 1`
* UNIQUE `(recurrence_id, due_date)`

---

## task_recurrences

See Section 4.6.1.

---

## task_dependencies

id

task_id

depends_on_task_id

---

## comments

id

task_id

user_id

content

created_at

updated_at

---

## attachments

id

task_id

uploaded_by

file_name

storage_path

file_size

mime_type

created_at

---

## task_activity

id

task_id

user_id

activity_type

old_value

new_value

created_at

---

# 11. Important Application Rules

## Overdue

A task is overdue when:

due_date < businessToday()

AND

status != Completed

---

## Completion

When a task is marked Completed: set `completed_at`.

If changed back to another status: clear `completed_at`.

Completing a task has no effect on any recurrence schedule.

---

## Archived projects

Archived projects should not appear in the default active project list or in the sidebar project tree.

Tasks from archived projects should remain accessible through search/history.

---

# 12. Initial Screens

Build these screens first.

## Screen 1 — Login

Simple email/password authentication.

## Screen 2 — Dashboard

Operational overview described above.

## Screen 3 — My Tasks

Table displaying tasks assigned to current user.

Filters: Today, Overdue, Upcoming, Completed, All.

## Screen 4 — All Tasks

Company-wide task list. Search, sort and filters.

## Screen 5 — Projects

List active projects. Click project to view project details and associated tasks.

## Screen 6 — Project Detail

Project information at top. Below: task list, project overdue count, project completed count, project outstanding count.

## Screen 7 — Task Detail

Full task information.

## Screen 8 — Admin / Users

Basic user administration, plus a list of active recurrences.

---

# 13. MVP Acceptance Criteria

The MVP is operational when I can:

1. Create users.
2. Create a project.
3. Create a task.
4. Assign the task to a user.
5. Add a due date.
6. Set priority.
7. Change task status.
8. Create subtasks.
9. Confirm a subtask cannot itself take a subtask.
10. Add comments.
11. Attach a file.
12. Create a recurring top-level task.
13. Create a recurring subtask under a fixed parent.
14. Create a recurring task that generates a fixed set of subtasks each cycle.
15. Confirm a recurring task regenerates on schedule whether or not the previous occurrence was completed.
16. Create task dependencies.
17. Search tasks.
18. Filter tasks.
19. View my tasks.
20. View overdue tasks.
21. View tasks due this week.
22. Complete tasks.
23. See completed task history.
24. See a basic operational dashboard.
25. Archive projects.
26. Navigate projects and their tasks from the left sidebar.
27. Use the system comfortably from a desktop browser.

---

# 14. Development Principles

This is important.

Do NOT over-engineer the application.

Before adding a library, service or architectural layer, ask:

"Is this required for the current MVP?"

Prefer the simplest reliable implementation.

Code should be:

* modular
* readable
* typed
* reasonably documented
* easy for another developer to continue

Use reusable components where sensible.

Keep business logic separate from UI components where practical.

Use database migrations.

Do not manually change production database structure without migrations.

---

# 15. Security Requirements

Even though this is an internal system:

* users must authenticate
* unauthenticated users must not access company information
* passwords must not be stored directly
* database credentials must never be exposed to the browser
* file access should require authentication
* the cron endpoint must be protected by a shared secret
* the service role key must never reach the browser
* validate user input
* use Supabase Row Level Security appropriately

Do not build complex permission groups yet.

---

# 16. Development Approach

Do NOT attempt to build the entire system in one enormous change.

Work incrementally.

## Phase 1

Set up: repository, Next.js, TypeScript, Tailwind, shadcn, Supabase, authentication, database schema, migrations.

Then verify the system runs.

## Phase 2

Build: users, projects, tasks, task list, sidebar navigation.

Deploy to Vercel at the end of this phase.

## Phase 3

Build: task detail, subtasks and the two-level constraint, comments, attachments, dependencies.

## Phase 4

Build: recurrence templates, the generator and its cron job, search, filtering, sorting.

## Phase 5

Build: dashboard, activity history, archive/completed views.

## Phase 6

Test and polish.

---

# 17. Instructions for Claude Code

Start by reviewing this specification.

Then:

1. Propose the folder/application architecture.
2. Create the initial database schema.
3. Identify any technical decisions that materially affect the architecture.
4. Create an implementation checklist in the repository at `docs/CHECKLIST.md`.
5. Set up the base project.
6. Implement the application incrementally according to the phases above.

Do not expand the product scope without explicit approval.

If there are multiple implementation choices, favour:

1. simplicity
2. maintainability
3. proven technology
4. low ongoing cost
5. ease of future development

After each major phase:

* run tests
* run type checking
* run linting
* fix errors before proceeding

Do not create seed or demo data. Real data will be entered manually.

The application is called:

**TukTukRental Tasks**

Use this as the application name throughout the interface.
