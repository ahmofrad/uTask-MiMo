# 01 — Audit the calendar view's drag and date math against the day-marker convention

Type: task
Status: resolved
Blocked by:

## Question

The Gantt had mixed-convention dates (legacy Asia/Tehran local midnights vs canonical UTC day markers) that broke placement and drag. `calendar-view.tsx` does its own date math — `atMidnight(...)` local snapping, `deltaDays * 86400000` drags — which likely writes local-midnight markers in Tehran and misplaces canonical markers. Audit the calendar view's day-cell placement, drag writes, and month navigation against `lib/date/day-marker.ts`; fix anything that produces non-canonical markers or misplaced tasks, and pin the behavior with unit tests.

## Answer

Confirmed and fixed. The calendar had the same two bug classes as the Gantt: (1) `getTasksForDay` placed tasks by the *local* day of the due instant, so a canonical `23:59:59.999Z` marker landed on the next local day in Asia/Tehran; (2) `handleDrop` wrote `atMidnight(...).toISOString()` — local midnight — so drags in Tehran persisted legacy `20:30:00Z` markers back into the DB.

Extracted the math into a pure, tested module `src/lib/date/calendar-move.ts` (`taskCalendarAnchor`, `calendarDeltaDays`, `shiftCalendarStart`, `calendarDueMarker`) built on the day-marker helpers, and rewired `calendar-view.tsx` to use it: placement anchors to the marker's UTC day, drags persist canonical `T00:00:00.000Z` / `T23:59:59.999Z` markers, and deltas are whole marker-days. 9 new unit tests pass in both UTC and `TZ=Asia/Tehran`; typecheck and lint clean. No calendar e2e specs exist.
