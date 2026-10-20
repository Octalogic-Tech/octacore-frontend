// Rows shaped like GET http://localhost:5001/api/v1/allocations (octacore-backend, FastAPI), in the service's own
// envelope; the values are made up. The service lists the live entries newest first (effective date, then id, both
// descending). An entry says "from this date this person's card N is on this project": a null project is the bench, a
// removed entry (`removed: true`, with no project) says the card is gone from that date, and a null note is an entry
// saved without one. Every person has card 1; these rows are all card 1 and none is removed (a second card is a row
// with `card: 2`, made in the tests that need one). Each embeds the person and the project as { id, name }; the
// project keeps its name when it was deleted later, so history stays readable. The people and projects are the ones in
// fixtures/people.ts and fixtures/projects.ts: Ada (1) is on the bench from 3 Nov 2025 and on Website (1) from 12 Mar 2026, Grace (2) is on
// Mobile app (2) from 5 Jan 2026 and back on the bench from 3 Aug 2026.
const stamp = '2026-10-15T09:30:00.000000Z';
const audit = { status: 1, createdDate: stamp, updatedDate: stamp, deletedDate: null, card: 1, removed: false };

const ada = { id: 1, name: 'Ada Lovelace' };
const grace = { id: 2, name: 'Grace Hopper' };
const website = { id: 1, name: 'Website' };
const mobileApp = { id: 2, name: 'Mobile app' };

export const allocationRows = [
  {
    ...audit,
    id: 4,
    personId: 2,
    projectId: null,
    effectiveDate: '2026-08-03',
    note: 'Between projects',
    person: grace,
    project: null,
  },
  {
    ...audit,
    id: 3,
    personId: 1,
    projectId: 1,
    effectiveDate: '2026-03-12',
    note: null,
    person: ada,
    project: website,
  },
  {
    ...audit,
    id: 2,
    personId: 2,
    projectId: 2,
    effectiveDate: '2026-01-05',
    note: null,
    person: grace,
    project: mobileApp,
  },
  {
    ...audit,
    id: 1,
    personId: 1,
    projectId: null,
    effectiveDate: '2025-11-03',
    note: 'Joined, not on a project yet',
    person: ada,
    project: null,
  },
];

export const allocationsEnvelope = (data: unknown = allocationRows) => ({
  statusCode: 200,
  message: 'Successfully fetched allocations',
  data,
  meta: null,
});

/** What POST /allocations, PATCH /allocations/{id} and POST /allocations/move answer: the entry. */
export const allocationEnvelope = (data: unknown = allocationRows[1], statusCode = 200) => ({
  statusCode,
  message: 'Successfully saved allocation',
  data,
  meta: null,
});
