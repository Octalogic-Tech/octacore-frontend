import { unwrap } from '@/lib/core-api';
import { clientRowSchema, clientRowsSchema, contactRowSchema, contactRowsSchema } from './schema';
import { signInLive, type LiveSend } from '@/test/live-api';

// Opt-in: this talks to the real FastAPI service and WRITES to it (it adds a client and a contact, edits the
// contact and deletes the client again; deletes are soft, so rows stay in the tables). It only runs when
// CORE_API_WRITE_URL names a service on a scratch database, never one you care about.
//   (in octacore-backend)  DB_NAME=<scratch db> .venv/bin/uvicorn app.main:create_app --factory --port 5003
//   (here)                 CORE_API_WRITE_URL=http://127.0.0.1:5003/api/v1 CORE_API_TEST_EMAIL=<email> CORE_API_TEST_PASSWORD=<password> pnpm exec nx test core --skip-nx-cache
const base = process.env.CORE_API_WRITE_URL;

let send: LiveSend;

const listedClients = async () => unwrap(await (await send('GET', '/clients')).json(), clientRowsSchema);
const listedContacts = async () => unwrap(await (await send('GET', '/client-contacts')).json(), contactRowsSchema);

describe.skipIf(!base)('the running core service, clients and their contacts', () => {
  beforeAll(async () => {
    send = await signInLive(base as string);
  });

  it('takes the bodies the page sends, holds one contact per client, and removes it with the client', async () => {
    const createdClient = await send('POST', '/clients', {
      name: 'Wiring check',
      description: null,
      countryId: null,
      city: null,
    });
    expect(createdClient.status).toBe(201);
    const client = unwrap(await createdClient.json(), clientRowSchema);
    expect(client).toMatchObject({ name: 'Wiring check', description: '', countryId: null, city: '', countryName: '' });

    let contactId: number | undefined;
    try {
      const createdContact = await send('POST', '/client-contacts', {
        clientId: client.id,
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        phone: null,
      });
      expect(createdContact.status).toBe(201);
      const contact = unwrap(await createdContact.json(), contactRowSchema);
      contactId = contact.id;
      expect(contact).toMatchObject({ clientId: client.id, name: 'Ada Lovelace', email: 'ada@example.com', phone: '' });
      expect(await listedContacts()).toContainEqual(contact);

      const second = await send('POST', '/client-contacts', {
        clientId: client.id,
        name: 'Grace Hopper',
        email: null,
        phone: null,
      });
      expect(second.status).toBe(409);

      const updated = await send('PATCH', `/client-contacts/${contact.id}`, {
        name: 'Ada King',
        email: null,
        phone: '+44 20 7946 0000',
      });
      expect(updated.status).toBe(200);
      expect(unwrap(await updated.json(), contactRowSchema)).toMatchObject({
        id: contact.id,
        name: 'Ada King',
        email: '',
        phone: '+44 20 7946 0000',
      });
    } finally {
      const deleted = await send('DELETE', `/clients/${client.id}`);
      expect(deleted.status).toBe(200);
    }
    expect((await listedClients()).map((row) => row.id)).not.toContain(client.id);
    expect((await listedContacts()).map((row) => row.id)).not.toContain(contactId);
  });

  it('refuses a contact for a client that does not exist, with an error envelope', async () => {
    const response = await send('POST', '/client-contacts', { clientId: 99999, name: 'Nobody' });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ statusCode: 409, data: null });
  });

  it('answers a contact that does not exist with an error envelope', async () => {
    const response = await send('DELETE', '/client-contacts/99999');
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ statusCode: 404, data: null });
  });
});
