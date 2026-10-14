// Rows shaped like GET http://localhost:5001/api/v1/categories (octacore-backend, FastAPI), in the service's
// own envelope; the field set was captured from the running service on 2026-10-14, the values are made up.
// The service stamps createdDate and updatedDate itself and answers a missing description with null.
export const categoryRows = [
  { id: 1, status: 1, createdDate: '2023-07-25T09:30:00.000000Z', updatedDate: '2023-07-26T09:30:00.000000Z', deletedDate: null, name: 'Web', description: 'Websites and portals' },
  { id: 2, status: 1, createdDate: '2023-08-01T09:30:00.000000Z', updatedDate: '2023-08-01T09:30:00.000000Z', deletedDate: null, name: 'Mobile', description: 'Phone apps' },
];

export const categoriesEnvelope = (data: unknown = categoryRows) => ({
  statusCode: 200,
  message: 'Successfully fetched categories',
  data,
  meta: null,
});
