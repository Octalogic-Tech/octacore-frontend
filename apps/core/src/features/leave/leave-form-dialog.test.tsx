import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import { coreApi } from '@/lib/core-api';
import { leaveEnvelope, leaveRows } from '@/test/fixtures/leaves';
import { peopleEnvelope } from '@/test/fixtures/people';
import { renderWithProviders } from '@/test/utils';
import { LeaveFormDialog } from './leave-form-dialog';
import { leaveRowsSchema, type LeaveRow } from './schema';

vi.mock('@/lib/core-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/core-api')>()),
  coreApi: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const [, adaWedding, , adaTravel] = leaveRowsSchema.parse(leaveRows);

const onOpenChange = vi.fn();

const OVERLAP = 'This overlaps leave from 2026-03-10 to 2026-03-12';

/** What the service answers a save with; the dialog does not read it. */
const saved = { data: leaveEnvelope() };

const failure = (status: number, message = 'refused') =>
  new AxiosError('failed', 'ERR_BAD_REQUEST', undefined, null, {
    status,
    data: { statusCode: status, message, data: null },
    statusText: String(status),
    headers: {},
    config: {} as never,
  });

const serve = ({ people }: { people?: 'fail' | unknown } = {}) =>
  vi.mocked(coreApi.get).mockImplementation((async (path: string) => {
    if (path === '/people') {
      if (people === 'fail') throw new Error('down');
      return { data: people ?? peopleEnvelope() };
    }
    throw new Error(`unexpected GET ${path}`);
  }) as never);

function openDialog(props: { leave?: LeaveRow; personId?: number } = {}) {
  return renderWithProviders(
    <LeaveFormDialog open onOpenChange={onOpenChange} fallbackFocusId="leave-search" {...props} />
  );
}

const optionNames = (select: HTMLElement) =>
  within(select)
    .getAllByRole('option')
    .map((option) => option.textContent);

/** Fills the fields a new leave needs, for the person given or chosen. */
async function fill(user: ReturnType<typeof userEvent.setup>, first = '2026-11-02', last = '2026-11-06') {
  await user.selectOptions(screen.getByLabelText('Type'), 'Earned');
  await user.type(screen.getByLabelText('First day'), first);
  await user.type(screen.getByLabelText('Last day'), last);
}

