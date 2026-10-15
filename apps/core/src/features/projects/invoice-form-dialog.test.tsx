import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import { useState } from 'react';
import { coreApi } from '@/lib/core-api';
import { draftEnvelope, invoiceRows, nextNumberEnvelope } from '@/test/fixtures/projects';
import { renderWithProviders } from '@/test/utils';
import { InvoiceFormDialog } from './invoice-form-dialog';
import { invoiceRowsSchema, type InvoiceRow } from './schema';

vi.mock('@/lib/core-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/core-api')>()),
  coreApi: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const [paid, unpaid] = invoiceRowsSchema.parse(invoiceRows);

/** What the migration leaves behind: one line of Qty 1 and 1 hour, the old amount as its rate. */
const [legacy] = invoiceRowsSchema.parse([
  {
    ...invoiceRows[0],
    lineItems: [
      { ...invoiceRows[0].lineItems[0], description: 'October retainer', quantity: 1, rate: 36000, amount: 36000 },
    ],
  },
]);

const onOpenChange = vi.fn();

/** What the service answers a save with; the dialog never reads it. */
const saved = { data: { statusCode: 200, message: 'saved', data: {}, meta: null } };

const failure = (status: number) =>
  new AxiosError('failed', 'ERR_BAD_REQUEST', undefined, null, {
    status,
    data: {},
    statusText: String(status),
    headers: {},
    config: {} as never,
  });

const CHANGED_ELSEWHERE = 'This changed elsewhere, so it cannot be saved. Close this dialog and go back to Projects.';

const DRAFT_PATH = '/projects/1/invoice-draft';
const NEXT_PATH = '/projects/1/next-invoice-number';

/** The owner's sample: 3 Fullstack Developers and 1 Project Lead for 160 hours each. */
const SAMPLE_DRAFT = draftEnvelope({
  lineItems: [
    { description: 'Fullstack Developer', headcount: 3, quantity: 160, rate: 27 },
    { description: 'Project Lead', headcount: 1, quantity: 160, rate: 54 },
  ],
});

interface Served {
  draft?: unknown;
  /** What the next-number route answers for an issue date; null answers a project with no key. */
  next?: (issueDate: string) => string | null;
}

const serve = ({ draft, next }: Served = {}) =>
  vi.mocked(coreApi.get).mockImplementation((async (path: string, config?: { params?: { issueDate?: string } }) => {
    if (path === DRAFT_PATH) return { data: draft ?? draftEnvelope() };
    if (path === NEXT_PATH) {
      const issueDate = config?.params?.issueDate ?? '';
      return { data: nextNumberEnvelope(next ? next(issueDate) : 'OCTA/26-27/WEB/008') };
    }
    throw new Error(`unexpected GET ${path}`);
  }) as never);

const serveDraft = (draft: unknown = draftEnvelope()) => serve({ draft });

const calls = (path: string) => vi.mocked(coreApi.get).mock.calls.filter(([called]) => called === path);

interface DialogProps {
  invoice?: InvoiceRow;
  billingType?: 'retainer' | 'fixed_cost' | null;
  projectKey?: string;
  projectDiscountPercent?: number;
}

function openDialog(props: DialogProps = {}) {
  return renderWithProviders(
    <InvoiceFormDialog open onOpenChange={onOpenChange} projectId={1} billingType="retainer" {...props} />,
  );
}

const line = (n: number) => screen.getByRole('group', { name: `Line ${n}` });

/** Types a date into a date input in one go, the way picking it does. */
async function pickDate(label: string, value: string) {
  const input = screen.getByLabelText(label);
  await userEvent.clear(input);
  await userEvent.type(input, value);
}

