import { z } from 'zod';

const nullToEmpty = (text: string | null) => text ?? '';
const orNull = (text: string) => (text === '' ? null : text);

const INT32_MAX = 2_147_483_647;

export const billingTypeSchema = z.enum(['retainer', 'fixed_cost']);
export const projectTypeSchema = z.enum(['resource_augmentation', 'product']);

export type BillingType = z.infer<typeof billingTypeSchema>;
export type ProjectType = z.infer<typeof projectTypeSchema>;

export const BILLING_LABELS: Record<BillingType, string> = { retainer: 'Retainer', fixed_cost: 'Fixed cost' };
export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  resource_augmentation: 'Resource augmentation',
  product: 'Product',
};

export const billingOptions = billingTypeSchema.options.map((value) => ({ value, label: BILLING_LABELS[value] }));
export const projectTypeOptions = projectTypeSchema.options.map((value) => ({
  value,
  label: PROJECT_TYPE_LABELS[value],
}));

// Only what the pages use. The service also sends `status`, the audit dates and the embedded client's other
// fields; unknown keys are dropped. `client` is null with no client, or with a soft-deleted one while `clientId`
// is still set. Both types are null on a project saved before they existed.
export const projectRowSchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    description: z.string().nullable().transform(nullToEmpty),
    clientId: z.number().int().nullable(),
    client: z.object({ name: z.string() }).nullable(),
    projectType: projectTypeSchema.nullable(),
    billingType: billingTypeSchema.nullable(),
    totalValue: z.number().int(),
    totalOutstanding: z.number().int(),
  })
  .transform(({ client, ...row }) => ({
    ...row,
    clientName: client?.name ?? '',
    // Flattened so the search can read them like any other column; empty while the project has no type.
    projectTypeLabel: row.projectType ? PROJECT_TYPE_LABELS[row.projectType] : '',
    billingTypeLabel: row.billingType ? BILLING_LABELS[row.billingType] : '',
  }));

export const projectRowsSchema = z.array(projectRowSchema);

export type ProjectRow = z.output<typeof projectRowSchema>;

export const lineItemRowSchema = z.object({
  id: z.number().int(),
  description: z.string(),
  quantity: z.number().int(),
  rate: z.number().int(),
  amount: z.number().int(),
});

export const invoiceRowSchema = z.object({
  id: z.number().int(),
  projectId: z.number().int(),
  number: z.string(),
  description: z.string().nullable().transform(nullToEmpty),
  // Calculated by the service from the lines; never sent.
  amount: z.number().int(),
  issueDate: z.iso.date(),
  dueDate: z.iso.date().nullable(),
  paidDate: z.iso.date().nullable(),
  lineItems: z.array(lineItemRowSchema),
});

export const invoiceRowsSchema = z.array(invoiceRowSchema);

export type InvoiceRow = z.output<typeof invoiceRowSchema>;

/** Newest issue date first; on a tie the invoice entered later goes first. Leaves the list it is given alone. */
export function sortInvoices(rows: readonly InvoiceRow[]): InvoiceRow[] {
  return [...rows].sort((a, b) => b.issueDate.localeCompare(a.issueDate) || b.id - a.id);
}

// Every field is text, so a blank field can be told from a typed one; `clientId` is '' for None.
export const projectFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  description: z.string().trim(),
  clientId: z.string(),
  projectType: z.string().refine((value) => projectTypeSchema.safeParse(value).success, 'Choose a project type'),
  billingType: z.string().refine((value) => billingTypeSchema.safeParse(value).success, 'Choose a billing type'),
});

export type ProjectFormValues = z.infer<typeof projectFormSchema>;

export const emptyProjectForm: ProjectFormValues = {
  name: '',
  description: '',
  clientId: '',
  projectType: '',
  billingType: '',
};

export function toProjectFormValues(project?: ProjectRow): ProjectFormValues {
  if (!project) return emptyProjectForm;
  return {
    name: project.name,
    description: project.description,
    // A client the service no longer embeds comes back as null: the form opens on None, not on a stale id.
    clientId: project.clientId !== null && project.clientName !== '' ? String(project.clientId) : '',
    // A legacy project has no types yet: the selects open on "Choose" and saving asks for a pick.
    projectType: project.projectType ?? '',
    billingType: project.billingType ?? '',
  };
}

export interface ProjectBody {
  name: string;
  description: string | null;
  clientId: number | null;
  projectType: ProjectType;
  billingType: BillingType;
}

/** Empty optional fields go as null: PATCH changes only what it is sent, and null clears. */
export function toProjectBody(values: ProjectFormValues): ProjectBody {
  return {
    name: values.name,
    description: orNull(values.description),
    clientId: values.clientId === '' ? null : Number(values.clientId),
    projectType: projectTypeSchema.parse(values.projectType),
    billingType: billingTypeSchema.parse(values.billingType),
  };
}

