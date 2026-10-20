// Rows shaped like GET http://localhost:5001/api/v1/people (octacore-backend, FastAPI), in the service's own
// envelope; the values are made up. Every column comes with every row: a person saved with only a name has null for
// each optional one, the monthly salary (whole INR paise) included, and an empty list of technologies. A person lists
// the technologies they know as { id, name }, by name (Ada knows Nest and React, the ids in fixtures/technologies.ts).
const stamp = '2026-10-15T09:30:00.000000Z';
const audit = { status: 1, createdDate: stamp, updatedDate: stamp, deletedDate: null };

export const personRows = [
  {
    ...audit,
    id: 1,
    name: 'Ada Lovelace',
    joinDate: '2024-01-15',
    leaveDate: null,
    email: 'ada@example.com',
    phone: '+44 20 7946 0000',
    imageLink: 'https://example.com/ada.png',
    contractLink: 'https://example.com/ada-contract.pdf',
    monthlySalaryPaise: 8_500_000,
    technologies: [
      { id: 2, name: 'Nest' },
      { id: 1, name: 'React' },
    ],
  },
  {
    ...audit,
    id: 2,
    name: 'Grace Hopper',
    joinDate: '2023-03-01',
    leaveDate: '2025-06-30',
    email: null,
    phone: '+1 202 555 0100',
    imageLink: null,
    contractLink: null,
    monthlySalaryPaise: 9_250_000,
    technologies: [{ id: 3, name: 'Express' }],
  },
  {
    ...audit,
    id: 3,
    name: 'Linus Torvalds',
    joinDate: null,
    leaveDate: null,
    email: null,
    phone: null,
    imageLink: null,
    contractLink: null,
    monthlySalaryPaise: null,
    technologies: [],
  },
];

export const peopleEnvelope = (data: unknown = personRows) => ({
  statusCode: 200,
  message: 'Successfully fetched people',
  data,
  meta: null,
});

/** What POST /people answers: the new person, under the id the service gave it. */
export const createdPersonEnvelope = (id: number) => ({
  statusCode: 201,
  message: 'Successfully created "New" person',
  data: { ...personRows[2], id, name: 'New' },
  meta: null,
});
