// lib/time.ts
// Business date helpers fixed to Asia/Colombo (UTC+05:30)

export function businessToday(): string {
  // Returns YYYY-MM-DD for the current date in Asia/Colombo
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo' });
  return formatter.format(new Date());
}

export function formatBusinessDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo' });
  return formatter.format(d);
}

export function parseBusinessDateToUTC(dateStr: string): Date {
  // dateStr in YYYY-MM-DD (business date) -> return Date at 00:00 UTC of that date
  // We interpret the business date as local in Asia/Colombo; convert to UTC equivalent
  const [y, m, d] = dateStr.split('-').map(Number);
  // Construct a Date using the time zone offset: create ISO string in Asia/Colombo by using Date.UTC for the components then adjust
  // Simpler approach: create a string in YYYY-MM-DDT00:00 and use Date with timeZone by using Intl to get timezone offset
  const local = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  // local currently represents midnight UTC; we need the UTC instant that corresponds to midnight in Asia/Colombo.
  // Compute offset between Asia/Colombo midnight and UTC midnight by formatting midnight in Asia/Colombo and parsing.
  // For simplicity and reliability across environments, offset by +5.5 hours
  const offsetMinutes = 5 * 60 + 30;
  return new Date(local.getTime() - offsetMinutes * 60 * 1000);
}

export const BUSINESS_TIMEZONE = 'Asia/Colombo';
