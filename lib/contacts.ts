// Searching and sorting the contacts list. Pure functions, so lib/contacts.test.mjs runs them with plain `node`.

type ContactLike = {
  kind: string
  name: string
  company: string
  role: string
  phone: string
  email: string
  services: string[]
  department_ids: string[]
  notes: string
}

export type ContactSort = 'name' | 'company' | 'kind' | 'department'

// The name to show: the person, else the company (a company-only entry).
export function contactTitle(c: Pick<ContactLike, 'name' | 'company'>): string {
  return c.name.trim() || c.company.trim()
}

// Every word typed must appear somewhere: "print fleet" finds a printer used by Ops & Fleet.
// Phone numbers match ignoring spaces and dashes, so "012345" finds "012 345".
export function contactMatches(c: ContactLike, query: string, departmentName: (id: string) => string | undefined): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const hay = [c.name, c.company, c.role, c.email, c.notes, c.kind, ...c.services, ...c.department_ids.map((id) => departmentName(id) ?? '')]
    .join(' ')
    .toLowerCase()
  const digits = c.phone.replace(/\D/g, '')
  return words.every((w) => hay.includes(w) || (/\d/.test(w) && digits.includes(w.replace(/\D/g, ''))))
}

// Blanks always go last, whichever way the column is sorted.
export function sortContacts<T extends ContactLike>(
  list: T[],
  field: ContactSort,
  direction: 'asc' | 'desc',
  departmentName: (id: string) => string | undefined
): T[] {
  const key = (c: T): string => {
    if (field === 'name') return contactTitle(c)
    if (field === 'company') return c.company.trim()
    if (field === 'kind') return c.kind
    return c.department_ids.map((id) => departmentName(id)).filter(Boolean).sort()[0] ?? ''
  }
  return [...list].sort((a, b) => {
    const ka = key(a)
    const kb = key(b)
    if (!ka || !kb) return ka ? -1 : kb ? 1 : 0
    const cmp = ka.localeCompare(kb, undefined, { numeric: true, sensitivity: 'base' }) || contactTitle(a).localeCompare(contactTitle(b))
    return direction === 'asc' ? cmp : -cmp
  })
}
