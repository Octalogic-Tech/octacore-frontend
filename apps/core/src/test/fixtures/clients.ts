// Rows shaped like GET http://localhost:5001/api/v1/clients and /client-contacts (octacore-backend, FastAPI), in
// the service's own envelope; the values are made up. A client saved without a description, a city or a country
// comes back with null for each, and `country` is null as well. The embedded country carries all its fields.
const stamp = '2026-10-14T14:41:42.928081Z';
const audit = { status: 1, createdDate: stamp, updatedDate: stamp, deletedDate: null };

const india = { ...audit, id: 99, iso: 'IN', name: 'INDIA', nicename: 'India', iso3: 'IND', numcode: 356, phonecode: 91 };
const britain = {
  ...audit,
  id: 225,
  iso: 'GB',
  name: 'UNITED KINGDOM',
  nicename: 'United Kingdom',
  iso3: 'GBR',
  numcode: 826,
  phonecode: 44,
};

export const clientRows = [
  { ...audit, id: 1, name: 'Acme', description: 'Anvils and rockets.', countryId: 99, city: 'Pune', country: india },
  { ...audit, id: 2, name: 'Globex', description: null, countryId: null, city: null, country: null },
  { ...audit, id: 3, name: 'Initech', description: 'Software for banks.', countryId: 225, city: 'London', country: britain },
];

export const contactRows = [
  { ...audit, id: 1, clientId: 1, name: 'Ada Lovelace', email: 'ada@example.com', phone: '+91 20 5550 0100' },
  { ...audit, id: 2, clientId: 3, name: 'Grace Hopper', email: null, phone: '+44 20 7946 0001' },
];

export const clientsEnvelope = (data: unknown = clientRows) => ({
  statusCode: 200,
  message: 'Successfully fetched clients',
  data,
  meta: null,
});

export const contactsEnvelope = (data: unknown = contactRows) => ({
  statusCode: 200,
  message: 'Successfully fetched client contacts',
  data,
  meta: null,
});

/** What POST /clients answers: the new client, under the id the service gave it. */
export const createdClientEnvelope = (id: number) => ({
  statusCode: 201,
  message: 'Successfully created "New" client',
  data: { ...audit, id, name: 'New', description: null, countryId: null, city: null, country: null },
  meta: null,
});
