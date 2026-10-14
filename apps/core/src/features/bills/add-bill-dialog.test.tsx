import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '@/lib/api';
import { renderWithProviders } from '@/test/utils';
import { AddBillDialog } from './add-bill-dialog';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

const image = () => new File(['x'], 'receipt.png', { type: 'image/png' });

function setup() {
  const onOpenChange = vi.fn();
  renderWithProviders(<AddBillDialog open onOpenChange={onOpenChange} />);
  return onOpenChange;
}

async function fillValid(user: ReturnType<typeof userEvent.setup>, amount = '25.5') {
  fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2023-09-01' } });
  await user.type(screen.getByLabelText('Amount'), amount);
  await user.selectOptions(screen.getByLabelText('Bill type'), 'Regular');
  await user.type(screen.getByLabelText('Added by'), 'Asha');
  await user.upload(screen.getByLabelText('Bill image'), image());
}

afterEach(() => {
  vi.resetAllMocks();
});

describe('AddBillDialog', () => {
  it('blocks an empty form and sends nothing', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Date is required')).toBeInTheDocument();
    expect(screen.getByText('Amount is required')).toBeInTheDocument();
    expect(screen.getByText('Bill type is required')).toBeInTheDocument();
    expect(screen.getByText('Added by is required')).toBeInTheDocument();
    expect(screen.getByText('Attach an image of the bill')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it.each(['0', '-5'])('rejects an amount of %s next to the field', async (amount) => {
    const user = userEvent.setup();
    setup();
    await fillValid(user, amount);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Amount must be greater than 0')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('rejects an attachment that is not an image', async () => {
    const user = userEvent.setup({ applyAccept: false });
    setup();
    await fillValid(user);
    await user.upload(screen.getByLabelText('Bill image'), new File(['x'], 'notes.pdf', { type: 'application/pdf' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Attach an image of the bill')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('saves a valid bill as pending and closes', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { id: 10 } });
    const user = userEvent.setup();
    const onOpenChange = setup();
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/bills', {
        billDate: '2023-09-01',
        amount: 25.5,
        billType: 'Regular',
        actualExpense: true,
        billPath: 'receipt.png',
        uploadedBy: 'Asha',
        submittedBy: 'Asha',
        approved: false,
        approvedBy: '',
      }),
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('stores reimbursement No as actualExpense false', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { id: 10 } });
    const user = userEvent.setup();
    setup();
    await fillValid(user);
    await user.click(screen.getByLabelText('No'));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/bills', expect.objectContaining({ actualExpense: false })),
    );
  });

  it('stays open and says so when saving fails', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('down'));
    const user = userEvent.setup();
    const onOpenChange = setup();
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('That did not save. Try again.')).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
