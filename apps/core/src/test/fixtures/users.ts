// Rows shaped like GET http://localhost:5001/api/v1/users (octacore-backend, FastAPI), in the service's own
// envelope. The values are made up. The service never sends a password or a hash.
export const userRows = [
  {
    id: 1,
    status: 1,
    createdDate: '2026-10-01T08:00:00.000000Z',
    updatedDate: '2026-10-15T08:00:00.000000Z',
    deletedDate: null,
    name: 'Ada Admin',
    email: 'ada@example.com',
    role: 'admin',
    lastLoginDate: '2026-10-15T08:00:00.000000Z',
  },
  {
    id: 2,
    status: 1,
    createdDate: '2026-10-05T09:30:00.000000Z',
    updatedDate: '2026-10-05T09:30:00.000000Z',
    deletedDate: null,
    name: 'Grace Hopper',
    email: 'grace@example.com',
    role: 'admin',
    lastLoginDate: null,
  },
];

export const usersEnvelope = (data: unknown = userRows) => ({
  statusCode: 200,
  message: 'Successfully fetched users',
  data,
  meta: null,
});

/** The signed-in user in tests that need one. */
export const adminUser = userRows[0];