beforeEach(() => {
  serve();
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('InvoiceFormDialog: size', () => {
  it('is the wide dialog', async () => {
    openDialog();
    await screen.findByRole('group', { name: 'Line 1' });

    expect(screen.getByRole('dialog', { name: 'New invoice' })).toHaveClass('max-w-6xl');
  });
});

describe('InvoiceFormDialog: the header', () => {
  it('is three lines: number and description; issue date and billing period; due and paid dates', async () => {
    openDialog();
    await screen.findByRole('group', { name: 'Line 1' });

    const row = (label: string) => screen.getByLabelText(label).closest('[data-slot="field"]')?.parentElement;
    expect(row('Number')).toBe(row('Description'));
    expect(row('Issue date')).toBe(row('Billing period start'));
    expect(row('Issue date')).toBe(row('Billing period end'));
    expect(row('Due date')).toBe(row('Paid date'));
    expect(new Set([row('Number'), row('Issue date'), row('Due date')]).size).toBe(3);
  });

  it('reads, and tabs, in that order', async () => {
    openDialog();
    await screen.findByRole('group', { name: 'Line 1' });

    const order = [
      'Number',
      'Description',
      'Issue date',
      'Billing period start',
      'Billing period end',
      'Due date',
      'Paid date',
    ].map((label) => screen.getByLabelText(label));
    order.slice(1).forEach((input, i) => {
      expect(order[i].compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });
});

describe('InvoiceFormDialog: adding to a retainer project', () => {
  it('builds the lines from the draft and saves them with the header', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog();
    expect(screen.getByRole('dialog', { name: 'New invoice' })).toBeInTheDocument();
    await screen.findByRole('group', { name: 'Line 1' });
    expect(screen.getByLabelText('Line 1 description')).toHaveValue('Asha Rao — Mobile');
    expect(screen.getByLabelText('Line 1 qty')).toHaveValue('1');
    expect(screen.getByLabelText('Line 1 hours')).toHaveValue('160');
    expect(screen.getByLabelText('Line 1 rate')).toHaveValue('150');
    expect(within(line(1)).getByText('$24,000')).toBeInTheDocument();
    expect(screen.getByLabelText('Line 2 description')).toHaveValue('Ben Cho — Web');
    expect(within(line(2)).getByText('$12,000')).toBeInTheDocument();
    expect(screen.getByText('Total $36,000')).toBeInTheDocument();
    expect(screen.getByText('Retainer lines are 160 hours a month.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Number'), 'INV-9');
    await user.type(screen.getByLabelText('Issue date'), '2026-10-01');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.post).toHaveBeenCalledTimes(1);
    expect(coreApi.post).toHaveBeenCalledWith('/invoices', {
      projectId: 1,
      number: 'INV-9',
      description: null,
      issueDate: '2026-10-01',
      dueDate: '2027-01-01',
      paidDate: null,
      periodStart: null,
      periodEnd: null,
      discountPercent: 0,
      lineItems: [
        { description: 'Asha Rao — Mobile', headcount: 1, quantity: 160, rate: 150 },
        { description: 'Ben Cho — Web', headcount: 1, quantity: 160, rate: 75 },
      ],
    });
  });

  it('reproduces the owner’s sample from the draft: Qty x Hours x Rate', async () => {
    serveDraft(SAMPLE_DRAFT);
    openDialog();
    await screen.findByRole('group', { name: 'Line 1' });

    expect(screen.getByLabelText('Line 1 qty')).toHaveValue('3');
    expect(screen.getByLabelText('Line 1 hours')).toHaveValue('160');
    expect(screen.getByLabelText('Line 1 rate')).toHaveValue('27');
    expect(within(line(1)).getByText('$12,960')).toBeInTheDocument();
    expect(within(line(2)).getByText('$8,640')).toBeInTheDocument();
    expect(screen.getByText('Total $21,600')).toBeInTheDocument();
  });

  it('names the columns and each line’s amount, so a pre-filled line says which number is which', async () => {
    openDialog();
    await screen.findByRole('group', { name: 'Line 1' });

    expect(screen.getByText('Qty')).toBeInTheDocument();
    expect(screen.getByText('Hours')).toBeInTheDocument();
    expect(screen.getByText('Rate')).toBeInTheDocument();
    expect(screen.getByText('Amount')).toBeInTheDocument();
    expect(screen.getAllByText('Description')).toHaveLength(2); // the invoice's own field, and the column
    expect(within(line(1)).getByText('Line 1 amount')).toBeInTheDocument();
    expect(within(line(2)).getByText('Line 2 amount')).toBeInTheDocument();
  });

  it('lets a line be edited, added and removed before saving, a new line starting at Qty 1', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog();
    await screen.findByRole('group', { name: 'Line 1' });
    await user.clear(screen.getByLabelText('Line 1 hours'));
    await user.type(screen.getByLabelText('Line 1 hours'), '80');
    expect(within(line(1)).getByText('$12,000')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove line 2' }));
    expect(screen.queryByRole('group', { name: 'Line 2' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add line' }));
    expect(screen.getByLabelText('Line 2 qty')).toHaveValue('1');
    await user.type(screen.getByLabelText('Line 2 description'), 'Hosting');
    await user.type(screen.getByLabelText('Line 2 hours'), '1');
    await user.type(screen.getByLabelText('Line 2 rate'), '300');
    expect(screen.getByText('Total $12,300')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Number'), 'INV-9');
    await user.type(screen.getByLabelText('Issue date'), '2026-10-01');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.post).toHaveBeenCalledWith(
      '/invoices',
      expect.objectContaining({
        lineItems: [
          { description: 'Asha Rao — Mobile', headcount: 1, quantity: 80, rate: 150 },
          { description: 'Hosting', headcount: 1, quantity: 1, rate: 300 },
        ],
      }),
    );
  });

  it('cannot remove the last line', async () => {
    const user = userEvent.setup();
    openDialog();
    await screen.findByRole('group', { name: 'Line 2' });
    await user.click(screen.getByRole('button', { name: 'Remove line 2' }));
    expect(screen.getByRole('button', { name: 'Remove line 1' })).toBeDisabled();
  });

  it('says Building lines… until the draft settles, and keeps what was typed in the header', async () => {
    let release: () => void = () => undefined;
    vi.mocked(coreApi.get).mockReturnValue(
      new Promise((resolve) => {
        release = () => resolve({ data: draftEnvelope() });
      }) as never,
    );
    const user = userEvent.setup();
    openDialog();
    await user.type(screen.getByLabelText('Number'), 'INV-7');
    expect(screen.getByRole('status')).toHaveTextContent('Building lines…');
    expect(screen.queryByRole('group', { name: 'Line 1' })).not.toBeInTheDocument();
    act(() => release());
    await screen.findByRole('group', { name: 'Line 1' });
    expect(screen.getByLabelText('Number')).toHaveValue('INV-7');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows a retry and one blank line when the draft cannot be built, and uses the retry’s lines', async () => {
    vi.mocked(coreApi.get).mockRejectedValue(failure(500));
    const user = userEvent.setup();
    openDialog();
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not build the lines.');
    expect(screen.getByLabelText('Line 1 description')).toHaveValue('');
    serveDraft();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.getByLabelText('Line 1 description')).toHaveValue('Asha Rao — Mobile'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows a fresh draft each time the dialog is opened', async () => {
    function Harness() {
      const [open, setOpen] = useState(true);
      return (
        <>
          <button onClick={() => setOpen(true)}>Open it</button>
          <InvoiceFormDialog open={open} onOpenChange={setOpen} projectId={1} billingType="retainer" />
        </>
      );
    }
    const user = userEvent.setup();
    renderWithProviders(<Harness />);
    expect(await screen.findByDisplayValue('Asha Rao — Mobile')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    serveDraft(
      draftEnvelope({ lineItems: [{ description: 'Cara Diaz — Web', headcount: 1, quantity: 160, rate: 90 }] }),
    );
    await user.click(screen.getByRole('button', { name: 'Open it' }));

    expect(await screen.findByDisplayValue('Cara Diaz — Web')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Asha Rao — Mobile')).not.toBeInTheDocument();
    expect(calls(DRAFT_PATH)).toHaveLength(2);
  });

  it('asks for a number and an issue date, and sends nothing', async () => {
    const user = userEvent.setup();
    openDialog();
    await screen.findByRole('group', { name: 'Line 1' });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Number is required')).toBeInTheDocument();
    expect(screen.getByText('Issue date is required')).toBeInTheDocument();
    expect(coreApi.post).not.toHaveBeenCalled();
  });

  it('sends one request however often Save is clicked while it is saving', async () => {
    let release: () => void = () => undefined;
    vi.mocked(coreApi.post).mockReturnValue(
      new Promise((resolve) => {
        release = () => resolve(saved);
      }) as never,
    );
    const user = userEvent.setup();
    openDialog();
    await screen.findByRole('group', { name: 'Line 1' });
    await user.type(screen.getByLabelText('Number'), 'INV-9');
    await user.type(screen.getByLabelText('Issue date'), '2026-10-01');
    const save = screen.getByRole('button', { name: 'Save' });
    await user.click(save);
    await waitFor(() => expect(save).toBeDisabled());
    await user.click(save);
    act(() => release());
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.post).toHaveBeenCalledTimes(1);
  });
});

describe('InvoiceFormDialog: line validation', () => {
  async function fillLine(fields: { qty?: string; hours: string; rate: string }) {
    const user = userEvent.setup();
    // The draft is requested when the dialog mounts, so the mock must be in place before it opens.
    serveDraft(draftEnvelope({ lineItems: [] }));
    openDialog({ billingType: 'fixed_cost' });
    await screen.findByRole('group', { name: 'Line 1' });
    await user.type(screen.getByLabelText('Number'), 'INV-9');
    await user.type(screen.getByLabelText('Issue date'), '2026-10-01');
    await user.type(screen.getByLabelText('Line 1 description'), 'Milestone');
    if (fields.qty !== undefined) {
      await user.clear(screen.getByLabelText('Line 1 qty'));
      if (fields.qty) await user.type(screen.getByLabelText('Line 1 qty'), fields.qty);
    }
    if (fields.hours) await user.type(screen.getByLabelText('Line 1 units'), fields.hours);
    if (fields.rate) await user.type(screen.getByLabelText('Line 1 rate'), fields.rate);
    await user.click(screen.getByRole('button', { name: 'Save' }));
  }

  it.each(['42.50', '$85', '1,200'])('says what is wrong with a rate of %s and sends nothing', async (rate) => {
    await fillLine({ hours: '1', rate });
    expect(await screen.findByText('Enter a whole number, like 85')).toBeInTheDocument();
    expect(coreApi.post).not.toHaveBeenCalled();
  });

  it('asks for hours and a rate on a line', async () => {
    await fillLine({ hours: '', rate: '' });
    expect(await screen.findByText('Quantity is required')).toBeInTheDocument();
    expect(screen.getByText('Rate is required')).toBeInTheDocument();
    expect(coreApi.post).not.toHaveBeenCalled();
  });

  it.each([
    ['', 'Qty is required'],
    ['0', 'Qty must be from 1 to 1,000'],
    ['1001', 'Qty must be from 1 to 1,000'],
    ['2.5', 'Enter a whole number, like 3'],
  ])('refuses a Qty of %j: %s', async (qty, message) => {
    await fillLine({ qty, hours: '10', rate: '5' });
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(coreApi.post).not.toHaveBeenCalled();
  });

  it('refuses a line whose Qty x hours x rate is past the limit the service holds', async () => {
    await fillLine({ qty: '1000', hours: '100', rate: '21475' });
    expect(await screen.findByText('This line is too large')).toBeInTheDocument();
    expect(coreApi.post).not.toHaveBeenCalled();
  });

  it('links each line error to the field it belongs to', async () => {
    await fillLine({ hours: '', rate: '' });
    await screen.findByText('Quantity is required');

    for (const [field, message] of [
      ['units', 'Quantity is required'],
      ['rate', 'Rate is required'],
    ] as const) {
      const describedBy = screen.getByLabelText(`Line 1 ${field}`).getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();
      expect(document.getElementById(describedBy as string)).toHaveTextContent(message);
    }
  });
});

describe('InvoiceFormDialog: adding to a fixed cost project', () => {
  it('says Units, never Hours, opens on one blank line, and sends the line typed by hand', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    serveDraft(draftEnvelope({ lineItems: [] }));
    const user = userEvent.setup();
    openDialog({ billingType: 'fixed_cost' });
    await screen.findByRole('group', { name: 'Line 1' });
    expect(screen.queryByRole('group', { name: 'Line 2' })).not.toBeInTheDocument();
    expect(screen.getByText('Units')).toBeInTheDocument();
    expect(screen.queryByText('Hours')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Line 1 description')).toHaveValue('');
    expect(screen.getByLabelText('Line 1 qty')).toHaveValue('1');
    expect(screen.queryByText('Retainer lines are 160 hours a month.')).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Number'), 'INV-1');
    await user.type(screen.getByLabelText('Issue date'), '2026-10-01');
    await user.type(screen.getByLabelText('Line 1 description'), 'Milestone 1');
    await user.type(screen.getByLabelText('Line 1 units'), '1');
    await user.type(screen.getByLabelText('Line 1 rate'), '5000');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.post).toHaveBeenCalledWith('/invoices', {
      projectId: 1,
      number: 'INV-1',
      description: null,
      issueDate: '2026-10-01',
      dueDate: '2027-01-01',
      paidDate: null,
      periodStart: null,
      periodEnd: null,
      discountPercent: 0,
      lineItems: [{ description: 'Milestone 1', headcount: 1, quantity: 1, rate: 5000 }],
    });
  });

  it('says Units too on a project from before billing types', async () => {
    serveDraft(draftEnvelope({ lineItems: [] }));
    openDialog({ billingType: null });
    await screen.findByRole('group', { name: 'Line 1' });

    expect(screen.getByText('Units')).toBeInTheDocument();
  });
});

describe('InvoiceFormDialog: the due date', () => {
  it('fills to three months after the issue date, and follows it while the person has not typed one', async () => {
    openDialog();
    await screen.findByRole('group', { name: 'Line 1' });

    await pickDate('Issue date', '2026-10-01');
    expect(screen.getByLabelText('Due date')).toHaveValue('2027-01-01');

    await pickDate('Issue date', '2026-11-15');
    expect(screen.getByLabelText('Due date')).toHaveValue('2027-02-15');
  });

  it('clamps a month-end: 30 November is due 28 February', async () => {
    openDialog();
    await screen.findByRole('group', { name: 'Line 1' });

    await pickDate('Issue date', '2026-11-30');

    expect(screen.getByLabelText('Due date')).toHaveValue('2027-02-28');
  });

  it('never replaces a due date the person typed', async () => {
    openDialog();
    await screen.findByRole('group', { name: 'Line 1' });
    await pickDate('Issue date', '2026-10-01');

    await pickDate('Due date', '2026-12-24');
    await pickDate('Issue date', '2026-11-01');

    expect(screen.getByLabelText('Due date')).toHaveValue('2026-12-24');
  });

  it('fills again after the person clears it', async () => {
    openDialog();
    await screen.findByRole('group', { name: 'Line 1' });
    await pickDate('Issue date', '2026-10-01');
    await userEvent.clear(screen.getByLabelText('Due date'));

    await pickDate('Issue date', '2026-10-05');

    expect(screen.getByLabelText('Due date')).toHaveValue('2027-01-05');
  });

  it('keeps the due date already saved on an invoice when its issue date is changed', async () => {
    openDialog({ invoice: paid });
    expect(screen.getByLabelText('Due date')).toHaveValue('2026-10-31');

    await pickDate('Issue date', '2026-10-05');

    expect(screen.getByLabelText('Due date')).toHaveValue('2026-10-31');
  });

  it('does not invent a due date for an invoice that was saved without one just by opening it', async () => {
    openDialog({ invoice: unpaid });

    expect(screen.getByLabelText('Due date')).toHaveValue('');
    expect(screen.getByLabelText('Issue date')).toHaveValue('2026-11-01');
  });
});

describe('InvoiceFormDialog: the billing period', () => {
  it('fills the end to the last day of the start’s month, and follows the start while it is automatic', async () => {
    openDialog();
    await screen.findByRole('group', { name: 'Line 1' });

    await pickDate('Billing period start', '2026-09-15');
    expect(screen.getByLabelText('Billing period end')).toHaveValue('2026-09-30');

    await pickDate('Billing period start', '2026-02-03');
    expect(screen.getByLabelText('Billing period end')).toHaveValue('2026-02-28');
  });

  it('never replaces an end the person typed', async () => {
    openDialog();
    await screen.findByRole('group', { name: 'Line 1' });
    await pickDate('Billing period start', '2026-09-01');

    await pickDate('Billing period end', '2026-09-20');
    await pickDate('Billing period start', '2026-09-02');

    expect(screen.getByLabelText('Billing period end')).toHaveValue('2026-09-20');
  });

  it('opens on an invoice’s saved period and leaves its end alone when the start changes', async () => {
    openDialog({ invoice: paid });
    expect(screen.getByLabelText('Billing period start')).toHaveValue('2026-09-01');
    expect(screen.getByLabelText('Billing period end')).toHaveValue('2026-09-30');

    await pickDate('Billing period start', '2026-09-10');

    expect(screen.getByLabelText('Billing period end')).toHaveValue('2026-09-30');
  });

  it('sends the period, and null for both when there is none', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog();
    await screen.findByRole('group', { name: 'Line 1' });
    await user.type(screen.getByLabelText('Number'), 'INV-9');
    await user.type(screen.getByLabelText('Issue date'), '2026-10-01');
    await pickDate('Billing period start', '2026-09-01');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.post).toHaveBeenCalledWith(
      '/invoices',
      expect.objectContaining({ periodStart: '2026-09-01', periodEnd: '2026-09-30' }),
    );
  });

  it('refuses a lone date and an end before the start, and sends nothing', async () => {
    const user = userEvent.setup();
    openDialog();
    await screen.findByRole('group', { name: 'Line 1' });
    await user.type(screen.getByLabelText('Number'), 'INV-9');
    await user.type(screen.getByLabelText('Issue date'), '2026-10-01');
    await pickDate('Billing period start', '2026-09-01');
    await userEvent.clear(screen.getByLabelText('Billing period end'));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Give both dates, or neither')).toBeInTheDocument();

    await pickDate('Billing period end', '2026-08-15');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('The period must end on or after it starts')).toBeInTheDocument();
    expect(coreApi.post).not.toHaveBeenCalled();
  });
});

describe('InvoiceFormDialog: the number', () => {
  it('is optional on a project with a key, says so, and shows the next number for the issue date', async () => {
    serve({ next: (issueDate) => (issueDate >= '2027-04-01' ? 'OCTA/27-28/WEB/001' : 'OCTA/26-27/WEB/008') });
    openDialog({ projectKey: 'WEB' });
    await screen.findByRole('group', { name: 'Line 1' });
    expect(screen.getByText('Leave empty to use the next number.')).toBeInTheDocument();
    expect(calls(NEXT_PATH)).toHaveLength(0);

    await pickDate('Issue date', '2026-10-01');
    expect(await screen.findByPlaceholderText('Next: OCTA/26-27/WEB/008')).toBeInTheDocument();
    expect(calls(NEXT_PATH)[0][1]).toEqual({ params: { issueDate: '2026-10-01' } });

    await pickDate('Issue date', '2027-04-01');
    expect(await screen.findByPlaceholderText('Next: OCTA/27-28/WEB/001')).toBeInTheDocument();
  });

  it('is sent as null when left empty, so the server numbers it', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog({ projectKey: 'WEB' });
    await screen.findByRole('group', { name: 'Line 1' });
    await user.type(screen.getByLabelText('Issue date'), '2026-10-01');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.post).toHaveBeenCalledWith('/invoices', expect.objectContaining({ number: null }));
  });

  it('is sent as typed when the person types one', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog({ projectKey: 'WEB' });
    await screen.findByRole('group', { name: 'Line 1' });
    await user.type(screen.getByLabelText('Number'), 'OCTA/26-27/WEB/042');
    await user.type(screen.getByLabelText('Issue date'), '2026-10-01');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.post).toHaveBeenCalledWith('/invoices', expect.objectContaining({ number: 'OCTA/26-27/WEB/042' }));
  });

  it('shows no placeholder when the project has no number to offer', async () => {
    serve({ next: () => null });
    openDialog({ projectKey: 'WEB' });
    await screen.findByRole('group', { name: 'Line 1' });
    await pickDate('Issue date', '2026-10-01');
    await waitFor(() => expect(calls(NEXT_PATH)).toHaveLength(1));

    expect(screen.getByLabelText('Number')).not.toHaveAttribute('placeholder');
  });

  it('is required on a project with no key, with no hint and no request for a next number', async () => {
    const user = userEvent.setup();
    openDialog();
    await screen.findByRole('group', { name: 'Line 1' });
    await user.type(screen.getByLabelText('Issue date'), '2026-10-01');
    expect(screen.queryByText('Leave empty to use the next number.')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Number is required')).toBeInTheDocument();
    expect(calls(NEXT_PATH)).toHaveLength(0);
    expect(coreApi.post).not.toHaveBeenCalled();
  });

  it('is always required when editing, even on a project with a key', async () => {
    const user = userEvent.setup();
    openDialog({ invoice: paid, projectKey: 'WEB' });
    await user.clear(screen.getByLabelText('Number'));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Number is required')).toBeInTheDocument();
    expect(coreApi.patch).not.toHaveBeenCalled();
    expect(calls(NEXT_PATH)).toHaveLength(0);
  });
});

