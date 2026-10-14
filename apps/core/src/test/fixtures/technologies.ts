import { categoryRows } from './categories';

// Rows shaped like GET http://localhost:5001/api/v1/technologies (octacore-backend, FastAPI), in the service's
// own envelope; the field set was captured from the running service on 2026-10-14, the values are made up.
// The service answers a missing description, resource link, image link or category with null, and embeds the
// whole category beside categoryId. A category that was deleted since renders as null while categoryId stays.
export const technologyRows = [
  { id: 1, status: 1, createdDate: '2023-07-25T09:30:00.000000Z', updatedDate: '2023-07-25T09:30:00.000000Z', deletedDate: null, name: 'React', description: 'A library for user interfaces.', resourceLink: 'https://react.dev', imageLink: null, categoryId: 1, category: categoryRows[0] },
  { id: 2, status: 1, createdDate: '2023-07-25T09:30:00.000000Z', updatedDate: '2023-07-25T09:30:00.000000Z', deletedDate: null, name: 'Nest', description: null, resourceLink: null, imageLink: null, categoryId: null, category: null },
  { id: 3, status: 1, createdDate: '2023-07-25T09:30:00.000000Z', updatedDate: '2023-07-25T09:30:00.000000Z', deletedDate: null, name: 'Express', description: 'A framework for Node.', resourceLink: null, imageLink: null, categoryId: 9, category: null },
];

export const technologiesEnvelope = (data: unknown = technologyRows) => ({
  statusCode: 200,
  message: 'Successfully fetched technologies',
  data,
  meta: null,
});
