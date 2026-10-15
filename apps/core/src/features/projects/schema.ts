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
    // Null until set; the key numbers the project's invoices, the billing address prints under "Billed To".
    key: z.string().nullable().transform(nullToEmpty),
    billingAddress: z.string().nullable().transform(nullToEmpty),
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
  headcount: z.number().int(),
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
  // The billing period the invoice covers; null on an invoice saved before periods existed.
  periodStart: z.iso.date().nullable(),
  periodEnd: z.iso.date().nullable(),
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
  // Capitals are applied as the person types and again on send; 2 to 10 letters or digits, or empty for none.
  key: z.string().trim().refine((value) => value === '' || /^[A-Za-z0-9]{2,10}$/.test(value), 'Use 2 to 10 letters or digits'),
  billingAddress: z.string().trim().max(1000, 'Keep the address under 1,000 characters'),
  clientId: z.string(),
  projectType: z.string().refine((value) => projectTypeSchema.safeParse(value).success, 'Choose a project type'),
  billingType: z.string().refine((value) => billingTypeSchema.safeParse(value).success, 'Choose a billing type'),
});

export type ProjectFormValues = z.infer<typeof projectFormSchema>;

export const emptyProjectForm: ProjectFormValues = {
  name: '',
  description: '',
  key: '',
  billingAddress: '',
  clientId: '',
  projectType: '',
  billingType: '',
};