describe('InvoiceFormDialog: editing', () => {
  it('opens on the invoice and its lines, asks for no draft, and sends the whole set with PATCH', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog({ invoice: paid });
    expect(screen.getByRole('dialog', { name: 'Edit invoice' })).toBeInTheDocument();
    expect(screen.getByLabelText('Number')).toHaveValue('INV-001');
    expect(screen.getByLabelText('Paid date')).toHaveValue('2026-10-12');
    expect(screen.getByLabelText('Line 1 description')).toHaveValue('Asha Rao — Mobile');
    expect(screen.getByLabelText('Line 2 rate')).toHaveValue('75');
    expect(screen.getByText('Total $36,000')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Paid date'));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.post).not.toHaveBeenCalled();
    expect(coreApi.patch).toHaveBeenCalledWith('/invoices/1', {
      number: 'INV-001',
      description: 'October retainer',
      issueDate: '2026-10-01',
      dueDate: '2026-10-31',
      paidDate: null,
      periodStart: '2026-09-01',
      periodEnd: '2026-09-30',
      discountPercent: 0,
      lineItems: [
        { description: 'Asha Rao — Mobile', headcount: 1, quantity: 160, rate: 150 },
        { description: 'Ben Cho — Web', headcount: 1, quantity: 160, rate: 75 },
      ],
    });
    expect(calls(DRAFT_PATH)).toHaveLength(0);
  });

  it('keeps the single line, and the amount, of an invoice that came from the migration', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog({ invoice: legacy });
    expect(screen.getByLabelText('Line 1 qty')).toHaveValue('1');
    expect(screen.getByLabelText('Line 1 hours')).toHaveValue('1');
    expect(screen.getByLabelText('Line 1 rate')).toHaveValue('36000');
    expect(screen.getByText('Total $36,000')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Description'));
    await user.type(screen.getByLabelText('Description'), 'Edited');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.patch).toHaveBeenCalledWith('/invoices/1', {
      number: 'INV-001',
      description: 'Edited',
      issueDate: '2026-10-01',
      dueDate: '2026-10-31',
      paidDate: '2026-10-12',
      periodStart: '2026-09-01',
      periodEnd: '2026-09-30',
      discountPercent: 0,
      lineItems: [{ description: 'October retainer', headcount: 1, quantity: 1, rate: 36000 }],
    });
  });

  it('saves an invoice that has no period with null for both', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog({ invoice: unpaid });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.patch).toHaveBeenCalledWith(
      '/invoices/2',
      expect.objectContaining({ periodStart: null, periodEnd: null, dueDate: null }),
    );
  });
});

