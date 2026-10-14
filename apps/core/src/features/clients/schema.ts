import { z } from 'zod';

const nullToEmpty = (text: string | null) => text ?? '';
const orNull = (text: string) => (text === '' ? null : text);

// Only what the page uses. The service also sends `status` and the created, updated and deleted dates, and the
// embedded country's codes; unknown keys are dropped. A client saved without a description or a city comes back
// with null, which the page treats as empty. `country` is null with no country, or with a soft-deleted one while
// `countryId` is still set.
export const clientRowSchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    description: z.string().nullable().transform(nullToEmpty),
    countryId: z.number().int().nullable(),
    city: z.string().nullable().transform(nullToEmpty),
    country: z.object({ nicename: z.string() }).nullable(),
  })
  .transform(({ country, ...row }) => ({ ...row, countryName: country?.nicename ?? '' }));

export const clientRowsSchema = z.array(clientRowSchema);

export type ClientRow = z.output<typeof clientRowSchema>;

export const contactRowSchema = z.object({
  id: z.number().int(),
  clientId: z.number().int(),
  name: z.string(),
  email: z.string().nullable().transform(nullToEmpty),
  phone: z.string().nullable().transform(nullToEmpty),
});

export const contactRowsSchema = z.array(contactRowSchema);

export type ContactRow = z.output<typeof contactRowSchema>;

interface ContactGroup {
  contactName: string;
  contactEmail: string;
  contactPhone: string;
}

/** The contact group is optional as a whole: it counts as filled as soon as any of its fields is. */
export function contactIsFilled({ contactName, contactEmail, contactPhone }: ContactGroup): boolean {
  return contactName !== '' || contactEmail !== '' || contactPhone !== '';
}

// Every field is text, so a blank field can be told from a typed one; `countryId` is '' for None.
export const clientFormSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required'),
    description: z.string().trim(),
    countryId: z.string(),
    city: z.string().trim(),
    contactName: z.string().trim(),
    contactEmail: z.string().trim(),
    contactPhone: z.string().trim(),
  })
  .superRefine((values, context) => {
    if (contactIsFilled(values) && values.contactName === '') {
      context.addIssue({ code: 'custom', path: ['contactName'], message: 'Contact name is required' });
    }
    if (values.contactEmail !== '' && !z.email().safeParse(values.contactEmail).success) {
      context.addIssue({ code: 'custom', path: ['contactEmail'], message: 'Enter a valid email address' });
    }
  });

export type ClientFormValues = z.infer<typeof clientFormSchema>;

export const emptyClientForm: ClientFormValues = {
  name: '',
  description: '',
  countryId: '',
  city: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
};

export function toFormValues(client?: ClientRow, contact?: ContactRow): ClientFormValues {
  if (!client) return emptyClientForm;
  return {
    name: client.name,
    description: client.description,
    // A country the service no longer lists comes back as null: the form opens on None, not on a stale id.
    countryId: client.countryId !== null && client.countryName !== '' ? String(client.countryId) : '',
    city: client.city,
    contactName: contact?.name ?? '',
    contactEmail: contact?.email ?? '',
    contactPhone: contact?.phone ?? '',
  };
}

export interface ClientBody {
  name: string;
  description: string | null;
  countryId: number | null;
  city: string | null;
}

/** Empty optional fields go as null: PATCH changes only what it is sent, and null clears. */
export function toClientBody(values: ClientFormValues): ClientBody {
  return {
    name: values.name,
    description: orNull(values.description),
    countryId: values.countryId === '' ? null : Number(values.countryId),
    city: orNull(values.city),
  };
}

export interface ContactFields {
  name: string;
  email: string | null;
  phone: string | null;
}

export type ContactStep =
  | { kind: 'create'; clientId: number; fields: ContactFields }
  | { kind: 'update'; id: number; fields: ContactFields }
  | { kind: 'remove'; id: number };

/** What the contact needs once the client exists: nothing, a new contact, an edit, or removal. */
export function planContactStep(
  values: ClientFormValues,
  clientId: number,
  existing: ContactRow | undefined,
): ContactStep | null {
  if (!contactIsFilled(values)) return existing ? { kind: 'remove', id: existing.id } : null;
  const fields: ContactFields = {
    name: values.contactName,
    email: orNull(values.contactEmail),
    phone: orNull(values.contactPhone),
  };
  return existing ? { kind: 'update', id: existing.id, fields } : { kind: 'create', clientId, fields };
}

export interface ClientListRow extends ClientRow {
  contact: ContactRow | undefined;
  // Flattened so the search can read them like any other column.
  contactName: string;
  contactEmail: string;
}

/** One row per client. The service allows one live contact per client; if it ever sent two, the first wins. */
export function joinContacts(clients: ClientRow[], contacts: ContactRow[]): ClientListRow[] {
  const byClient = new Map<number, ContactRow>();
  for (const contact of contacts) {
    if (!byClient.has(contact.clientId)) byClient.set(contact.clientId, contact);
  }
  return clients.map((client) => {
    const contact = byClient.get(client.id);
    return { ...client, contact, contactName: contact?.name ?? '', contactEmail: contact?.email ?? '' };
  });
}