export function toProjectFormValues(project?: ProjectRow): ProjectFormValues {
  if (!project) return emptyProjectForm;
  return {
    name: project.name,
    description: project.description,
    key: project.key,
    billingAddress: project.billingAddress,
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
  key: string | null;
  billingAddress: string | null;
}

/** Empty optional fields go as null: PATCH changes only what it is sent, and null clears. */
export function toProjectBody(values: ProjectFormValues): ProjectBody {
  return {
    name: values.name,
    description: orNull(values.description),
    clientId: values.clientId === '' ? null : Number(values.clientId),
    projectType: projectTypeSchema.parse(values.projectType),
    billingType: billingTypeSchema.parse(values.billingType),
    key: values.key.trim() === '' ? null : values.key.trim().toUpperCase(),
    billingAddress: orNull(values.billingAddress.trim()),
  };
}

const MAX_QUANTITY = 100_000;
const WHOLE_NUMBER = /^\d+$/;

/** A line's amount from its text fields: null until both are whole numbers. */
export function lineAmount(line: { quantity: string; rate: string }): number | null {
  const quantity = line.quantity.trim();
  const rate = line.rate.trim();
  if (!WHOLE_NUMBER.test(quantity) || !WHOLE_NUMBER.test(rate)) return null;
  return Number(quantity) * Number(rate);
}

export function linesTotal(lines: readonly { quantity: string; rate: string }[]): number {
  return lines.reduce((sum, line) => sum + (lineAmount(line) ?? 0), 0);
}

// Text, not number inputs: a comma, a currency sign or a decimal point must be told what is wrong, not dropped.
export const lineFormSchema = z
  .object({
    description: z.string().trim().min(1, 'Description is required'),
    quantity: z
      .string()
      .trim()
      .superRefine((text, context) => {
        if (text === '') context.addIssue({ code: 'custom', message: 'Quantity is required' });
        else if (!WHOLE_NUMBER.test(text))
          context.addIssue({ code: 'custom', message: 'Enter a whole number, like 160' });
        else if (Number(text) < 1 || Number(text) > MAX_QUANTITY)
          context.addIssue({ code: 'custom', message: 'Quantity must be from 1 to 100,000' });
      }),
    rate: z
      .string()
      .trim()
      .superRefine((text, context) => {
        if (text === '') context.addIssue({ code: 'custom', message: 'Rate is required' });
        else if (!WHOLE_NUMBER.test(text)) context.addIssue({ code: 'custom', message: 'Enter a whole number, like 85' });
        else if (Number(text) > INT32_MAX) context.addIssue({ code: 'custom', message: 'Rate is too large' });
      }),
  })
  .superRefine((line, context) => {
    // Each field can be in range while the line is not: the service refuses a line above its integer limit. Said
    // only when each field is in range, so a rate that is already too large is not also reported as a large line.
    const amount = lineAmount(line);
    const quantity = Number(line.quantity.trim());
    const rate = Number(line.rate.trim());
    const eachInRange = quantity >= 1 && quantity <= MAX_QUANTITY && rate <= INT32_MAX;
    if (amount !== null && eachInRange && amount > INT32_MAX) {
      context.addIssue({ code: 'custom', path: ['rate'], message: 'This line is too large' });
    }
  });

export type LineFormValues = z.infer<typeof lineFormSchema>;

export const blankLine: LineFormValues = { description: '', quantity: '', rate: '' };

export const invoiceFormSchema = z.object({
  number: z.string().trim().min(1, 'Number is required'),
  description: z.string().trim(),
  issueDate: z.string().min(1, 'Issue date is required'),
  dueDate: z.string(),
  paidDate: z.string(),
  lines: z.array(lineFormSchema).min(1, 'Add at least one line'),
});

export type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;

export const emptyInvoiceForm: InvoiceFormValues = {
  number: '',
  description: '',
  issueDate: '',
  dueDate: '',
  paidDate: '',
  lines: [{ ...blankLine }],
};

export function toInvoiceFormValues(invoice?: InvoiceRow): InvoiceFormValues {
  if (!invoice) return emptyInvoiceForm;
  return {
    number: invoice.number,
    description: invoice.description,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate ?? '',
    paidDate: invoice.paidDate ?? '',
    lines:
      invoice.lineItems.length > 0
        ? invoice.lineItems.map((item) => ({
            description: item.description,
            quantity: String(item.quantity),
            rate: String(item.rate),
          }))
        : [{ ...blankLine }],
  };
}

export interface LineItemBody {
  description: string;
  quantity: number;
  rate: number;
}

export interface InvoiceBody {
  number: string;
  description: string | null;
  issueDate: string;
  dueDate: string | null;
  paidDate: string | null;
  /** The whole set: the service replaces the invoice's lines with these. */
  lineItems: LineItemBody[];
}

/** An invoice cannot move to another project, so the body never carries one; a create adds `projectId`. */
export function toInvoiceBody(values: InvoiceFormValues): InvoiceBody {
  return {
    number: values.number,
    description: orNull(values.description),
    issueDate: values.issueDate,
    dueDate: orNull(values.dueDate),
    paidDate: orNull(values.paidDate),
    lineItems: values.lines.map((line) => ({
      description: line.description,
      quantity: Number(line.quantity),
      rate: Number(line.rate),
    })),
  };
}

/** The lines a new invoice would start with (GET /projects/:id/invoice-draft). Quantity is hours on a retainer. */
export const invoiceDraftSchema = z.object({
  lineItems: z.array(
    z.object({
      description: z.string(),
      headcount: z.number().int(),
      quantity: z.number().int(),
      rate: z.number().int(),
    }),
  ),
});

export type InvoiceDraft = z.output<typeof invoiceDraftSchema>;

/** The draft as text fields, the way the editor holds lines. */
export function draftToLines(draft: InvoiceDraft): LineFormValues[] {
  return draft.lineItems.map((item) => ({
    description: item.description,
    quantity: String(item.quantity),
    rate: String(item.rate),
  }));
}

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
    headcount: z.number().int(),
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
  // Text, like the rate. How many people the row stands for.
  headcount: z
    .string()
    .trim()
    .superRefine((text, context) => {
      if (text === '') context.addIssue({ code: 'custom', message: 'Number of people is required' });
      else if (!/^\d+$/.test(text) || Number(text) < 1 || Number(text) > 1000)
        context.addIssue({ code: 'custom', message: 'Enter a whole number from 1 to 1,000' });
    }),
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

export const emptyResourceForm: ResourceFormValues = {
  name: '',
  personId: '',
  categoryId: '',
  headcount: '1',
  rate: '',
};

export function toResourceFormValues(resource?: ResourceRow): ResourceFormValues {
  if (!resource) return emptyResourceForm;
  return {
    name: resource.name,
    // A person or a category the service no longer embeds comes back as null: the form opens on None, or on
    // "Choose", not on a stale id.
    personId: resource.personId !== null && resource.personName !== '' ? String(resource.personId) : '',
    categoryId: resource.categoryName !== '' ? String(resource.categoryId) : '',
    headcount: String(resource.headcount),
    rate: String(resource.rate),
  };
}

export interface ResourceBody {
  name: string;
  personId: number | null;
  categoryId: number;
  headcount: number;
  rate: number;
}

/** A resource cannot move to another project, so the body never carries one; a create adds `projectId`. */
export function toResourceBody(values: ResourceFormValues): ResourceBody {
  return {
    name: values.name,
    personId: values.personId === '' ? null : Number(values.personId),
    categoryId: Number(values.categoryId),
    headcount: Number(values.headcount),
    rate: Number(values.rate),
  };
}
