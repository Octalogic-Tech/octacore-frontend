import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { coreApi } from '@/lib/core-api';
import { peopleEnvelope, personRows } from '@/test/fixtures/people';
import { technologiesEnvelope } from '@/test/fixtures/technologies';
import { renderWithProviders } from '@/test/utils';
import { PeoplePage } from './people-page';

vi.mock('@/lib/core-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/core-api')>()),
  coreApi: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

/** The next GETs answer with this body, in the service's envelope. */
const serve = (people: unknown = peopleEnvelope()) =>
  vi.mocked(coreApi.get).mockImplementation((async (path: string) => {
    if (path === '/people') return { data: people };
    if (path === '/technologies') return { data: technologiesEnvelope() };
    throw new Error(`unexpected GET ${path}`);
  }) as never);

/** What the service answers a delete with; the page does not read it. */
const saved = { data: { statusCode: 200, message: 'saved', data: personRows[0], meta: null } };

const rowOf = async (name: string) => within((await screen.findByText(name)).closest('tr') as HTMLElement);

beforeEach(() => {
  serve();
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('PeoplePage', () => {
  it('asks the core service for the people, not the mock API', async () => {
    renderWithProviders(<PeoplePage />);
    await screen.findByText('Ada Lovelace');
    expect(coreApi.get).toHaveBeenCalledWith('/people');
  });

  it('lists each person with their contact, dates and monthly salary in rupees', async () => {
    renderWithProviders(<PeoplePage />);
    const ada = await rowOf('Ada Lovelace');
    expect(ada.getByText('ada@example.com')).toBeInTheDocument();
    expect(ada.getByText('+44 20 7946 0000')).toBeInTheDocument();
    expect(ada.getByText('15 Jan 2024')).toBeInTheDocument();
    expect(ada.getByText('₹85,000.00')).toBeInTheDocument();
    expect(screen.getByText('1–3 of 3')).toBeInTheDocument();
  });

  it('shows the date a person left, and a salary grouped the Indian way', async () => {
    renderWithProviders(<PeoplePage />);
    const grace = await rowOf('Grace Hopper');
    expect(grace.getByText('1 Mar 2023')).toBeInTheDocument();
    expect(grace.getByText('30 Jun 2025')).toBeInTheDocument();
    expect(grace.getByText('₹92,500.00')).toBeInTheDocument();
  });

  it('groups lakhs and crores, and shows a salary to the paisa', async () => {
    serve(peopleEnvelope([{ ...personRows[0], monthlySalaryPaise: 12_345_678 }]));
    renderWithProviders(<PeoplePage />);
    expect((await rowOf('Ada Lovelace')).getByText('₹1,23,456.78')).toBeInTheDocument();
  });

  it('lists the technologies each person knows, and nothing for a person who knows none', async () => {
    renderWithProviders(<PeoplePage />);
    expect(await screen.findByRole('columnheader', { name: 'Technologies' })).toBeInTheDocument();
    expect((await rowOf('Ada Lovelace')).getByText('Nest, React')).toBeInTheDocument();
    expect((await rowOf('Grace Hopper')).getByText('Express')).toBeInTheDocument();
    expect((await rowOf('Linus Torvalds')).queryByText(/Nest|React|Express/)).not.toBeInTheDocument();
  });

  it('links to the contract only when there is one', async () => {
    renderWithProviders(<PeoplePage />);
    const ada = await rowOf('Ada Lovelace');
    const link = ada.getByRole('link', { name: 'Contract for Ada Lovelace' });
    expect(link).toHaveAttribute('href', 'https://example.com/ada-contract.pdf');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect((await rowOf('Grace Hopper')).queryByRole('link')).not.toBeInTheDocument();
  });

  it('keeps a person who has only a name, and shows no salary for them rather than ₹0.00', async () => {
    renderWithProviders(<PeoplePage />);
    const linus = await rowOf('Linus Torvalds');
    expect(linus.getAllByRole('cell').slice(0, 7).map((cell) => cell.textContent)).toEqual([
      'Linus Torvalds',
      '',
      '',
      '',
      '',
      '',
      '',
    ]);
    expect(linus.queryByText('₹0.00')).not.toBeInTheDocument();
  });

  it('shows a salary of zero as ₹0.00, not as empty', async () => {
    serve(peopleEnvelope([{ ...personRows[2], monthlySalaryPaise: 0 }]));
    renderWithProviders(<PeoplePage />);
    expect((await rowOf('Linus Torvalds')).getByText('₹0.00')).toBeInTheDocument();
  });

  it.each<[string, string, string[]]>([
    ['a name', 'grace', ['Grace Hopper']],
    ['an email', 'ada@example', ['Ada Lovelace']],
    ['a phone number', '202 555', ['Grace Hopper']],
    ['a technology', 'react', ['Ada Lovelace']],
    ['part of a technology, in any case', 'EXPR', ['Grace Hopper']],
  ])('searches %s', async (_label, query, expected) => {
    const user = userEvent.setup();
    renderWithProviders(<PeoplePage />);
    await screen.findByText('Ada Lovelace');
    await user.type(screen.getByLabelText('Search people'), query);
    for (const name of ['Ada Lovelace', 'Grace Hopper', 'Linus Torvalds']) {
      if (expected.includes(name)) expect(screen.getByText(name)).toBeInTheDocument();
      else expect(screen.queryByText(name)).not.toBeInTheDocument();
    }
  });

  it('says so when nothing matches the search', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PeoplePage />);
    await screen.findByText('Ada Lovelace');
    await user.type(screen.getByLabelText('Search people'), 'zzz');
    expect(screen.getByText('No people match “zzz”.')).toBeInTheDocument();
  });

  it('offers to add the first person when there are none', async () => {
    serve(peopleEnvelope([]));
    renderWithProviders(<PeoplePage />);
    expect(await screen.findByText('No people yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add the first person' })).toBeInTheDocument();
  });

  it('opens the dialog empty to add a person', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PeoplePage />);
    await user.click(await screen.findByRole('button', { name: 'Add person' }));
    expect(screen.getByRole('dialog', { name: 'New person' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('');
    expect(screen.getByLabelText('Monthly salary (INR)')).toHaveValue('');
  });

  it('opens the dialog on a person, salary included', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PeoplePage />);
    await user.click(await screen.findByRole('button', { name: 'Edit Ada Lovelace' }));
    expect(screen.getByRole('dialog', { name: 'Edit person' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Ada Lovelace');
    expect(screen.getByLabelText('Monthly salary (INR)')).toHaveValue('85000.00');
  });

  it('deletes only after the confirmation', async () => {
    vi.mocked(coreApi.delete).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderWithProviders(<PeoplePage />);
    await user.click(await screen.findByRole('button', { name: 'Delete Ada Lovelace' }));
    expect(screen.getByText('Delete person “Ada Lovelace”?')).toBeInTheDocument();
    expect(coreApi.delete).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Delete person' }));
    await waitFor(() => expect(coreApi.delete).toHaveBeenCalledWith('/people/1'));
    expect(coreApi.delete).toHaveBeenCalledTimes(1);
  });

  it('marks the project resources stale after a delete, since the service unlinks the person from them', async () => {
    vi.mocked(coreApi.delete).mockResolvedValue(saved);
    const user = userEvent.setup();
    const { client } = renderWithProviders(<PeoplePage />);
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    await user.click(await screen.findByRole('button', { name: 'Delete Ada Lovelace' }));
    await user.click(screen.getByRole('button', { name: 'Delete person' }));
    await waitFor(() => expect(coreApi.delete).toHaveBeenCalledWith('/people/1'));
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['project-resources'] })),
    );
  });

  it('marks the allocation entries and leaves stale after a delete, since the service deletes them with the person', async () => {
    vi.mocked(coreApi.delete).mockResolvedValue(saved);
    const user = userEvent.setup();
    const { client } = renderWithProviders(<PeoplePage />);
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    await user.click(await screen.findByRole('button', { name: 'Delete Ada Lovelace' }));
    await user.click(screen.getByRole('button', { name: 'Delete person' }));
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['allocations'], refetchType: 'none' })),
    );
    expect(invalidate).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['leaves'], refetchType: 'none' }));
  });

  it('says in the confirmation that the allocation entries and leaves go with the person', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PeoplePage />);
    await user.click(await screen.findByRole('button', { name: 'Delete Ada Lovelace' }));
    expect(screen.getByText(/Their allocation entries and leaves are deleted with them\. This cannot be undone\./)).toBeInTheDocument();
  });

  it('moves focus to the search field after a delete removes the row that held it', async () => {
    vi.mocked(coreApi.delete).mockImplementation((async () => {
      serve(peopleEnvelope(personRows.slice(1)));
      return saved;
    }) as never);
    const user = userEvent.setup();
    renderWithProviders(<PeoplePage />);
    await user.click(await screen.findByRole('button', { name: 'Delete Ada Lovelace' }));
    await user.click(screen.getByRole('button', { name: 'Delete person' }));
    await waitFor(() => expect(screen.getByLabelText('Search people')).toHaveFocus());
  });
});

describe('PeoplePage: failures', () => {
  it('shows an error with a retry when the people request fails', async () => {
    vi.mocked(coreApi.get).mockRejectedValue(new Error('down'));
    renderWithProviders(<PeoplePage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load this data');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it.each([
    ['a bare array, which is what the json-server mock sends', personRows],
    ['a person row that has lost its name', peopleEnvelope([{ ...personRows[0], name: undefined }])],
    ['a person row that has lost its technologies', peopleEnvelope([{ ...personRows[0], technologies: undefined }])],
    ['a person row that has lost its salary field', peopleEnvelope([{ ...personRows[0], monthlySalaryPaise: undefined }])],
  ])('shows the error state, not a broken table, when the service answers with %s', async (_label, body) => {
    serve(body);
    renderWithProviders(<PeoplePage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load this data');
  });
});
