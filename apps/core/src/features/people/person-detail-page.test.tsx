import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import { Route, Routes, useLocation } from 'react-router-dom';
import { coreApi } from '@/lib/core-api';
import { allocationEnvelope, allocationRows, allocationsEnvelope } from '@/test/fixtures/allocations';
import { leaveRows, leavesEnvelope } from '@/test/fixtures/leaves';
import { peopleEnvelope, personRows } from '@/test/fixtures/people';
import { projectRows, projectsEnvelope } from '@/test/fixtures/projects';
import { technologiesEnvelope } from '@/test/fixtures/technologies';
import { renderWithProviders } from '@/test/utils';
import { PersonDetailPage } from './person-detail-page';

vi.mock('@/lib/core-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/core-api')>()),
  coreApi: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

// A fixed "today", so where a person is now and an entry's default date can be checked against exact days.
vi.mock('@/lib/format', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/format')>()),
  localToday: () => '2026-10-20',
}));

const failure = (status: number) =>
  new AxiosError('failed', 'ERR_BAD_REQUEST', undefined, null, {
    status,
    data: {},
    statusText: String(status),
    headers: {},
    config: {} as never,
  });

/** What the service answers a write with; the page never reads it. */
const saved = { data: { statusCode: 200, message: 'saved', data: {}, meta: null } };

const ada = personRows[0];
const grace = personRows[1];
const linus = personRows[2];

/** The service filters entries and leaves by person; the stand-in does the same. */
interface Served {
  person?: unknown;
  entries?: unknown[];
  leaves?: unknown[];
  projects?: unknown[];
}

const state: Required<Served> = { person: ada, entries: [], leaves: [], projects: [] };

const serve = (over: Served = {}) => {
  Object.assign(state, { person: ada, entries: allocationRows, leaves: leaveRows, projects: projectRows }, over);
  vi.mocked(coreApi.get).mockImplementation((async (path: string, config?: { params?: { personId?: number } }) => {
    const personId = config?.params?.personId;
    const mine = (rows: unknown[]) =>
      personId === undefined ? rows : rows.filter((row) => (row as { personId: number }).personId === personId);
    if (path === '/people/1') return { data: peopleEnvelope(state.person) };
    if (path === '/people') return { data: peopleEnvelope() };
    if (path === '/projects') return { data: projectsEnvelope(state.projects) };
    if (path === '/allocations') return { data: allocationsEnvelope(mine(state.entries)) };
    if (path === '/leaves') return { data: leavesEnvelope(mine(state.leaves)) };
    if (path === '/technologies') return { data: technologiesEnvelope() };
    throw failure(404);
  }) as never);
};

/** Shows the address's query string, so a test can see which tab the page put there. */
function Search() {
  return <code data-testid="search">{useLocation().search}</code>;
}

function renderAt(route: string) {
  return renderWithProviders(
    <>
      <Routes>
        <Route path="/resources/people/:id" element={<PersonDetailPage />} />
        <Route path="/resources/people" element={<p>People list</p>} />
      </Routes>
      <Search />
    </>,
    { route }
  );
}

const sentence = (expected: string) => (_: string, element: Element | null) =>
  element?.tagName === 'P' && element.textContent === expected;

/** The value beside a label in the Overview facts. */
const fact = (label: string) => screen.getByText(label, { selector: 'dt' }).nextElementSibling as HTMLElement;

const gets = (path: string) => vi.mocked(coreApi.get).mock.calls.filter(([called]) => called === path);