beforeEach(() => {
  serve();
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('LeaveFormDialog: adding', () => {
  it('opens with nothing chosen and no days', async () => {
    openDialog();
    expect(screen.getByRole('dialog', { name: 'New leave' })).toBeInTheDocument();
    expect(screen.getByLabelText('Person')).toHaveValue('');
    expect(screen.getByLabelText('Type')).toHaveValue('');
    expect(screen.getByLabelText('First day')).toHaveValue('');
    expect(screen.getByLabelText('Last day')).toHaveValue('');
    expect(screen.getByLabelText('Reason')).toHaveValue('');
    await screen.findByRole('option', { name: 'Ada Lovelace' });
  });

  it('offers every person, A to Z, after a prompt to choose one', async () => {
    openDialog();
    await screen.findByRole('option', { name: 'Ada Lovelace' });
    expect(optionNames(screen.getByLabelText('Person'))).toEqual([
      'Choose…',
      'Ada Lovelace',
      'Grace Hopper',
      'Linus Torvalds',
    ]);
  });

  it('offers the five types after a prompt to choose one', () => {
    openDialog();
    expect(optionNames(screen.getByLabelText('Type'))).toEqual([
      'Choose…',
      'Casual',
      'Sick',
      'Earned',
      'Unpaid',
      'Other',
    ]);
  });

  it('says that both the first and the last day count', () => {
    openDialog();
    expect(screen.getByText(/both the first and the last day count/i)).toBeInTheDocument();
  });

  it('posts the person, the type, both days and a null reason', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog();
    await screen.findByRole('option', { name: 'Grace Hopper' });
    await user.selectOptions(screen.getByLabelText('Person'), 'Grace Hopper');
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.post).toHaveBeenCalledTimes(1);
    expect(coreApi.post).toHaveBeenCalledWith('/leaves', {
      personId: 2,
      startDate: '2026-11-02',
      endDate: '2026-11-06',
      leaveType: 'earned',
      reason: null,
    });
  });

  it('posts a reason that was written, without its surrounding spaces', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog({ personId: 1 });
    await fill(user);
    await user.type(screen.getByLabelText('Reason'), '  Family wedding  ');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.post).toHaveBeenCalledWith('/leaves', expect.objectContaining({ reason: 'Family wedding' }));
  });

  it('accepts a single day, the same date in both', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog({ personId: 1 });
    await fill(user, '2026-11-02', '2026-11-02');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.post).toHaveBeenCalledWith(
      '/leaves',
      expect.objectContaining({ startDate: '2026-11-02', endDate: '2026-11-02' })
    );
  });

  it('asks for a person, and saves nothing without one', async () => {
    const user = userEvent.setup();
    openDialog();
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Choose a person')).toBeInTheDocument();
    expect(screen.getByLabelText('Person')).toHaveAttribute('aria-invalid', 'true');
    expect(coreApi.post).not.toHaveBeenCalled();
  });

  it('asks for a type, and for both days, and saves nothing without them', async () => {
    const user = userEvent.setup();
    openDialog({ personId: 1 });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Choose a type')).toBeInTheDocument();
    expect(screen.getByText('First day is required')).toBeInTheDocument();
    expect(screen.getByText('Last day is required')).toBeInTheDocument();
    expect(coreApi.post).not.toHaveBeenCalled();
  });

  it('refuses a last day before the first, on the last day, and saves nothing', async () => {
    const user = userEvent.setup();
    openDialog({ personId: 1 });
    await fill(user, '2026-11-06', '2026-11-02');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('The last day must not be before the first')).toBeInTheDocument();
    expect(screen.getByLabelText('Last day')).toHaveAttribute('aria-invalid', 'true');
    expect(coreApi.post).not.toHaveBeenCalled();
  });

  it('does not ask for the person when it is given: it is that person’s leave, and goes under their id', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog({ personId: 3 });
    expect(screen.queryByLabelText('Person')).not.toBeInTheDocument();
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.post).toHaveBeenCalledWith('/leaves', expect.objectContaining({ personId: 3 }));
  });

  it('shows the service’s own words when the leave overlaps another of the person’s, and keeps the dialog open', async () => {
    vi.mocked(coreApi.post).mockRejectedValue(failure(409, OVERLAP));
    const user = userEvent.setup();
    openDialog({ personId: 1 });
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(OVERLAP);
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('saves again under other days after an overlap, and closes', async () => {
    vi.mocked(coreApi.post).mockRejectedValueOnce(failure(409, OVERLAP)).mockResolvedValueOnce(saved);
    const user = userEvent.setup();
    openDialog({ personId: 1 });
    await fill(user, '2026-03-11', '2026-03-13');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText(OVERLAP);
    await user.clear(screen.getByLabelText('First day'));
    await user.type(screen.getByLabelText('First day'), '2026-03-13');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.post).toHaveBeenNthCalledWith(2, '/leaves', expect.objectContaining({ startDate: '2026-03-13' }));
  });

  it('shows the service’s words for a person it no longer has', async () => {
    vi.mocked(coreApi.post).mockRejectedValue(failure(409, 'Referenced record does not exist'));
    const user = userEvent.setup();
    openDialog({ personId: 1 });
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Referenced record does not exist');
  });

  it('shows the service’s words for days it refuses as a 422', async () => {
    vi.mocked(coreApi.post).mockRejectedValue(failure(422, 'The last day must not be before the first'));
    const user = userEvent.setup();
    openDialog({ personId: 1 });
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The last day must not be before the first');
  });

  it('keeps the dialog open and says so when the save fails, and saves the same leave again on a retry', async () => {
    vi.mocked(coreApi.post).mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce(saved);
    const user = userEvent.setup();
    openDialog({ personId: 1 });
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('That did not save. Try again.');
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.post).toHaveBeenCalledTimes(2);
  });

  it('does not read the answer to a save, so an answer it does not know cannot look like a failed save', async () => {
    vi.mocked(coreApi.post).mockResolvedValue({ data: { surprise: true } });
    const user = userEvent.setup();
    openDialog({ personId: 1 });
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('says so when the people could not be loaded', async () => {
    serve({ people: 'fail' });
    openDialog();
    expect(await screen.findByText('People could not be loaded.')).toBeInTheDocument();
  });

  it('closes without saving on Cancel', async () => {
    const user = userEvent.setup();
    openDialog();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(coreApi.post).not.toHaveBeenCalled();
  });
});

