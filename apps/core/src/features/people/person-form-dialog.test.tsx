import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { coreApi } from '@/lib/core-api';
import { createdPersonEnvelope, personRows } from '@/test/fixtures/people';
import { technologiesEnvelope } from '@/test/fixtures/technologies';
import { renderWithProviders } from '@/test/utils';
import { PersonFormDialog } from './person-form-dialog';
import { personRowsSchema, type PersonRow } from './schema';

vi.mock('@/lib/core-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/core-api')>()),
  coreApi: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const [ada, grace] = personRowsSchema.parse(personRows);

const onOpenChange = vi.fn();

const SALARY = 'Monthly salary (INR)';
const WRONG_FORMAT = 'Enter an amount like 7.20, with no commas or signs';

/** What the service answers a save with; the dialog does not read it. */
const saved = { data: { statusCode: 200, message: 'saved', data: {}, meta: null } };

function openDialog(person?: PersonRow) {
  return renderWithProviders(<PersonFormDialog open onOpenChange={onOpenChange} person={person} />);
}

beforeEach(() => {
  vi.mocked(coreApi.get).mockImplementation((async (path: string) => {
    if (path === '/technologies') return { data: technologiesEnvelope() };
    throw new Error(`unexpected GET ${path}`);
  }) as never);
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('PersonFormDialog: adding', () => {
  it('creates the person with every field, the salary as a number of paise', async () => {
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
    await user.type(screen.getByLabelText(SALARY), '84000');
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
      monthlySalaryPaise: 8_400_000,
      technologyIds: [],
    });
  });

  it('sends a salary typed with paise as whole paise, and says how to type it', async () => {
    vi.mocked(coreApi.post).mockResolvedValue({ data: createdPersonEnvelope(7) });
    const user = userEvent.setup();
    openDialog();
    await user.type(screen.getByLabelText('Name'), 'Margaret Hamilton');
    expect(screen.getByText('Rupees and paise, like 85000.00.')).toBeInTheDocument();
    await user.type(screen.getByLabelText(SALARY), '85000.75');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.post).toHaveBeenCalledWith('/people', expect.objectContaining({ monthlySalaryPaise: 8_500_075 }));
  });

  it('does not offer the salary in dollars any more', () => {
    openDialog();
    expect(screen.queryByLabelText('Monthly salary (USD)')).not.toBeInTheDocument();
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
      monthlySalaryPaise: null,
      technologyIds: [],
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
    expect(coreApi.post).toHaveBeenCalledWith('/people', expect.objectContaining({ monthlySalaryPaise: 0 }));
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

  it.each(['85,000', '₹85000', '85000.755', '-5'])(
    'tells a salary typed as “%s” what is wrong, next to the field, and does not save',
    async (salary) => {
      const user = userEvent.setup();
      openDialog();
      await user.type(screen.getByLabelText('Name'), 'Ada');
      await user.type(screen.getByLabelText(SALARY), salary);
      await user.click(screen.getByRole('button', { name: 'Save' }));
      expect(await screen.findByText(WRONG_FORMAT)).toBeInTheDocument();
      expect(screen.getByLabelText(SALARY)).toHaveAttribute('aria-invalid', 'true');
      expect(coreApi.post).not.toHaveBeenCalled();
    },
  );

  it('blocks a salary the service cannot store', async () => {
    const user = userEvent.setup();
    openDialog();
    await user.type(screen.getByLabelText('Name'), 'Ada');
    await user.type(screen.getByLabelText(SALARY), '100000000.01');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('The amount is too large')).toBeInTheDocument();
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
    expect(screen.getByLabelText(SALARY)).toHaveValue('85000.00');
  });

  it('changes the person with PATCH under their id, and sends the new salary', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog(ada);
    await user.clear(screen.getByLabelText(SALARY));
    await user.type(screen.getByLabelText(SALARY), '92000');
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
      monthlySalaryPaise: 9_200_000,
      technologyIds: [2, 1],
    });
  });

  it('sends null to clear the salary when the field is emptied', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog(grace);
    await user.clear(screen.getByLabelText(SALARY));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.patch).toHaveBeenCalledWith('/people/2', expect.objectContaining({ monthlySalaryPaise: null }));
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

