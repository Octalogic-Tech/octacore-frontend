import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import { coreApi } from '@/lib/core-api';
import { invoiceRows } from '@/test/fixtures/projects';
import { renderWithProviders } from '@/test/utils';
import { InvoiceFormDialog } from './invoice-form-dialog';
import { invoiceRowsSchema, type InvoiceRow } from './schema';

vi.mock('@/lib/core-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/core-api')>()),
  coreApi: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const [paid] = invoiceRowsSchema.parse(invoiceRows);

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

function openDialog(props: { invoice?: InvoiceRow } = {}) {
  return renderWithProviders(<InvoiceFormDialog open onOpenChange={onOpenChange} projectId={1} {...props} />);
}

afterEach(() => {
  vi.resetAllMocks();
});

describe('InvoiceFormDialog: adding', () => {
  it('creates the invoice under the project with the body the service expects', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog();
    expect(screen.getByRole('dialog', { name: 'New invoice' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Number'), 'INV-9');
    await user.type(screen.getByLabelText('Description'), 'Final milestone');
    await user.type(screen.getByLabelText('Amount'), '1200');
    await user.type(screen.getByLabelText('Issue date'), '2026-10-01');
    await user.type(screen.getByLabelText('Due date'), '2026-10-31');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.post).toHaveBeenCalledTimes(1);
    expect(coreApi.post).toHaveBeenCalledWith('/invoices', {
      projectId: 1,
      number: 'INV-9',
      description: 'Final milestone',
      amount: 1200,
      issueDate: '2026-10-01',
      dueDate: '2026-10-31',
      paidDate: null,
    });
  });

  it('sends nulls for what is left empty', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog();
    await user.type(screen.getByLabelText('Number'), 'INV-9');
    await user.type(screen.getByLabelText('Amount'), '0');
    await user.type(screen.getByLabelText('Issue date'), '2026-10-01');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.post).toHaveBeenCalledWith('/invoices', {
      projectId: 1,
      number: 'INV-9',
      description: null,
      amount: 0,
      issueDate: '2026-10-01',
      dueDate: null,
      paidDate: null,
    });
  });

  it('asks for a number, an amount and an issue date, and sends nothing', async () => {
    const user = userEvent.setup();
    openDialog();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Number is required')).toBeInTheDocument();
    expect(screen.getByText('Amount is required')).toBeInTheDocument();
    expect(screen.getByText('Issue date is required')).toBeInTheDocument();
    expect(coreApi.post).not.toHaveBeenCalled();
  });

  it.each(['1,000', '$1000', '12.5', '-5', '1e3'])('says what is wrong with an amount of %s and sends nothing', async (amount) => {
    const user = userEvent.setup();
    openDialog();
    await user.type(screen.getByLabelText('Number'), 'INV-9');
    await user.type(screen.getByLabelText('Amount'), amount);
    await user.type(screen.getByLabelText('Issue date'), '2026-10-01');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Enter a whole number, like 1200')).toBeInTheDocument();
    expect(coreApi.post).not.toHaveBeenCalled();
  });

  it('refuses an amount past the limit the service holds', async () => {
    const user = userEvent.setup();
    openDialog();
    await user.type(screen.getByLabelText('Number'), 'INV-9');
    await user.type(screen.getByLabelText('Amount'), '2147483648');
    await user.type(screen.getByLabelText('Issue date'), '2026-10-01');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Amount is too large')).toBeInTheDocument();
    expect(coreApi.post).not.toHaveBeenCalled();
  });
});

describe('InvoiceFormDialog: editing', () => {
  it('opens on the invoice and sends PATCH, with null for a cleared paid date', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog({ invoice: paid });
    expect(screen.getByRole('dialog', { name: 'Edit invoice' })).toBeInTheDocument();
    expect(screen.getByLabelText('Number')).toHaveValue('INV-001');
    expect(screen.getByLabelText('Amount')).toHaveValue('36000');
    expect(screen.getByLabelText('Issue date')).toHaveValue('2026-10-01');
    expect(screen.getByLabelText('Paid date')).toHaveValue('2026-10-12');
    await user.clear(screen.getByLabelText('Paid date'));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.post).not.toHaveBeenCalled();
    expect(coreApi.patch).toHaveBeenCalledWith('/invoices/1', {
      number: 'INV-001',
      description: 'October retainer',
      amount: 36000,
      issueDate: '2026-10-01',
      dueDate: '2026-10-31',
      paidDate: null,
    });
  });
});

describe('InvoiceFormDialog: failures', () => {
  async function submitFilledForm(invoice?: InvoiceRow) {
    const user = userEvent.setup();
    openDialog({ invoice });
    if (!invoice) {
      await user.type(screen.getByLabelText('Number'), 'INV-9');
      await user.type(screen.getByLabelText('Amount'), '1200');
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