describe('LeaveFormDialog: editing', () => {
  it('opens on the leave: the person as text it cannot change, the type, the days and the reason', () => {
    openDialog({ leave: adaWedding });
    expect(screen.getByRole('dialog', { name: 'Edit leave' })).toBeInTheDocument();
    expect(screen.getByLabelText('Person')).toHaveValue('Ada Lovelace');
    expect(screen.getByLabelText('Person')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Type')).toHaveValue('casual');
    expect(screen.getByLabelText('First day')).toHaveValue('2026-03-12');
    expect(screen.getByLabelText('Last day')).toHaveValue('2026-03-14');
    expect(screen.getByLabelText('Reason')).toHaveValue('Family wedding');
  });

  it('changes the leave with PATCH under its id, and sends the days, the type and the reason but not the person', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog({ leave: adaWedding });
    await user.selectOptions(screen.getByLabelText('Type'), 'Sick');
    await user.clear(screen.getByLabelText('Last day'));
    await user.type(screen.getByLabelText('Last day'), '2026-03-16');
    await user.clear(screen.getByLabelText('Reason'));
    await user.type(screen.getByLabelText('Reason'), 'Flu');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.post).not.toHaveBeenCalled();
    expect(coreApi.patch).toHaveBeenCalledTimes(1);
    expect(coreApi.patch).toHaveBeenCalledWith('/leaves/3', {
      startDate: '2026-03-12',
      endDate: '2026-03-16',
      leaveType: 'sick',
      reason: 'Flu',
    });
  });

  it('sends the leave back as it was when it is saved without a change', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog({ leave: adaWedding });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.patch).toHaveBeenCalledWith('/leaves/3', {
      startDate: '2026-03-12',
      endDate: '2026-03-14',
      leaveType: 'casual',
      reason: 'Family wedding',
    });
  });

  it('sends a null reason to clear it when the field is emptied', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    openDialog({ leave: adaTravel });
    await user.clear(screen.getByLabelText('Reason'));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.patch).toHaveBeenCalledWith('/leaves/1', expect.objectContaining({ reason: null }));
  });

  it('shows the service’s words when the new days overlap another leave of the person', async () => {
    vi.mocked(coreApi.patch).mockRejectedValue(failure(409, OVERLAP));
    const user = userEvent.setup();
    openDialog({ leave: adaWedding });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(OVERLAP);
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('says the leave was removed elsewhere, rather than offering a retry that cannot work, when it is gone', async () => {
    vi.mocked(coreApi.patch).mockRejectedValue(failure(404));
    const user = userEvent.setup();
    openDialog({ leave: adaWedding });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This leave was removed elsewhere, so it cannot be saved. Close this dialog and go back to the register.'
    );
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('closes without saving on Cancel', async () => {
    const user = userEvent.setup();
    openDialog({ leave: adaWedding });
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(coreApi.patch).not.toHaveBeenCalled();
  });
});
