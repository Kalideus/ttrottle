import test from 'node:test';
import assert from 'node:assert/strict';
import { contactMatches, sortContacts, contactTitle } from './contacts.ts';

const c = (over) => ({ kind: 'Supplier', name: '', company: '', role: '', phone: '', email: '', tags: [], notes: '', updated_at: '', ...over });

const printer = c({ name: 'Sokha Chan', company: 'PP Print Co.', tags: ['Printing', 'Banners', 'Ops & Fleet'], phone: '+855 12 345 678', updated_at: '2026-10-01T09:00:00Z' });
const driver = c({ kind: 'Staff', name: 'Dara Kim', role: 'Fleet supervisor', tags: ['Ops & Fleet'], updated_at: '2026-10-14T09:00:00Z' });
const venue = c({ kind: 'Venue', company: 'Riverside Hall', tags: ['Marketing'], updated_at: '2026-09-20T09:00:00Z' });

test('every word must match somewhere: name, tag', () => {
  assert.ok(contactMatches(printer, 'print fleet'));
  assert.ok(contactMatches(printer, 'BANNERS'));
  assert.ok(!contactMatches(printer, 'print marketing'));
  assert.ok(contactMatches(venue, ''));
});

test('phone numbers match without their spaces', () => {
  assert.ok(contactMatches(printer, '12345'));
  assert.ok(contactMatches(printer, '345 678'));
  assert.ok(!contactMatches(driver, '12345'));
});

test('a company-only entry is titled by its company', () => {
  assert.equal(contactTitle(venue), 'Riverside Hall');
});

test('sorting puts blanks last in both directions', () => {
  const names = (list) => list.map(contactTitle);
  assert.deepEqual(names(sortContacts([venue, driver, printer], 'company', 'asc')), ['Sokha Chan', 'Riverside Hall', 'Dara Kim']);
  assert.deepEqual(names(sortContacts([venue, driver, printer], 'company', 'desc')), ['Riverside Hall', 'Sokha Chan', 'Dara Kim']);
  assert.deepEqual(names(sortContacts([venue, driver, printer], 'name', 'asc')), ['Dara Kim', 'Riverside Hall', 'Sokha Chan']);
  assert.deepEqual(names(sortContacts([venue, driver, printer], 'tags', 'asc')), ['Sokha Chan', 'Riverside Hall', 'Dara Kim']);
  assert.deepEqual(names(sortContacts([venue, driver, printer], 'updated', 'desc')), ['Dara Kim', 'Sokha Chan', 'Riverside Hall']);
});
