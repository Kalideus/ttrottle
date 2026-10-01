-- 024_task_positions.sql
-- Tasks used to be created with position 0, so most lists were all ties: the
-- reorder arrows (which swap two positions) did nothing, and equal rows could
-- come back in any order. Renumber every list 0, 1, 2, … keeping today's order.
-- A "list" is a project's top-level tasks, or one task's subtasks.
-- Safe to re-run.
with ranked as (
  select id,
         row_number() over (partition by project_id, parent_task_id order by position, created_at, id) - 1 as pos
  from tasks
)
update tasks t
set position = r.pos
from ranked r
where t.id = r.id and t.position is distinct from r.pos;
