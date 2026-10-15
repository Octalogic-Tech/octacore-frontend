import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import { useState } from 'react';
import { coreApi } from '@/lib/core-api';
import { draftEnvelope, invoiceRows } from '@/test/fixtures/projects';
import { renderWithProviders } from '@/test/utils';
import { InvoiceFormDialog } from './invoice-form-dialog';
import { invoiceRowsSchema, type InvoiceRow } from './schema';

vi.mock('@/lib/core-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/core-api')>()),
  coreApi: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const [paid] = invoiceRowsSchema.parse(invoiceRows);

/** What the migration leaves behind: one line, quantity 1, the old amount as its rate. */
const [legacy] = invoiceRowsSchema.parse([
  {
    ...invoiceRows[0],
    lineItems: [{ ...invoiceRows[0].lineItems[0], description: 'October retainer', quantity: 1, rate: 36000, amount: 36000 }],
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

const serveDraft = (body: unknown = draftEnvelope()) =>
  vi.mocked(coreApi.get).mockImplementation((async (path: string) => {
    if (path === DRAFT_PATH) return { data: body };
    throw new Error(`unexpected GET ${path}`);
  }) as never);

const draftCalls = () => vi.mocked(coreApi.get).mock.calls.filter(([path]) => path === DRAFT_PATH);

function openDialog(props: { invoice?: InvoiceRow; billingType?: 'retainer' | 'fixed_cost' | null } = {}) {
  return renderWithProviders(
    <InvoiceFormDialog open onOpenChange={onOpenChange} projectId={1} billingType="retainer" {...props} />,
  );
}

const line = (n: number) => screen.getByRole('group', { name: `Line ${n}` });

beforeEach(() => {
  serveDraft();
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('InvoiceFormDialog: adding to a retainer project', () => {
  it('builds the lines from the draft and saves them with the header', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog();
    expect(screen.getByRole('dialog', { name: 'New invoice' })).toBeInTheDocument();
    await screen.findByRole('group', { name: 'Line 1' });
    expect(screen.getByLabelText('Line 1 description')).toHaveValue('Asha Rao — Mobile');
    expect(screen.getByLabelText('Line 1 quantity')).toHaveValue('160');
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
      dueDate: null,
      paidDate: null,
      lineItems: [
        { description: 'Asha Rao — Mobile', quantity: 160, rate: 150 },
        { description: 'Ben Cho — Web', quantity: 160, rate: 75 },
      ],
    });
  });

  it('lets a line be edited, added and removed before saving', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog();
    await screen.findByRole('group', { name: 'Line 1' });
    await user.clear(screen.getByLabelText('Line 1 quantity'));
    await user.type(screen.getByLabelText('Line 1 quantity'), '80');
    expect(within(line(1)).getByText('$12,000')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove line 2' }));
    expect(screen.queryByRole('group', { name: 'Line 2' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add line' }));
    await user.type(screen.getByLabelText('Line 2 description'), 'Hosting');
    await user.type(screen.getByLabelText('Line 2 quantity'), '1');
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
          { description: 'Asha Rao — Mobile', quantity: 80, rate: 150 },
          { description: 'Hosting', quantity: 1, rate: 300 },
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

    serveDraft(draftEnvelope({ lineItems: [{ description: 'Cara Diaz — Web', quantity: 160, rate: 90 }] }));
    await user.click(screen.getByRole('button', { name: 'Open it' }));

    expect(await screen.findByDisplayValue('Cara Diaz — Web')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Asha Rao — Mobile')).not.toBeInTheDocument();
    expect(draftCalls()).toHaveLength(2);
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
  async function fillLine(quantity: string, rate: string) {
    const user = userEvent.setup();
    // The draft is requested when the dialog mounts, so the mock must be in place before it opens.
    serveDraft(draftEnvelope({ lineItems: [] }));
    openDialog({ billingType: 'fixed_cost' });
    await screen.findByRole('group', { name: 'Line 1' });
    await user.type(screen.getByLabelText('Number'), 'INV-9');
    await user.type(screen.getByLabelText('Issue date'), '2026-10-01');
    await user.type(screen.getByLabelText('Line 1 description'), 'Milestone');
    if (quantity) await user.type(screen.getByLabelText('Line 1 quantity'), quantity);
    if (rate) await user.type(screen.getByLabelText('Line 1 rate'), rate);
    await user.click(screen.getByRole('button', { name: 'Save' }));
  }

  it.each(['42.50', '$85', '1,200'])('says what is wrong with a rate of %s and sends nothing', async (rate) => {
    await fillLine('1', rate);
    expect(await screen.findByText('Enter a whole number, like 85')).toBeInTheDocument();
    expect(coreApi.post).not.toHaveBeenCalled();
  });

  it('asks for a quantity and a rate on a line', async () => {
    await fillLine('', '');
    expect(await screen.findByText('Quantity is required')).toBeInTheDocument();
    expect(screen.getByText('Rate is required')).toBeInTheDocument();
    expect(coreApi.post).not.toHaveBeenCalled();
  });

  it('refuses a line whose amount is past the limit the service holds', async () => {
    await fillLine('100000', '21475');
    expect(await screen.findByText('This line is too large')).toBeInTheDocument();
    expect(coreApi.post).not.toHaveBeenCalled();
  });
});

describe('InvoiceFormDialog: adding to a fixed cost project', () => {
  it('opens on one blank line, with no retainer hint, and sends the line typed by hand', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    serveDraft(draftEnvelope({ lineItems: [] }));
    const user = userEvent.setup();
    openDialog({ billingType: 'fixed_cost' });
    await screen.findByRole('group', { name: 'Line 1' });
    expect(screen.queryByRole('group', { name: 'Line 2' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Line 1 description')).toHaveValue('');
    expect(screen.queryByText('Retainer lines are 160 hours a month.')).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Number'), 'INV-1');
    await user.type(screen.getByLabelText('Issue date'), '2026-10-01');
    await user.type(screen.getByLabelText('Line 1 description'), 'Milestone 1');
    await user.type(screen.getByLabelText('Line 1 quantity'), '1');
    await user.type(screen.getByLabelText('Line 1 rate'), '5000');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.post).toHaveBeenCalledWith('/invoices', {
      projectId: 1,
      number: 'INV-1',
      description: null,
      issueDate: '2026-10-01',
      dueDate: null,
      paidDate: null,
      lineItems: [{ description: 'Milestone 1', quantity: 1, rate: 5000 }],
    });
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
      lineItems: [
        { description: 'Asha Rao — Mobile', quantity: 160, rate: 150 },
        { description: 'Ben Cho — Web', quantity: 160, rate: 75 },
      ],
    });
    expect(draftCalls()).toHaveLength(0);
  });

  it('keeps the single line, and the amount, of an invoice that came from the migration', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog({ invoice: legacy });
    expect(screen.getByLabelText('Line 1 quantity')).toHaveValue('1');
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
      lineItems: [{ description: 'October retainer', quantity: 1, rate: 36000 }],
    });
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