describe('PersonFormDialog: technologies', () => {
  const group = () => screen.findByRole('group', { name: 'Technologies' });

  it('offers every technology as a chip, in name order, none chosen for a new person', async () => {
    openDialog();
    const chips = await within(await group()).findAllByRole('checkbox');
    expect(chips.map((chip) => chip.closest('label')?.textContent)).toEqual(['Express', 'Nest', 'React']);
    for (const chip of chips) expect(chip).not.toBeChecked();
  });

  it('sends the chosen technologies as ids', async () => {
    vi.mocked(coreApi.post).mockResolvedValue({ data: createdPersonEnvelope(7) });
    const user = userEvent.setup();
    openDialog();
    await user.type(screen.getByLabelText('Name'), 'Margaret Hamilton');
    await user.click(within(await group()).getByRole('checkbox', { name: 'React' }));
    await user.click(within(await group()).getByRole('checkbox', { name: 'Express' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.post).toHaveBeenCalledWith('/people', expect.objectContaining({ technologyIds: [1, 3] }));
  });

  it('unticks a chip that was ticked, so the technology is not sent', async () => {
    vi.mocked(coreApi.post).mockResolvedValue({ data: createdPersonEnvelope(7) });
    const user = userEvent.setup();
    openDialog();
    await user.type(screen.getByLabelText('Name'), 'Margaret Hamilton');
    const chips = within(await group());
    await user.click(chips.getByRole('checkbox', { name: 'React' }));
    await user.click(chips.getByRole('checkbox', { name: 'Nest' }));
    await user.click(chips.getByRole('checkbox', { name: 'React' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.post).toHaveBeenCalledWith('/people', expect.objectContaining({ technologyIds: [2] }));
  });

  it('opens an edit with the person’s own technologies ticked', async () => {
    openDialog(ada);
    const chips = within(await group());
    expect(chips.getByRole('checkbox', { name: 'Nest' })).toBeChecked();
    expect(chips.getByRole('checkbox', { name: 'React' })).toBeChecked();
    // The rest of the list arrives after the person's own technologies, which are offered at once.
    expect(await chips.findByRole('checkbox', { name: 'Express' })).not.toBeChecked();
  });

  it('sends an empty list when every technology is unticked, so the old set is cleared', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog(ada);
    const chips = within(await group());
    await user.click(chips.getByRole('checkbox', { name: 'Nest' }));
    await user.click(chips.getByRole('checkbox', { name: 'React' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.patch).toHaveBeenCalledWith('/people/1', expect.objectContaining({ technologyIds: [] }));
  });

  it('still offers and keeps the person’s own technologies when the technology list fails', async () => {
    vi.mocked(coreApi.get).mockRejectedValue(new Error('down'));
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog(ada);
    const chips = within(await group());
    expect(chips.getByRole('checkbox', { name: 'Nest' })).toBeChecked();
    expect(chips.getByRole('checkbox', { name: 'React' })).toBeChecked();
    expect(await screen.findByText('Technologies could not be loaded.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.patch).toHaveBeenCalledWith('/people/1', expect.objectContaining({ technologyIds: [2, 1] }));
  });

  it('offers a technology the person knows that has since left the list', async () => {
    vi.mocked(coreApi.get).mockImplementation((async (path: string) => {
      if (path === '/technologies') return { data: technologiesEnvelope([]) };
      throw new Error(`unexpected GET ${path}`);
    }) as never);
    openDialog(ada);
    const chips = within(await group());
    expect(chips.getByRole('checkbox', { name: 'Nest' })).toBeChecked();
    expect(chips.getByRole('checkbox', { name: 'React' })).toBeChecked();
  });

  it('does not say there are no technologies when the list failed to load for a new person', async () => {
    vi.mocked(coreApi.get).mockRejectedValue(new Error('down'));
    openDialog();
    expect(await screen.findByText('Technologies could not be loaded.')).toBeInTheDocument();
    expect(screen.queryByText(/No technologies yet/)).not.toBeInTheDocument();
  });

  it('says so, and where to add some, when there are no technologies at all', async () => {
    vi.mocked(coreApi.get).mockImplementation((async (path: string) => {
      if (path === '/technologies') return { data: technologiesEnvelope([]) };
      throw new Error(`unexpected GET ${path}`);
    }) as never);
    openDialog();
    expect(await screen.findByText('No technologies yet. Add some on the Technologies page.')).toBeInTheDocument();
  });
});
