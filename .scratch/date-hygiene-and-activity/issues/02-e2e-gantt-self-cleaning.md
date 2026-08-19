# 02 — Make the e2e Gantt suite self-cleaning

Type: task
Status: resolved
Blocked by:

## Question

`tests/e2e/gantt.spec.ts` performs real drags that PATCH the database and mocked-report tests that inject fixed dates onto real seeded tasks — every run permanently mutates the dev database's task dates (repeatedly observed this session). Snapshot the seeded tasks' `startDate`/`dueDate` before the suite and restore them after, so running the suite never changes the dev DB.

## Answer

Added a `dateSnapshot` beforeAll/afterAll pair inside the serial describe: beforeAll snapshots every Product Launch task's `startDate`/`dueDate`; afterAll restores them. Verified: a full 23-test Tehran run left the DB byte-identical (diff of the affected rows before/after was empty).
