import type { Heading, Task } from '@/lib/supabase/queries';
import { formatDay } from '@/lib/dates';

interface ProjectPrintSheetProps {
  projectName: string;
  headings: Heading[];
  tasks: Task[];
  showCompleted: boolean;
}

// The project as a paper checklist. Hidden on screen; when printing it's the only thing shown
// (see ".print-sheet" in globals.css). Empty cells are left blank to be filled in by hand.
export function ProjectPrintSheet({ projectName, headings, tasks, showCompleted }: ProjectPrintSheetProps) {
  const wanted = (ts: Task[]) => ts.filter((t) => showCompleted || !t.completed).sort((a, b) => a.position - b.position);
  const known = new Set(headings.map((h) => h.id));
  const sections = [
    { id: 'none', name: '', tasks: wanted(tasks.filter((t) => !t.heading_id || !known.has(t.heading_id))) },
    ...headings.map((h) => ({ id: h.id, name: h.name, tasks: wanted(tasks.filter((t) => t.heading_id === h.id)) })),
  ].filter((s) => s.tasks.length);

  const row = (t: Task, sub = false) => (
    <tr key={t.id}>
      <td className="print-tick">{t.completed ? '☑' : '☐'}</td>
      <td className={sub ? 'print-sub' : undefined}>{t.name}</td>
      <td>{t.assignee?.name}</td>
      <td>{t.due_date && formatDay(t.due_date)}</td>
      <td className="print-priority">{t.priority}</td>
    </tr>
  );

  return (
    <div className="print-sheet">
      <h1>{projectName}</h1>
      {/* the server's date can differ from the browser's around midnight */}
      <p suppressHydrationWarning>Printed {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
      {sections.map((s) => (
        <table key={s.id}>
          {/* widths live here: the section title spans every column, so the first row can't set them */}
          <colgroup>
            <col style={{ width: '5%' }} />
            <col />
            <col style={{ width: '24%' }} />
            <col style={{ width: '15%' }} />
            <col style={{ width: '11%' }} />
          </colgroup>
          <thead>
            {s.name && (
              <tr>
                <th colSpan={5} className="print-section">{s.name}</th>
              </tr>
            )}
            <tr>
              <th className="print-tick" />
              <th>Task</th>
              <th>Assigned to</th>
              <th>Due</th>
              <th>Priority</th>
            </tr>
          </thead>
          <tbody>{s.tasks.flatMap((t) => [row(t), ...wanted(t.subtasks ?? []).map((st) => row(st, true))])}</tbody>
        </table>
      ))}
      {sections.length === 0 && <p>No tasks to print.</p>}
    </div>
  );
}