describe('InvoiceFormDialog: failures', () => {
  async function submitFilledForm(invoice?: InvoiceRow) {
    const user = userEvent.setup();
    openDialog({ invoice });
    if (!invoice) {
      await screen.findByRole('group', { name: 'Line 1' });
      await user.type(screen.getByLabelText('Number'), 'INV-9');
      await user.type(screen.getByLabelText('Issue date'), '2026-10-01');
    }
    await user.click(screen.getByRole('button', { name: 'Save' }));
  }

  it('says so, and stays open, when an add fails for any other reason', async () => {
    vi.mocked(coreApi.post).mockRejectedValue(failure(500));
    await submitFilledForm();
    expect(await screen.findByRole('alert')).toHaveTextContent('That did not save. Try again.');
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('does not offer a retry that cannot work when the project was removed elsewhere (409 on add)', async () => {
    vi.mocked(coreApi.post).mockRejectedValue(failure(409));
    await submitFilledForm();
    expect(await screen.findByRole('alert')).toHaveTextContent(CHANGED_ELSEWHERE);
  });

  it('does not offer a retry that cannot work when the invoice was removed elsewhere (404 on edit)', async () => {
    vi.mocked(coreApi.patch).mockRejectedValue(failure(404));
    await submitFilledForm(paid);
    expect(await screen.findByRole('alert')).toHaveTextContent(CHANGED_ELSEWHERE);
  });

  it.each([
    ['a 404 on add', 'post', undefined, 404],
    ['a 409 on edit', 'patch', paid, 409],
  ] as const)('still offers a retry for %s', async (_label, method, invoice, status) => {
    vi.mocked(coreApi[method]).mockRejectedValue(failure(status));
    await submitFilledForm(invoice);
    expect(await screen.findByRole('alert')).toHaveTextContent('That did not save. Try again.');
  });
});

describe('InvoiceFormDialog: the discount', () => {
  const discountField = () => screen.getByLabelText('Discount (%)');

  async function openOnLines(props: DialogProps = {}) {
    const view = openDialog(props);
    await screen.findByRole('group', { name: 'Line 1' });
    return view;
  }

  async function fillHeader(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText('Number'), 'INV-9');
    await user.type(screen.getByLabelText('Issue date'), '2026-10-01');
  }

  it('starts from the project’s discount, and says it can be changed for this invoice only', async () => {
    await openOnLines({ projectDiscountPercent: 10 });

    expect(discountField()).toHaveValue('10');
    expect(screen.getByText('Starts from the project’s discount. Change it for this invoice only.')).toBeInTheDocument();
  });

  it.each([
    [7.5, '7.5'],
    [12.25, '12.25'],
    [0, '0'],
    [undefined, '0'],
  ])('starts at the project’s %s as %j', async (projectDiscountPercent, shown) => {
    await openOnLines({ projectDiscountPercent });

    expect(discountField()).toHaveValue(shown);
  });

  it('shows the subtotal, the discount and the total, and follows the discount as it is changed', async () => {
    const user = userEvent.setup();
    await openOnLines({ projectDiscountPercent: 10 });

    expect(screen.getByText('Subtotal $36,000')).toBeInTheDocument();
    expect(screen.getByText('Discount (10%) -$3,600')).toBeInTheDocument();
    expect(screen.getByText('Total $32,400')).toBeInTheDocument();

    await user.clear(discountField());
    await user.type(discountField(), '7.5');
    expect(screen.getByText('Discount (7.5%) -$2,700')).toBeInTheDocument();
    expect(screen.getByText('Total $33,300')).toBeInTheDocument();

    await user.clear(discountField());
    await user.type(discountField(), '0');
    expect(screen.queryByText(/^Subtotal/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Discount \(\d/)).not.toBeInTheDocument();
    expect(screen.getByText('Total $36,000')).toBeInTheDocument();
  });

  it('follows the lines too, rounding the discount to whole dollars the way the service does', async () => {
    const user = userEvent.setup();
    serveDraft(draftEnvelope({ lineItems: [] }));
    await openOnLines({ projectDiscountPercent: 7.5, billingType: 'fixed_cost' });
    await user.type(screen.getByLabelText('Line 1 description'), 'Build');
    await user.type(screen.getByLabelText('Line 1 units'), '1');
    await user.type(screen.getByLabelText('Line 1 rate'), '1010');

    // 7.5% of 1,010 is 75.75: 76 off, 934 to pay.
    expect(screen.getByText('Subtotal $1,010')).toBeInTheDocument();
    expect(screen.getByText('Discount (7.5%) -$76')).toBeInTheDocument();
    expect(screen.getByText('Total $934')).toBeInTheDocument();
  });

  it('shows only the total when there is no discount', async () => {
    await openOnLines({ projectDiscountPercent: 0 });

    expect(screen.getByText('Total $36,000')).toBeInTheDocument();
    expect(screen.queryByText(/^Subtotal/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Discount \(\d/)).not.toBeInTheDocument();
  });

  it('sends the project’s discount with the new invoice', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    await openOnLines({ projectDiscountPercent: 10 });
    await fillHeader(user);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));

    expect(coreApi.post).toHaveBeenCalledWith('/invoices', expect.objectContaining({ projectId: 1, discountPercent: 10 }));
  });

  it('sends the figure typed for this invoice, whatever the project has', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    await openOnLines({ projectDiscountPercent: 10 });
    await fillHeader(user);
    await user.clear(discountField());
    await user.type(discountField(), '12.25');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));

    expect(coreApi.post).toHaveBeenCalledWith('/invoices', expect.objectContaining({ discountPercent: 12.25 }));
  });

  it.each([['0'], ['']])('sends 0 when the discount is taken off with %j', async (typed) => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    await openOnLines({ projectDiscountPercent: 10 });
    await fillHeader(user);
    await user.clear(discountField());
    if (typed !== '') await user.type(discountField(), typed);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));

    expect(coreApi.post).toHaveBeenCalledWith('/invoices', expect.objectContaining({ discountPercent: 0 }));
  });

  it.each([
    ['50.01', 'Discount must be from 0 to 50'],
    ['60', 'Discount must be from 0 to 50'],
    ['abc', 'Enter a percentage like 7.5'],
    ['1.234', 'Enter a percentage like 7.5'],
  ])('refuses %j with “%s” and sends nothing', async (typed, message) => {
    const user = userEvent.setup();
    await openOnLines({ projectDiscountPercent: 10 });
    await fillHeader(user);
    await user.clear(discountField());
    await user.type(discountField(), typed);
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(discountField()).toHaveAttribute('aria-invalid', 'true');
    expect(coreApi.post).not.toHaveBeenCalled();
  });

  it('shows no preview of a discount it refuses', async () => {
    const user = userEvent.setup();
    await openOnLines({ projectDiscountPercent: 10 });
    await user.clear(discountField());
    await user.type(discountField(), '60');

    expect(screen.queryByText(/^Discount \(\d/)).not.toBeInTheDocument();
    expect(screen.getByText('Total $36,000')).toBeInTheDocument();
  });

  it('opens an invoice on its own discount, not its project’s, and keeps it when saved', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    const [discounted] = invoiceRowsSchema.parse([
      { ...invoiceRows[0], subtotal: 36000, discountPercent: 7.5, amount: 33300 },
    ]);
    openDialog({ invoice: discounted, projectDiscountPercent: 10 });

    expect(discountField()).toHaveValue('7.5');
    expect(screen.getByText('Discount (7.5%) -$2,700')).toBeInTheDocument();
    expect(screen.getByText('Total $33,300')).toBeInTheDocument();
    expect(calls(DRAFT_PATH)).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.patch).toHaveBeenCalledWith('/invoices/1', expect.objectContaining({ discountPercent: 7.5 }));
  });

  it('opens an undiscounted invoice at 0 even when its project has a discount now', () => {
    openDialog({ invoice: paid, projectDiscountPercent: 10 });

    expect(discountField()).toHaveValue('0');
    expect(screen.getByText('Total $36,000')).toBeInTheDocument();
  });
});
