import { clientRows, contactRows } from '@/test/fixtures/clients';
import {
  clientFormSchema,
  clientRowsSchema,
  contactRowsSchema,
  emptyClientForm,
  joinContacts,
  planContactStep,
  toClientBody,
  toFormValues,
  type ClientFormValues,
} from './schema';

const form = (over: Partial<ClientFormValues> = {}): ClientFormValues => ({ ...emptyClientForm, name: 'Acme', ...over });

const messages = (values: ClientFormValues) => {
  const result = clientFormSchema.safeParse(values);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

const clients = clientRowsSchema.parse(clientRows);
const contacts = contactRowsSchema.parse(contactRows);

describe('row schemas', () => {
  it('flattens the embedded country to its name and turns nulls into empty text', () => {
    const [acme, globex] = clients;
    expect(acme).toMatchObject({
      id: 1,
      name: 'Acme',
      description: 'Anvils and rockets.',
      countryId: 99,
      city: 'Pune',
      countryName: 'India',
    });
    expect(acme).not.toHaveProperty('country');
    expect(globex).toMatchObject({ id: 2, description: '', countryId: null, city: '', countryName: '' });
  });

  it('keeps the id of a country the service no longer embeds', () => {
    const [row] = clientRowsSchema.parse([{ ...clientRows[0], country: null }]);
    expect(row).toMatchObject({ countryId: 99, countryName: '' });
  });

  it.each([
    ['a name', { ...clientRows[0], name: undefined }],
    ['an id', { ...clientRows[0], id: undefined }],
    ['a country id field', { ...clientRows[0], countryId: undefined }],
  ])('rejects a client row without %s', (_label, row) => {
    expect(clientRowsSchema.safeParse([row]).success).toBe(false);
  });

  it('turns a contact without an email into an empty one', () => {
    expect(contacts[1]).toMatchObject({ clientId: 3, name: 'Grace Hopper', email: '', phone: '+44 20 7946 0001' });
  });

  it.each([
    ['a client id', { ...contactRows[0], clientId: undefined }],
    ['a name', { ...contactRows[0], name: undefined }],
  ])('rejects a contact row without %s', (_label, row) => {
    expect(contactRowsSchema.safeParse([row]).success).toBe(false);
  });
});

describe('clientFormSchema', () => {
  it('accepts a client with no contact', () => {
    expect(messages(form())).toEqual([]);
  });

  it('requires a name', () => {
    expect(messages(form({ name: '   ' }))).toContain('Name is required');
  });

  it('requires a contact name once an email or a phone is given', () => {
    expect(messages(form({ contactEmail: 'ada@example.com' }))).toEqual(['Contact name is required']);
    expect(messages(form({ contactPhone: '123' }))).toEqual(['Contact name is required']);
  });

  it('checks the email address only when there is one', () => {
    expect(messages(form({ contactName: 'Ada', contactEmail: 'not-an-email' }))).toEqual([
      'Enter a valid email address',
    ]);
    expect(messages(form({ contactName: 'Ada', contactEmail: 'ada@example.com' }))).toEqual([]);
    expect(messages(form({ contactName: 'Ada' }))).toEqual([]);
  });

  it('treats a contact group of only spaces as empty', () => {
    const parsed = clientFormSchema.parse(form({ contactName: '  ', contactEmail: ' ', contactPhone: '   ' }));
    expect(parsed).toMatchObject({ contactName: '', contactEmail: '', contactPhone: '' });
  });
});

describe('toClientBody', () => {
  it('sends empty optional fields as null and the country as a number', () => {
    expect(toClientBody(form())).toEqual({ name: 'Acme', description: null, countryId: null, city: null });
    expect(toClientBody(form({ description: 'Anvils', countryId: '99', city: 'Pune' }))).toEqual({
      name: 'Acme',
      description: 'Anvils',
      countryId: 99,
      city: 'Pune',
    });
  });
});

describe('toFormValues', () => {
  it('opens empty for a new client', () => {
    expect(toFormValues()).toEqual(emptyClientForm);
  });

  it('fills the client and its contact', () => {
    expect(toFormValues(clients[0], contacts[0])).toEqual({
      name: 'Acme',
      description: 'Anvils and rockets.',
      countryId: '99',
      city: 'Pune',
      contactName: 'Ada Lovelace',
      contactEmail: 'ada@example.com',
      contactPhone: '+91 20 5550 0100',
    });
  });

  it('leaves the contact group empty for a client without a contact', () => {
    expect(toFormValues(clients[1], undefined)).toMatchObject({ contactName: '', contactEmail: '', contactPhone: '' });
  });

  it('opens on None for a country the service no longer lists', () => {
    const orphan = { ...clients[0], countryName: '' };
    expect(toFormValues(orphan).countryId).toBe('');
  });
});

describe('planContactStep', () => {
  it('creates a contact for a client that has none', () => {
    expect(planContactStep(form({ contactName: 'Ada', contactEmail: 'ada@example.com' }), 7, undefined)).toEqual({
      kind: 'create',
      clientId: 7,
      fields: { name: 'Ada', email: 'ada@example.com', phone: null },
    });
  });

  it('updates the contact a client already has', () => {
    expect(planContactStep(form({ contactName: 'Ada King', contactPhone: '123' }), 1, contacts[0])).toEqual({
      kind: 'update',
      id: 1,
      fields: { name: 'Ada King', email: null, phone: '123' },
    });
  });

  it('removes the contact when the group is emptied', () => {
    expect(planContactStep(form(), 1, contacts[0])).toEqual({ kind: 'remove', id: 1 });
  });

  it('does nothing when there was no contact and none was entered', () => {
    expect(planContactStep(form(), 2, undefined)).toBeNull();
  });
});

describe('joinContacts', () => {
  it('attaches each contact to its client and flattens it for searching', () => {
    const rows = joinContacts(clients, contacts);
    expect(rows.map((row) => row.contact?.id)).toEqual([1, undefined, 2]);
    expect(rows[0]).toMatchObject({ contactName: 'Ada Lovelace', contactEmail: 'ada@example.com' });
    expect(rows[1]).toMatchObject({ contactName: '', contactEmail: '' });
  });

  it('keeps the first contact when the service somehow sends two for one client', () => {
    const second = { ...contacts[0], id: 9, name: 'Someone Else' };
    const [acme] = joinContacts(clients, [contacts[0], second]);
    expect(acme.contact?.id).toBe(1);
  });
});
