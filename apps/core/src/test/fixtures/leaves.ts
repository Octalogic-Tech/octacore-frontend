// Rows shaped like GET http://localhost:5001/api/v1/leaves (octacore-backend, FastAPI), in the service's own envelope;
// the values are made up. The service lists the live leaves newest first (first day, then id, both descending). A leave
// is a type (casual, sick, earned, unpaid or other), a first and a last day that are both counted, and a reason that is
// null when none was given. A one-day leave has the same date in both. Each embeds the person as { id, name }. The
// people are the ones in fixtures/people.ts: Ada (1) took a long weekend in March 2026 and a week at the end of 2025,
// Grace (2) a day off sick in August 2026 and a week of earned leave in February 2026.
const stamp = '2026-10-15T09:30:00.000000Z';
const audit = { status: 1, createdDate: stamp, updatedDate: stamp, deletedDate: null };

const ada = { id: 1, name: 'Ada Lovelace' };
const grace = { id: 2, name: 'Grace Hopper' };

export const leaveRows = [
  {
    ...audit,
    id: 4,
    personId: 2,
    person: grace,
    startDate: '2026-08-21',
    endDate: '2026-08-21',
    leaveType: 'sick',
    reason: null,
  },
  {
    ...audit,
    id: 3,
    personId: 1,
    person: ada,
    startDate: '2026-03-12',
    endDate: '2026-03-14',
    leaveType: 'casual',
    reason: 'Family wedding',
  },
  {
    ...audit,
    id: 2,
    personId: 2,
    person: grace,
    startDate: '2026-02-02',
    endDate: '2026-02-06',
    leaveType: 'earned',
    reason: null,
  },
  {
    ...audit,
    id: 1,
    personId: 1,
    person: ada,
    startDate: '2025-12-24',
    endDate: '2025-12-31',
    leaveType: 'unpaid',
    reason: 'Travel',
  },
];

export const leavesEnvelope = (data: unknown = leaveRows) => ({
  statusCode: 200,
  message: 'Successfully fetched leaves',
  data,
  meta: null,
});

/** What POST /leaves and PATCH /leaves/{id} answer: the leave. */
export const leaveEnvelope = (data: unknown = leaveRows[1], statusCode = 200) => ({
  statusCode,
  message: 'Successfully saved leave',
  data,
  meta: null,
});