export const invoiceFormSchema = z.object({
  number: z.string().trim().min(1, 'Number is required'),
  description: z.string().trim(),
  // Text, not a number input: a comma, a currency sign or a decimal point must be told what is wrong, not dropped.
  amount: z
    .string()
    .trim()
    .superRefine((text, context) => {
      if (text === '') context.addIssue({ code: 'custom', message: 'Amount is required' });
      else if (!/^\d+$/.test(text)) context.addIssue({ code: 'custom', message: 'Enter a whole number, like 1200' });
      else if (Number(text) > INT32_MAX) context.addIssue({ code: 'custom', message: 'Amount is too large' });
    }),
  issueDate: z.string().min(1, 'Issue date is required'),
  dueDate: z.string(),
  paidDate: z.string(),
});

export type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;

export const emptyInvoiceForm: InvoiceFormValues = {
  number: '',
  description: '',
  amount: '',
  issueDate: '',
  dueDate: '',
  paidDate: '',
};

export function toInvoiceFormValues(invoice?: InvoiceRow): InvoiceFormValues {
  if (!invoice) return emptyInvoiceForm;
  return {
    number: invoice.number,
    description: invoice.description,
    amount: String(invoice.amount),
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate ?? '',
    paidDate: invoice.paidDate ?? '',
  };
}

export interface InvoiceBody {
  number: string;
  description: string | null;
  amount: number;
  issueDate: string;
  dueDate: string | null;
  paidDate: string | null;
}

/** An invoice cannot move to another project, so the body never carries one; a create adds `projectId`. */
export function toInvoiceBody(values: InvoiceFormValues): InvoiceBody {
  return {
    number: values.number,
    description: orNull(values.description),
    amount: Number(values.amount),
    issueDate: values.issueDate,
    dueDate: orNull(values.dueDate),
    paidDate: orNull(values.paidDate),
  };
}

/** The lines a new invoice would start with (GET /projects/:id/invoice-draft). Quantity is hours on a retainer. */
export const invoiceDraftSchema = z.object({
  lineItems: z.array(z.object({ description: z.string(), quantity: z.number().int(), rate: z.number().int() })),
});

export type InvoiceDraft = z.output<typeof invoiceDraftSchema>;

const MAX_RESOURCE_RATE = 1_000_000;

// `person` and `category` are null with none, or with a soft-deleted one while the id is still set. Only the names
// are read; the ids stay so a form can tell "no person" from "a person who has gone".
export const resourceRowSchema = z
  .object({
    id: z.number().int(),
    projectId: z.number().int(),
    personId: z.number().int().nullable(),
    categoryId: z.number().int(),
    name: z.string(),
    rate: z.number().int(),
    person: z.object({ name: z.string() }).nullable(),
    category: z.object({ name: z.string() }).nullable(),
  })
  .transform(({ person, category, ...row }) => ({
    ...row,
    personName: person?.name ?? '',
    categoryName: category?.name ?? '',
  }));

export const resourceRowsSchema = z.array(resourceRowSchema);

export type ResourceRow = z.output<typeof resourceRowSchema>;

// Every field is text, so a blank field can be told from a typed one; `personId` is '' for None.
export const resourceFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  personId: z.string(),
  categoryId: z.string().min(1, 'Choose a category'),
  // Text, not a number input: a comma, a currency sign or a decimal point must be told what is wrong, not dropped.
  rate: z
    .string()
    .trim()
    .superRefine((text, context) => {
      if (text === '') context.addIssue({ code: 'custom', message: 'Rate is required' });
      else if (!/^\d+$/.test(text)) context.addIssue({ code: 'custom', message: 'Enter a whole number, like 85' });
      else if (Number(text) > MAX_RESOURCE_RATE) context.addIssue({ code: 'custom', message: 'Rate is too large' });
    }),
});

export type ResourceFormValues = z.infer<typeof resourceFormSchema>;

export const emptyResourceForm: ResourceFormValues = { name: '', personId: '', categoryId: '', rate: '' };

export function toResourceFormValues(resource?: ResourceRow): ResourceFormValues {
  if (!resource) return emptyResourceForm;
  return {
    name: resource.name,
    // A person or a category the service no longer embeds comes back as null: the form opens on None, or on
    // "Choose", not on a stale id.
    personId: resource.personId !== null && resource.personName !== '' ? String(resource.personId) : '',
    categoryId: resource.categoryName !== '' ? String(resource.categoryId) : '',
    rate: String(resource.rate),
  };
}

export interface ResourceBody {
  name: string;
  personId: number | null;
  categoryId: number;
  rate: number;
}

/** A resource cannot move to another project, so the body never carries one; a create adds `projectId`. */
export function toResourceBody(values: ResourceFormValues): ResourceBody {
  return {
    name: values.name,
    personId: values.personId === '' ? null : Number(values.personId),
    categoryId: Number(values.categoryId),
    rate: Number(values.rate),
  };
}