beforeEach(() => {
  serve();
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('PersonDetailPage: reading', () => {
  it('asks for the person, and only their own allocation entries and leaves', async () => {
    renderAt('/resources/people/1');
    await screen.findByRole('heading', { level: 1, name: 'Ada Lovelace' });
    expect(coreApi.get).toHaveBeenCalledWith('/people/1');
    expect(coreApi.get).toHaveBeenCalledWith('/allocations', { params: { personId: 1 } });
    expect(coreApi.get).toHaveBeenCalledWith('/leaves', { params: { personId: 1 } });
    expect(coreApi.get).toHaveBeenCalledWith('/projects');
  });

  it('has a way back to the people', async () => {
    renderAt('/resources/people/1');
    expect(await screen.findByRole('link', { name: 'Back to people' })).toHaveAttribute('href', '/resources/people');
  });

  it('shows the person’s contact, dates, salary in rupees, contract and technologies', async () => {
    renderAt('/resources/people/1');
    await screen.findByRole('heading', { level: 1, name: 'Ada Lovelace' });
    expect(within(fact('Email')).getByRole('link', { name: 'ada@example.com' })).toHaveAttribute(
      'href',
      'mailto:ada@example.com'
    );
    expect(fact('Phone')).toHaveTextContent('+44 20 7946 0000');
    expect(fact('Joined')).toHaveTextContent('15 Jan 2024');
    expect(fact('Left')).toHaveTextContent('—');
    expect(fact('Monthly salary')).toHaveTextContent('₹85,000.00');
    expect(within(fact('Contract')).getByRole('link', { name: 'Contract for Ada Lovelace' })).toHaveAttribute(
      'href',
      'https://example.com/ada-contract.pdf'
    );
    expect(fact('Technologies')).toHaveTextContent('Nest, React');
  });

  it('shows a dash for what a person has none of: no salary, no contract, no technologies, no contact', async () => {
    serve({ person: linus });
    renderAt('/resources/people/1');
    await screen.findByRole('heading', { level: 1, name: 'Linus Torvalds' });
    for (const label of ['Email', 'Phone', 'Joined', 'Left', 'Monthly salary', 'Contract', 'Technologies']) {
      expect(fact(label)).toHaveTextContent('—');
    }
  });

  it('shows the date a person left', async () => {
    serve({ person: grace });
    renderAt('/resources/people/1');
    await screen.findByRole('heading', { level: 1, name: 'Grace Hopper' });
    expect(fact('Left')).toHaveTextContent('30 Jun 2025');
    expect(fact('Monthly salary')).toHaveTextContent('₹92,500.00');
  });

  it('shows an error with a retry when the person cannot be loaded, and loads them on the retry', async () => {
    vi.mocked(coreApi.get).mockRejectedValue(new Error('down'));
    const user = userEvent.setup();
    renderAt('/resources/people/1');
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load this data');
    serve();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Ada Lovelace' })).toBeInTheDocument();
  });
});

describe('PersonDetailPage: where the person is now', () => {
  it('says which project they are on, since when, with the project linking to its page', async () => {
    renderAt('/resources/people/1');
    expect(await screen.findByText(sentence('On Website since 12 Mar 2026'))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Website' })).toHaveAttribute('href', '/projects/1');
  });

  it('says they are on the bench, since when, when their latest entry is the bench', async () => {
    serve({ entries: [allocationRows[3]] });
    renderAt('/resources/people/1');
    expect(await screen.findByText(sentence('On the bench since 3 Nov 2025'))).toBeInTheDocument();
  });

  it('says they are not allocated yet when they have no entry', async () => {
    serve({ entries: [] });
    renderAt('/resources/people/1');
    expect(await screen.findByText(sentence('Not allocated yet'))).toBeInTheDocument();
  });

  it('says not allocated yet when every entry starts after today', async () => {
    serve({ entries: [{ ...allocationRows[1], effectiveDate: '2026-10-21' }] });
    renderAt('/resources/people/1');
    expect(await screen.findByText(sentence('Not allocated yet'))).toBeInTheDocument();
  });

  it('reads where they are from the dates, so a backfilled entry does not change it', async () => {
    const backfilled = {
      ...allocationRows[3],
      id: 9,
      projectId: 2,
      project: { id: 2, name: 'Mobile app' },
      effectiveDate: '2026-01-05',
    };
    serve({ entries: [allocationRows[1], backfilled, allocationRows[3]] });
    renderAt('/resources/people/1');
    expect(await screen.findByText(sentence('On Website since 12 Mar 2026'))).toBeInTheDocument();
  });

  it('says they are on the bench, with the project it last was, when that project is on hold', async () => {
    serve({ entries: [{ ...allocationRows[1], projectId: 2, project: { id: 2, name: 'Mobile app' } }] });
    renderAt('/resources/people/1');
    expect(await screen.findByText(sentence('On the bench. Last on Mobile app (on hold)'))).toBeInTheDocument();
  });

  it('says they are on the bench when their project has been deleted, with the name it keeps in the ledger', async () => {
    serve({ entries: [{ ...allocationRows[1], projectId: 99, project: { id: 99, name: 'Retired project' } }] });
    renderAt('/resources/people/1');
    expect(await screen.findByText(sentence('On the bench. Last on Retired project (deleted)'))).toBeInTheDocument();
  });

  it('says a person who has left is not on the board, whatever their last entry was', async () => {
    serve({ person: { ...ada, leaveDate: '2026-10-19' } });
    renderAt('/resources/people/1');
    expect(await screen.findByText(sentence('Left on 19 Oct 2026, so not on the board'))).toBeInTheDocument();
  });

  it('says a person who has not joined yet is not on the board', async () => {
    serve({ person: { ...ada, joinDate: '2026-11-02' } });
    renderAt('/resources/people/1');
    expect(await screen.findByText(sentence('Joins on 2 Nov 2026, so not on the board yet'))).toBeInTheDocument();
  });

  it('says nothing about it while the entries load, and that it is unavailable when they cannot be loaded', async () => {
    vi.mocked(coreApi.get).mockImplementation((async (path: string) => {
      if (path === '/people/1') return { data: peopleEnvelope(ada) };
      if (path === '/allocations') throw new Error('down');
      return { data: path === '/projects' ? projectsEnvelope() : peopleEnvelope() };
    }) as never);
    renderAt('/resources/people/1');
    expect(await screen.findByText(sentence('Where they are now is unavailable'))).toBeInTheDocument();
  });
});

describe('PersonDetailPage: where a person with several cards is now', () => {
  const mobileApp = { ...projectRows[1], projectStatus: 'active' };
  const second = (over: Record<string, unknown>) => ({
    ...allocationRows[1],
    id: 20,
    card: 2,
    effectiveDate: '2026-06-01',
    ...over,
  });
  const onMobile = { projectId: 2, project: { id: 2, name: 'Mobile app' } };

  it('lists where every card is, the lowest card number first, each project linking to its page', async () => {
    serve({ projects: [projectRows[0], mobileApp, projectRows[2]], entries: [second(onMobile), allocationRows[1]] });
    renderAt('/resources/people/1');
    expect(await screen.findByText(sentence('On Website and Mobile app'))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Website' })).toHaveAttribute('href', '/projects/1');
    expect(screen.getByRole('link', { name: 'Mobile app' })).toHaveAttribute('href', '/projects/2');
  });

  it('says the bench for a card on it, whichever card that is', async () => {
    serve({ entries: [second({ projectId: null, project: null }), allocationRows[1]] });
    renderAt('/resources/people/1');
    expect(await screen.findByText(sentence('On Website and the bench'))).toBeInTheDocument();
  });

  it('counts the cards on one project instead of naming it twice, as a card just copied makes', async () => {
    serve({ entries: [second({ projectId: 1, project: { id: 1, name: 'Website' } }), allocationRows[1]] });
    renderAt('/resources/people/1');
    expect(await screen.findByText(sentence('On Website (2 cards)'))).toBeInTheDocument();
  });

  it('says a card whose project is not active is on the bench, and which project it was on', async () => {
    serve({ entries: [second(onMobile), allocationRows[1]] });
    renderAt('/resources/people/1');
    expect(await screen.findByText(sentence('On Website and the bench. Last on Mobile app (on hold)'))).toBeInTheDocument();
  });

  it('is the one card’s sentence again when the other is removed', async () => {
    serve({
      entries: [
        { ...allocationRows[1], id: 21, card: 2, removed: true, projectId: null, project: null, effectiveDate: '2026-07-01' },
        second(onMobile),
        allocationRows[1],
      ],
    });
    renderAt('/resources/people/1');
    expect(await screen.findByText(sentence('On Website since 12 Mar 2026'))).toBeInTheDocument();
  });

  it('keeps the Allocate button, which adds an entry for a card of this person', async () => {
    serve({ entries: [second(onMobile), allocationRows[1]] });
    const user = userEvent.setup();
    renderAt('/resources/people/1');
    await user.click(await screen.findByRole('button', { name: 'Allocate' }));
    const dialog = await screen.findByRole('dialog', { name: 'New allocation entry' });
    expect(within(dialog).getByLabelText('Card')).toBeInTheDocument();
    expect(within(dialog).queryByLabelText('Person')).not.toBeInTheDocument();
  });

  it('counts every entry, of every card, in the Allocations tab', async () => {
    serve({ entries: [second(onMobile), allocationRows[1], allocationRows[3]] });
    renderAt('/resources/people/1');
    await waitFor(() =>
      expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Overview', 'Allocations 3', 'Leave 2']),
    );
  });
});

describe('PersonDetailPage: allocating', () => {
  it('opens the entry form for this person, who is not asked for', async () => {
    const user = userEvent.setup();
    renderAt('/resources/people/1');
    await user.click(await screen.findByRole('button', { name: 'Allocate' }));
    const dialog = await screen.findByRole('dialog', { name: 'New allocation entry' });
    expect(within(dialog).queryByLabelText('Person')).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText('Effective date')).toHaveValue('2026-10-20');
  });

  it('saves the entry under this person, and reads where they are again', async () => {
    vi.mocked(coreApi.post).mockImplementation((async () => {
      serve({
        entries: [
          { ...allocationRows[1], id: 9, projectId: null, project: null, effectiveDate: '2026-10-20' },
          ...allocationRows,
        ],
      });
      return saved;
    }) as never);
    const user = userEvent.setup();
    renderAt('/resources/people/1');
    await user.click(await screen.findByRole('button', { name: 'Allocate' }));
    const dialog = await screen.findByRole('dialog', { name: 'New allocation entry' });
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(coreApi.post).toHaveBeenCalledWith('/allocations', {
      personId: 1,
      card: 1,
      projectId: null,
      removed: false,
      effectiveDate: '2026-10-20',
      note: null,
    });
    expect(await screen.findByText(sentence('On the bench since 20 Oct 2026'))).toBeInTheDocument();
  });

  it('puts focus back on the Allocate button when the dialog closes', async () => {
    const user = userEvent.setup();
    renderAt('/resources/people/1');
    await user.click(await screen.findByRole('button', { name: 'Allocate' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Allocate' })).toHaveFocus());
  });
});

describe('PersonDetailPage: tabs', () => {
  it('opens on the overview at the bare address, with the sections named and counted', async () => {
    renderAt('/resources/people/1');
    await screen.findByRole('heading', { level: 1, name: 'Ada Lovelace' });
    const tabs = screen.getByRole('tablist', { name: 'Person sections' });
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    await waitFor(() =>
      expect(
        within(tabs)
          .getAllByRole('tab')
          .map((tab) => tab.textContent)
      ).toEqual(['Overview', 'Allocations 2', 'Leave 2'])
    );
  });

  it('shows only the overview: not the ledger and not the leaves', async () => {
    renderAt('/resources/people/1');
    await screen.findByRole('heading', { level: 1, name: 'Ada Lovelace' });
    expect(screen.queryByRole('table', { name: 'Allocation ledger' })).not.toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Leave' })).not.toBeInTheDocument();
  });

  it('opens the Allocations tab from ?tab=allocations, with only this person’s entries, and Add entry', async () => {
    renderAt('/resources/people/1?tab=allocations');
    const table = await screen.findByRole('table', { name: 'Allocation ledger' });
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(within(table).queryByRole('columnheader', { name: 'Person' })).not.toBeInTheDocument();
    expect(within(table).getByText('Website')).toBeInTheDocument();
    expect(within(table).queryByText('Mobile app')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add entry' })).toBeInTheDocument();
    expect(screen.queryByText(sentence('On Website since 12 Mar 2026'))).not.toBeInTheDocument();
  });

  it('adds an entry from the Allocations tab for this person, without asking who', async () => {
    vi.mocked(coreApi.post).mockResolvedValue({ data: allocationEnvelope() });
    const user = userEvent.setup();
    renderAt('/resources/people/1?tab=allocations');
    await user.click(await screen.findByRole('button', { name: 'Add entry' }));
    expect(screen.queryByLabelText('Person')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(coreApi.post).toHaveBeenCalledWith('/allocations', expect.objectContaining({ personId: 1 }))
    );
  });

  it('opens the Leave tab from ?tab=leave, with only this person’s leaves, and Add leave', async () => {
    renderAt('/resources/people/1?tab=leave');
    const table = await screen.findByRole('table', { name: 'Leave' });
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(within(table).queryByRole('columnheader', { name: 'Person' })).not.toBeInTheDocument();
    expect(within(table).getByText('Family wedding')).toBeInTheDocument();
    expect(within(table).queryByText('Grace Hopper')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add leave' })).toBeInTheDocument();
  });

  it('adds a leave from the Leave tab for this person, without asking who', async () => {
    vi.mocked(coreApi.post).mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    renderAt('/resources/people/1?tab=leave');
    await user.click(await screen.findByRole('button', { name: 'Add leave' }));
    expect(screen.queryByLabelText('Person')).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Type'), 'Sick');
    await user.type(screen.getByLabelText('First day'), '2026-11-02');
    await user.type(screen.getByLabelText('Last day'), '2026-11-02');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(coreApi.post).toHaveBeenCalledWith('/leaves', expect.objectContaining({ personId: 1, leaveType: 'sick' }))
    );
  });

  it('opens the overview for a tab it does not know', async () => {
    renderAt('/resources/people/1?tab=nope');
    expect(await screen.findByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByText(sentence('On Website since 12 Mar 2026'))).toBeInTheDocument();
  });

  it('puts the chosen tab in the address, and the overview back to the bare address', async () => {
    const user = userEvent.setup();
    renderAt('/resources/people/1');
    await user.click(await screen.findByRole('tab', { name: /Leave/ }));
    expect(screen.getByTestId('search')).toHaveTextContent('?tab=leave');
    await user.click(screen.getByRole('tab', { name: /Allocations/ }));
    expect(screen.getByTestId('search')).toHaveTextContent('?tab=allocations');
    await user.click(screen.getByRole('tab', { name: 'Overview' }));
    expect(screen.getByTestId('search')).toHaveTextContent('');
  });
});

describe('PersonDetailPage: editing and deleting', () => {
  it('opens the person form on the person, salary and technologies included', async () => {
    const user = userEvent.setup();
    renderAt('/resources/people/1');
    await user.click(await screen.findByRole('button', { name: 'Edit person' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit person' });
    expect(within(dialog).getByLabelText('Name')).toHaveValue('Ada Lovelace');
    expect(within(dialog).getByLabelText('Monthly salary (INR)')).toHaveValue('85000.00');
    expect(within(dialog).getByRole('checkbox', { name: 'React' })).toBeChecked();
  });

  it('shows the person as saved, with no reload', async () => {
    vi.mocked(coreApi.patch).mockImplementation((async () => {
      serve({ person: { ...ada, name: 'Ada King' } });
      return saved;
    }) as never);
    const user = userEvent.setup();
    renderAt('/resources/people/1');
    await user.click(await screen.findByRole('button', { name: 'Edit person' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit person' });
    await user.clear(within(dialog).getByLabelText('Name'));
    await user.type(within(dialog).getByLabelText('Name'), 'Ada King');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Ada King' })).toBeInTheDocument();
    expect(coreApi.patch).toHaveBeenCalledWith('/people/1', expect.objectContaining({ name: 'Ada King' }));
  });

  it('puts focus back on Edit person when the form closes', async () => {
    const user = userEvent.setup();
    renderAt('/resources/people/1');
    await user.click(await screen.findByRole('button', { name: 'Edit person' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit person' })).toHaveFocus());
  });

  it('deletes only after the confirmation, which says the entries and leaves go with the person, and goes back to the people', async () => {
    vi.mocked(coreApi.delete).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderAt('/resources/people/1');
    await user.click(await screen.findByRole('button', { name: 'Delete person' }));
    expect(screen.getByText('Delete person “Ada Lovelace”?')).toBeInTheDocument();
    expect(
      screen.getByText(/Their allocation entries and leaves are deleted with them\. This cannot be undone\./)
    ).toBeInTheDocument();
    expect(coreApi.delete).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Delete person' }));
    await waitFor(() => expect(coreApi.delete).toHaveBeenCalledWith('/people/1'));
    expect(await screen.findByText('People list')).toBeInTheDocument();
    expect(coreApi.delete).toHaveBeenCalledTimes(1);
  });

  it('does not ask for a person it has just deleted, which would only be a 404 on its way out', async () => {
    vi.mocked(coreApi.delete).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderAt('/resources/people/1');
    await user.click(await screen.findByRole('button', { name: 'Delete person' }));
    const before = gets('/people/1').length;
    await user.click(screen.getByRole('button', { name: 'Delete person' }));
    expect(await screen.findByText('People list')).toBeInTheDocument();
    expect(gets('/people/1')).toHaveLength(before);
    expect(screen.queryByText('Person not found')).not.toBeInTheDocument();
  });

  it('leaves the person alone when the confirmation is cancelled', async () => {
    const user = userEvent.setup();
    renderAt('/resources/people/1');
    await user.click(await screen.findByRole('button', { name: 'Delete person' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(coreApi.delete).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { level: 1, name: 'Ada Lovelace' })).toBeInTheDocument();
  });

  it('says so, and stays, when the delete fails', async () => {
    vi.mocked(coreApi.delete).mockRejectedValue(failure(500));
    const user = userEvent.setup();
    renderAt('/resources/people/1');
    await user.click(await screen.findByRole('button', { name: 'Delete person' }));
    await user.click(screen.getByRole('button', { name: 'Delete person' }));
    expect(await screen.findByText('That did not work. Try again.')).toBeInTheDocument();
    expect(screen.queryByText('People list')).not.toBeInTheDocument();
  });
});

describe('PersonDetailPage: a person who is not there', () => {
  it('says so, with a way back, when the service has no such person', async () => {
    vi.mocked(coreApi.get).mockImplementation((async () => {
      throw failure(404);
    }) as never);
    renderAt('/resources/people/1');
    expect(await screen.findByRole('heading', { level: 1, name: 'Person not found' })).toBeInTheDocument();
    expect(screen.getByText('This person does not exist, or they were deleted.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to people' })).toHaveAttribute('href', '/resources/people');
  });

  it.each(['abc', '0', '1.5', '-1', '1e3', '01', '99999999999', '2147483648'])(
    'does not even ask the service about %s',
    (id) => {
      renderAt(`/resources/people/${id}`);
      expect(screen.getByRole('heading', { level: 1, name: 'Person not found' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Back to people' })).toHaveAttribute('href', '/resources/people');
      expect(coreApi.get).not.toHaveBeenCalled();
    }
  );

  it('asks about the biggest id the service can hold', async () => {
    vi.mocked(coreApi.get).mockImplementation((async () => {
      throw failure(404);
    }) as never);
    renderAt('/resources/people/2147483647');
    expect(await screen.findByRole('heading', { level: 1, name: 'Person not found' })).toBeInTheDocument();
    expect(coreApi.get).toHaveBeenCalledWith('/people/2147483647');
  });
});
