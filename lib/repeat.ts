// Labels for tasks.repeat. The next date itself is worked out by next_repeat_date() in
// db/migrations/025_repeating_tasks.sql; the monthly variants read the due date, so their
// labels do too ("the third Thursday" only means something next to a date).

export type Repeat = 'daily' | 'weekly' | 'monthly' | 'monthly_weekday' | 'monthly_last_weekday' | 'yearly'

const ORDINAL = ['first', 'second', 'third', 'fourth']

export function repeatOptions(due: string | null, current?: Repeat | null): { value: Repeat; label: string }[] {
  const opts: { value: Repeat; label: string }[] = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: due ? `Weekly on ${day(due).weekday}` : 'Weekly' },
  ]
  if (!due) opts.push({ value: 'monthly', label: 'Monthly' })
  else {
    const { date, weekday, isLastDay, nth, isLastWeekday } = day(due)
    opts.push({ value: 'monthly', label: isLastDay ? 'Monthly on the last day' : `Monthly on day ${date}` })
    if (nth <= 4) opts.push({ value: 'monthly_weekday', label: `Monthly on the ${ORDINAL[nth - 1]} ${weekday}` })
    if (isLastWeekday) opts.push({ value: 'monthly_last_weekday', label: `Monthly on the last ${weekday}` })
  }
  opts.push({ value: 'yearly', label: 'Yearly' })
  // a later due-date change can rule out the saved choice (no "5th Thursday" option); still show it
  if (current && !opts.some((o) => o.value === current)) opts.splice(-1, 0, { value: current, label: repeatLabel(current, due) })
  return opts
}

const UNDATED: Record<Repeat, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  monthly_weekday: 'Monthly on the same weekday',
  monthly_last_weekday: 'Monthly on the last weekday',
  yearly: 'Yearly',
}

export function repeatLabel(repeat: Repeat, due: string | null): string {
  if (!due) return UNDATED[repeat]
  const { weekday, nth } = day(due)
  if (repeat === 'monthly_weekday' && nth <= 4) return `Monthly on the ${ORDINAL[nth - 1]} ${weekday}`
  if (repeat === 'monthly_weekday' || repeat === 'monthly_last_weekday') return `Monthly on the last ${weekday}`
  return repeatOptions(due).find((o) => o.value === repeat)?.label ?? repeat
}

function day(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return {
    date: d,
    weekday: new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' }),
    nth: Math.floor((d - 1) / 7) + 1,
    isLastDay: d === daysInMonth,
    isLastWeekday: d + 7 > daysInMonth,
  }
}
