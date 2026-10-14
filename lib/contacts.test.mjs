import test from 'node:test';
import assert from 'node:assert/strict';
import { contactMatches, sortContacts, contactTitle } from './contacts.ts';

const depts = { d1: 'Ops & Fleet', d2: 'Marketing' };
const dept = (id) => depts[id];
const c = (over) => ({ kind: 'Supplier', name: '', company: '', role: '', phone: '', email: '', services: [], department_ids: [], notes: '', ...over });

const printer = c({ name: 'Sokha Chan', company: 'PP Print Co.', services: ['Printing', 'Banners'], department_ids: ['d1'], phone: '+855 12 345 678' });
const driver = c({ kind: 'Staff', name: 'Dara Kim', role: 'Fleet supervisor', department_ids: ['d1'] });
const venue = c({ kind: 'Venue', company: 'Riverside Hall', department_ids: ['d2'] });

test('every word must match somewhere: name, service, department', () => {
  assert.ok(contactMatches(printer, 'print fleet', dept));
  assert.ok(contactMatches(printer, 'BANNERS', dept));
  assert.ok(!contactMatches(printer, 'print marketing', dept));
  assert.ok(contactMatches(venue, '', dept));
});

test('phone numbers match without their spaces', () => {
  assert.ok(contactMatches(printer, '12345', dept));
  assert.ok(contactMatches(printer, '345 678', dept));
  assert.ok(!contactMatches(driver, '12345', dept));
});

test('a company-only entry is titled by its company', () => {
  assert.equal(contactTitle(venue), 'Riverside Hall');
});

test('sorting puts blanks last in both directions', () => {
  const names = (list) => list.map(contactTitle);
  assert.deepEqual(names(sortContacts([venue, driver, printer], 'company', 'asc', dept)), ['Sokha Chan', 'Riverside Hall', 'Dara Kim']);
  assert.deepEqual(names(sortContacts([venue, driver, printer], 'company', 'desc', dept)), ['Riverside Hall', 'Sokha Chan', 'Dara Kim']);
  assert.deepEqual(names(sortContacts([venue, driver, printer], 'name', 'asc', dept)), ['Dara Kim', 'Riverside Hall', 'Sokha Chan']);
  assert.deepEqual(names(sortContacts([venue, driver, printer], 'department', 'asc', dept)), ['Riverside Hall', 'Dara Kim', 'Sokha Chan']);
});
