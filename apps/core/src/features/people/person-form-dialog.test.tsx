import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { coreApi } from '@/lib/core-api';
import { createdPersonEnvelope, personRows } from '@/test/fixtures/people';
import { renderWithProviders } from '@/test/utils';
import { PersonFormDialog } from './person-form-dialog';
import { personRowsSchema, type PersonRow } from './schema';

vi.mock('@/lib/core-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/core-api')>()),
  coreApi: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const [ada, grace] = personRowsSchema.parse(personRows);

const onOpenChange = vi.fn();

const SALARY = 'Monthly salary (USD)';
const WHOLE_NUMBER = 'Enter a whole number, like 5600';

/** What the service answers a save with; the dialog does not read it. */
const saved = { data: { statusCode: 200, message: 'saved', data: {}, meta: null } };

function openDialog(person?: PersonRow) {
  return renderWithProviders(<PersonFormDialog open onOpenChange={onOpenChange} person={person} />);
}

afterEach(() => {
  vi.resetAllMocks();
});

describe('PersonFormDialog: adding', () => {
  it('creates the person with every field, the salary as a number of dollars', async () => {
    vi.mocked(coreApi.post).mockResolvedValue({ data: createdPersonEnvelope(7) });
    const user = userEvent.setup();
    openDialog();
    expect(screen.getByRole('dialog', { name: 'New person' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Name'), 'Margaret Hamilton');
    await user.type(screen.getByLabelText('Email'), 'margaret@example.com');
    await user.type(screen.getByLabelText('Phone'), '+1 617 555 0100');
    await user.type(screen.getByLabelText('Joined'), '2024-02-01');
    await user.type(screen.getByLabelText('Left'), '2026-03-31');
    await user.type(screen.getByLabelText('Image link'), 'https://example.com/margaret.png');
    await user.type(screen.getByLabelText('Contract link'), 'https://example.com/margaret.pdf');
    await user.type(screen.getByLabelText(SALARY), '8400');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.post).toHaveBeenCalledTimes(1);
    expect(coreApi.post).toHaveBeenCalledWith('/people', {
      name: 'Margaret Hamilton',
      email: 'margaret@example.com',
      phone: '+1 617 555 0100',
      joinDate: '2024-02-01',
      leaveDate: '2026-03-31',
      imageLink: 'https://example.com/margaret.png',
      contractLink: 'https://example.com/margaret.pdf',
      monthlySalary: 8400,
    });
  });

  it('creates a person with only a name, and nulls for the rest', async () => {
    vi.mocked(coreApi.post).mockResolvedValue({ data: createdPersonEnvelope(7) });
    const user = userEvent.setup();
    openDialog();
    await user.type(screen.getByLabelText('Name'), 'Margaret Hamilton');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.post).toHaveBeenCalledWith('/people', {
      name: 'Margaret Hamilton',
      email: null,
      phone: null,
      joinDate: null,
      leaveDate: null,
      imageLink: null,
      contractLink: null,
      monthlySalary: null,
    });
  });

  it('saves a salary of zero as 0, not as no salary', async () => {
    vi.mocked(coreApi.post).mockResolvedValue({ data: createdPersonEnvelope(7) });
    const user = userEvent.setup();
    openDialog();
    await user.type(screen.getByLabelText('Name'), 'Intern');
    await user.type(screen.getByLabelText(SALARY), '0');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.post).toHaveBeenCalledWith('/people', expect.objectContaining({ monthlySalary: 0 }));
  });

  it('blocks a person without a name', async () => {
    const user = userEvent.setup();
    openDialog();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(coreApi.post).not.toHaveBeenCalled();
  });

  it('blocks a bad email', async () => {
    const user = userEvent.setup();
    openDialog();
    await user.type(screen.getByLabelText('Name'), 'Ada');
    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(coreApi.post).not.toHaveBeenCalled();
  });

  it.each(['5,600', '$5600', '5600.50', '-5'])(
    'tells a salary typed as “%s” what is wrong, next to the field, and does not save',
    async (salary) => {
      const user = userEvent.setup();
      openDialog();
      await user.type(screen.getByLabelText('Name'), 'Ada');
      await user.type(screen.getByLabelText(SALARY), salary);
      await user.click(screen.getByRole('button', { name: 'Save' }));
      expect(await screen.findByText(WHOLE_NUMBER)).toBeInTheDocument();
      expect(screen.getByLabelText(SALARY)).toHaveAttribute('aria-invalid', 'true');
      expect(coreApi.post).not.toHaveBeenCalled();
    },
  );

  it('blocks a salary the service cannot store', async () => {
    const user = userEvent.setup();
    openDialog();
    await user.type(screen.getByLabelText('Name'), 'Ada');
    await user.type(screen.getByLabelText(SALARY), '2147483648');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Salary is too large')).toBeInTheDocument();
    expect(coreApi.post).not.toHaveBeenCalled();
  });

  it('keeps the dialog open and says so when the save fails, and saves the same person again on a retry', async () => {
    vi.mocked(coreApi.post).mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce({ data: createdPersonEnvelope(7) });
    const user = userEvent.setup();
    openDialog();
    await user.type(screen.getByLabelText('Name'), 'Ada');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('That did not save. Try again.');
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.post).toHaveBeenCalledTimes(2);
    expect(coreApi.post).toHaveBeenNthCalledWith(2, '/people', expect.objectContaining({ name: 'Ada' }));
  });

  it('does not read the answer to a save, so an answer it does not know cannot look like a failed save', async () => {
    vi.mocked(coreApi.post).mockResolvedValue({ data: { surprise: true } });
    const user = userEvent.setup();
    openDialog();
    await user.type(screen.getByLabelText('Name'), 'Ada');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('PersonFormDialog: editing', () => {
  it('opens on the person, every field and the salary included', () => {
    openDialog(ada);
    expect(screen.getByRole('dialog', { name: 'Edit person' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Ada Lovelace');
    expect(screen.getByLabelText('Email')).toHaveValue('ada@example.com');
    expect(screen.getByLabelText('Phone')).toHaveValue('+44 20 7946 0000');
    expect(screen.getByLabelText('Joined')).toHaveValue('2024-01-15');
    expect(screen.getByLabelText('Left')).toHaveValue('');
    expect(screen.getByLabelText('Image link')).toHaveValue('https://example.com/ada.png');
    expect(screen.getByLabelText('Contract link')).toHaveValue('https://example.com/ada-contract.pdf');
    expect(screen.getByLabelText(SALARY)).toHaveValue('5600');
  });

  it('changes the person with PATCH under their id, and sends the new salary', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog(ada);
    await user.clear(screen.getByLabelText(SALARY));
    await user.type(screen.getByLabelText(SALARY), '6200');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.post).not.toHaveBeenCalled();
    expect(coreApi.patch).toHaveBeenCalledTimes(1);
    expect(coreApi.patch).toHaveBeenCalledWith('/people/1', {
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      phone: '+44 20 7946 0000',
      joinDate: '2024-01-15',
      leaveDate: null,
      imageLink: 'https://example.com/ada.png',
      contractLink: 'https://example.com/ada-contract.pdf',
      monthlySalary: 6200,
    });
  });

  it('sends null to clear the salary when the field is emptied', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog(grace);
    await user.clear(screen.getByLabelText(SALARY));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.patch).toHaveBeenCalledWith('/people/2', expect.objectContaining({ monthlySalary: null }));
  });

  it('marks the project resources stale, since each carries the name of its person', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    const { client } = openDialog(ada);
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(invalidate).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['project-resources'] }));
  });

  it('closes without saving on Cancel', async () => {
    const user = userEvent.setup();
    openDialog(ada);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(coreApi.patch).not.toHaveBeenCalled();
  });
});
