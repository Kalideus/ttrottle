// CSV → project plan for "Import project". Pure functions, no Supabase, so
// lib/csvImport.check.mts can run them with plain `node`.

import type { Repeat } from '@/lib/repeat'

export type NewTaskSpec = {
  name: string
  description?: string | null
  assignee_id?: string | null
  due_date?: string | null
  priority?: 'low' | 'medium' | 'high' | null
  repeat?: Repeat | null
  completed?: boolean
  section: string | null
  tag_ids?: string[]
  subtasks?: NewTaskSpec[]
}

export type ProjectPlan = { sections: string[]; tasks: NewTaskSpec[]; warnings: string[] }

export const IMPORT_FIELDS = [
  { key: 'name', label: 'Task name', required: true, aliases: ['task', 'task name', 'name', 'title'] },
  { key: 'section', label: 'Section', aliases: ['section', 'heading', 'group', 'category'] },
  { key: 'parent', label: 'Parent task (makes it a subtask)', aliases: ['parent', 'parent task', 'subtask of'] },
  { key: 'description', label: 'Description', aliases: ['description', 'notes', 'details'] },
  { key: 'assignee', label: 'Assignee (name or email)', aliases: ['assignee', 'assigned to', 'owner', 'who'] },
  { key: 'due', label: 'Due date', aliases: ['due', 'due date', 'deadline', 'date'] },
  { key: 'priority', label: 'Priority', aliases: ['priority'] },
  { key: 'done', label: 'Done', aliases: ['done', 'completed', 'complete', 'status'] },
] as const

export type FieldKey = (typeof IMPORT_FIELDS)[number]['key']
// column index per field, -1 = not imported
export type Mapping = Record<FieldKey, number>
export type DateFormat = 'dmy' | 'mdy'

export const EXAMPLE_CSV = [
  'Section,Task,Parent task,Description,Assignee,Due date,Priority,Done',
  'Pre-Tournament Work,Run schedule for Orientation,,Start Party and Start Line too,tom@example.com,25/12/2026,High,',
  'Pre-Tournament Work,Book venue,Run schedule for Orientation,,,,,',
  'Hotels,Confirm room block,,,,01/11/2026,Medium,yes',
].join('\r\n')

// RFC 4180: quoted fields may hold commas, newlines and "" escapes.
// Excel saves with ";" in locales that use a decimal comma, so the delimiter is
// whichever of , ; or tab appears most in the header line.
export function parseCsv(text: string): string[][] {
  text = text.replace(/^﻿/, '')
  const firstLine = text.split(/\r?\n/, 1)[0]
  const count = (c: string) => firstLine.split(c).length
  const delim = [',', ';', '\t'].reduce((a, b) => (count(b) > count(a) ? b : a))

  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === delim) { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); rows.push(row); row = []; field = ''
    } else field += c
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  // Excel pads with rows of empty cells
  return rows.filter((r) => r.some((v) => v.trim()))
}

export function guessMapping(headers: string[]): Mapping {
  const norm = headers.map((h) => h.trim().toLowerCase())
  const used = new Set<number>()
  const mapping = {} as Mapping
  for (const f of IMPORT_FIELDS) {
    const i = norm.findIndex((h, idx) => !used.has(idx) && (f.aliases as readonly string[]).includes(h))
    mapping[f.key] = i
    if (i >= 0) used.add(i)
  }
  return mapping
}

// → 'YYYY-MM-DD' or null. Accepts ISO, d/m/y or m/d/y (per `format`), and 2-digit years.
export function parseDate(raw: string, format: DateFormat): string | null {
  const s = raw.trim()
  let y: number, m: number, d: number
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  const parts = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/)
  if (iso) [y, m, d] = [+iso[1], +iso[2], +iso[3]]
  else if (parts) {
    ;[d, m] = format === 'dmy' ? [+parts[1], +parts[2]] : [+parts[2], +parts[1]]
    y = parts[3].length === 2 ? 2000 + +parts[3] : +parts[3]
  } else return null
  const date = new Date(Date.UTC(y, m - 1, d))
  // rejects 31/02 etc., which Date would silently roll over
  if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null
  return date.toISOString().slice(0, 10)
}

const PRIORITIES: Record<string, 'low' | 'medium' | 'high'> = { low: 'low', l: 'low', medium: 'medium', med: 'medium', m: 'medium', high: 'high', h: 'high' }
const DONE = new Set(['yes', 'y', 'true', 'x', '1', 'done', 'complete', 'completed'])

export function buildPlan(
  rows: string[][],
  mapping: Mapping,
  people: { id: string; name: string; email: string }[],
  dateFormat: DateFormat
): ProjectPlan {
  const warnings: string[] = []
  const sections: string[] = []
  const tasks: NewTaskSpec[] = []
  const byName = new Map<string, NewTaskSpec>()
  const cell = (r: string[], k: FieldKey) => (mapping[k] >= 0 ? (r[mapping[k]] ?? '').trim() : '')
  const person = (q: string) => {
    const s = q.toLowerCase()
    return people.find((p) => p.email.toLowerCase() === s) ?? people.find((p) => p.name.toLowerCase() === s)
  }

  rows.forEach((r, i) => {
    const line = i + 2 // +1 header, +1 for 1-based like Excel's row numbers
    const name = cell(r, 'name')
    if (!name) {
      if (r.some((v) => v.trim())) warnings.push(`Row ${line}: no task name, skipped`)
      return
    }
    const task: NewTaskSpec = { name, section: cell(r, 'section') || null }

    const description = cell(r, 'description')
    if (description) task.description = description

    const who = cell(r, 'assignee')
    if (who) {
      const p = person(who)
      if (p) task.assignee_id = p.id
      else warnings.push(`Row ${line}: no user called "${who}", left unassigned`)
    }

    const due = cell(r, 'due')
    if (due) {
      task.due_date = parseDate(due, dateFormat)
      if (!task.due_date) warnings.push(`Row ${line}: couldn't read date "${due}", left blank`)
    }

    const pri = cell(r, 'priority')
    if (pri) {
      task.priority = PRIORITIES[pri.toLowerCase()] ?? null
      if (!task.priority) warnings.push(`Row ${line}: unknown priority "${pri}" (use Low/Medium/High), left blank`)
    }

    if (DONE.has(cell(r, 'done').toLowerCase())) task.completed = true

    const parentName = cell(r, 'parent')
    const parent = parentName ? byName.get(parentName.toLowerCase()) : undefined
    if (parentName && !parent) warnings.push(`Row ${line}: parent "${parentName}" isn't a task above it, added as a normal task`)
    if (parent) {
      // subtasks live under their parent, whatever section their own row says
      ;(parent.subtasks ??= []).push(task)
      return
    }
    if (task.section && !sections.includes(task.section)) sections.push(task.section)
    tasks.push(task)
    if (!byName.has(name.toLowerCase())) byName.set(name.toLowerCase(), task)
  })

  return { sections, tasks, warnings }
}
