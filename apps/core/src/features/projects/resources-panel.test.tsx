import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import { coreApi } from '@/lib/core-api';
import { categoriesEnvelope } from '@/test/fixtures/categories';
import { peopleEnvelope, peopleRows, resourceRows, resourcesEnvelope } from '@/test/fixtures/projects';
import { renderWithProviders } from '@/test/utils';
import { ResourcesPanel } from './resources-panel';

vi.mock('@/lib/core-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/core-api')>()),
  coreApi: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const failure = (status: number) =>
  new AxiosError('failed', 'ERR_BAD_REQUEST', undefined, null, {
    status,
    data: {},
    statusText: String(status),
    headers: {},
    config: {} as never,
  });

const saved = { data: { statusCode: 200, message: 'saved', data: {}, meta: null } };

const serve = (resources: unknown = resourcesEnvelope(), people: unknown = peopleEnvelope()) =>
  vi.mocked(coreApi.get).mockImplementation((async (path: string) => {
    if (path === '/project-resources') return { data: resources };
    if (path === '/people') return { data: people };
    if (path === '/categories') return { data: categoriesEnvelope() };
    throw new Error(`unexpected GET ${path}`);
  }) as never);

const renderPanel = (billingType: 'retainer' | 'fixed_cost' | null = 'retainer') =>
  renderWithProviders(<ResourcesPanel projectId={1} billingType={billingType} />);

beforeEach(() => {
  serve();
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('ResourcesPanel: reading', () => {
  it('asks for only this project’s resources', async () => {
    renderPanel();
    await screen.findByRole('table', { name: 'Resources' });
    expect(coreApi.get).toHaveBeenCalledWith('/project-resources', { params: { projectId: 1 } });
  });

  it('lists each resource with its category, person and hourly rate, and a dash for what is missing', async () => {
    renderPanel();
    const table = await screen.findByRole('table', { name: 'Resources' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    const asha = within(rows[0]);
    expect(asha.getByText('Asha Rao', { selector: 'td:nth-child(1)' })).toBeInTheDocument();
    expect(asha.getByText('Mobile')).toBeInTheDocument();
    expect(asha.getByText('Asha Rao', { selector: 'td:nth-child(3)' })).toBeInTheDocument();
    expect(asha.getByText('$150')).toBeInTheDocument();
    const ben = within(rows[1]);
    expect(ben.getByText('Web')).toBeInTheDocument();
    expect(ben.getByText('—')).toBeInTheDocument();
    expect(ben.getByText('$75')).toBeInTheDocument();
  });

  it('shows a dash for a category the service no longer lists', async () => {
    serve(resourcesEnvelope([{ ...resourceRows[0], category: null }]));
    renderPanel();
    const table = await screen.findByRole('table', { name: 'Resources' });
    expect(within(table).getByText('—')).toBeInTheDocument();
  });

  it('says so, and offers the first resource, when there are none; a retainer adds what resources are for', async () => {
    serve(resourcesEnvelope([]));
    renderPanel('retainer');
    expect(await screen.findByText('No resources yet.')).toBeInTheDocument();
    expect(screen.getByText('Resources build the lines of a retainer invoice.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add the first resource' })).toBeInTheDocument();
  });

  it('leaves out the retainer sentence for a fixed cost project', async () => {
    serve(resourcesEnvelope([]));
    renderPanel('fixed_cost');
    expect(await screen.findByText('No resources yet.')).toBeInTheDocument();
    expect(screen.queryByText('Resources build the lines of a retainer invoice.')).not.toBeInTheDocument();
  });

  it('shows an error with a retry inside the panel when the resources cannot be loaded', async () => {
    vi.mocked(coreApi.get).mockRejectedValue(failure(500));
    const user = userEvent.setup();
    renderPanel();
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load this data');
    serve();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('table', { name: 'Resources' })).toBeInTheDocument();
  });

  it('shows how many people a row stands for, in a Qty column', async () => {
    serve(resourcesEnvelope([{ ...resourceRows[0], name: 'Fullstack Developer', headcount: 3 }]));
    renderPanel();
    const table = await screen.findByRole('table', { name: 'Resources' });
    expect(within(table).getByRole('columnheader', { name: 'Qty' })).toBeInTheDocument();
    const row = within(table).getAllByRole('row')[1];
    expect(within(row).getByText('3')).toBeInTheDocument();
  });
});

describe('ResourcesPanel: changing', () => {
  it('opens the resource dialog empty to add one', async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(await screen.findByRole('button', { name: 'Add resource' }));
    expect(screen.getByRole('dialog', { name: 'New resource' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('');
  });

  it('opens the resource dialog on a resource', async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(await screen.findByRole('button', { name: 'Edit Ben Cho' }));
    expect(screen.getByRole('dialog', { name: 'Edit resource' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Ben Cho');
  });

  it('deletes a resource only after the confirmation, then refetches the list', async () => {
    vi.mocked(coreApi.delete).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderPanel();
    await user.click(await screen.findByRole('button', { name: 'Delete Asha Rao' }));
    expect(screen.getByText('Delete resource “Asha Rao”?')).toBeInTheDocument();
    expect(screen.getByText('Invoices already built from it keep their lines. This cannot be undone.')).toBeInTheDocument();
    expect(coreApi.delete).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Delete resource' }));
    await waitFor(() => expect(coreApi.delete).toHaveBeenCalledWith('/project-resources/1'));
    await waitFor(() =>
      expect(vi.mocked(coreApi.get).mock.calls.filter(([path]) => path === '/project-resources')).toHaveLength(2),
    );
  });

  it('treats deleting a resource that was already removed as done', async () => {
    vi.mocked(coreApi.delete).mockRejectedValue(failure(404));
    const user = userEvent.setup();
    renderPanel();
    await user.click(await screen.findByRole('button', { name: 'Delete Asha Rao' }));
    await user.click(screen.getByRole('button', { name: 'Delete resource' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });
});

describe('ResourcesPanel: team cost against billing', () => {
  const resourceOf = (over: Record<string, unknown>) => ({ ...resourceRows[0], ...over });
  const personOf = (id: number, monthlySalary: number | null) => ({ ...peopleRows[0], id, monthlySalary });
  const sentence = (expected: string) => (_: string, element: Element | null) =>
    element?.tagName === 'P' && element.textContent === expected;

  it('says what the counted resources bill a month against their salaries, and how many it counted', async () => {
    serve(
      resourcesEnvelope([
        resourceOf({ id: 1, personId: 1, rate: 50 }),
        resourceOf({ id: 2, personId: 2, rate: 40, name: 'Ben Cho', person: { id: 2, name: 'Ben Cho' } }),
        resourceOf({ id: 3, personId: null, person: null, name: 'Open role', rate: 90 }),
      ]),
      peopleEnvelope([personOf(1, 5000), personOf(2, 4800)]),
    );
    renderPanel();
    // billed (50 + 40) x 160 = 14,400; cost 9,800; margin 4,600 (32%); 2 of the 3 resources are counted.
    expect(
      await screen.findByText(
        sentence('At current salaries, 2 of 3 resources bill $14,400 a month against $9,800 in salary: a margin of $4,600 (32%).'),
      ),
    ).toBeInTheDocument();
  });

  it('says bills for one resource, and shortfall when the salary is more than the billing', async () => {
    serve(resourcesEnvelope([resourceOf({ id: 1, personId: 1, rate: 5 })]), peopleEnvelope([personOf(1, 900)]));
    renderPanel();
    // billed 5 x 160 = 800; cost 900; a shortfall of 100, 12.5% of 800, shown as 13%.
    expect(
      await screen.findByText(
        sentence('At current salaries, 1 of 1 resource bills $800 a month against $900 in salary: a shortfall of $100 (13%).'),
      ),
    ).toBeInTheDocument();
  });

  it('leaves the percentage out when the counted rates are all 0', async () => {
    serve(resourcesEnvelope([resourceOf({ id: 1, personId: 1, rate: 0 })]), peopleEnvelope([personOf(1, 5000)]));
    renderPanel();
    expect(
      await screen.findByText(
        sentence('At current salaries, 1 of 1 resource bills $0 a month against $5,000 in salary: a shortfall of $5,000.'),
      ),
    ).toBeInTheDocument();
  });

  it('says there is no margin yet when no resource has a person with a salary', async () => {
    renderPanel();
    expect(
      await screen.findByText('No margin yet: none of these resources has a person with a salary and a Qty of 1.'),
    ).toBeInTheDocument();
  });

  it('carries the caveat, and shows the total salary but no individual’s', async () => {
    serve(
      resourcesEnvelope([
        resourceOf({ id: 1, personId: 1, rate: 50 }),
        resourceOf({ id: 2, personId: 2, rate: 40, name: 'Ben Cho', person: { id: 2, name: 'Ben Cho' } }),
      ]),
      peopleEnvelope([personOf(1, 5000), personOf(2, 4800)]),
    );
    renderPanel();
    await screen.findByText(/At current salaries/);
    expect(
      screen.getByText(
        'Salary is today’s figure, not what was paid. Resources with no person, no salary or a Qty above 1 are left out.',
      ),
    ).toBeInTheDocument();
    // The two salaries are 5,000 and 4,800; only their total, 9,800, may appear.
    expect(screen.getByText('$9,800')).toBeInTheDocument();
    expect(screen.queryByText(/\$5,000/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\$4,800/)).not.toBeInTheDocument();
  });

  it.each([
    ['a fixed cost project', 'fixed_cost' as const],
    ['a project with no billing type', null],
  ])('shows nothing for %s', async (_name, billingType) => {
    renderPanel(billingType);
    await screen.findByRole('table', { name: 'Resources' });
    expect(screen.queryByText(/At current salaries|No margin yet|Salary is today/)).not.toBeInTheDocument();
  });

  it('shows nothing for a retainer with no resources', async () => {
    serve(resourcesEnvelope([]));
    renderPanel();
    expect(await screen.findByText('No resources yet.')).toBeInTheDocument();
    expect(screen.queryByText(/At current salaries|No margin yet|Salary is today/)).not.toBeInTheDocument();
  });

  it('says the salaries could not be loaded, and does not say there is no margin, when the people list fails', async () => {
    vi.mocked(coreApi.get).mockImplementation((async (path: string) => {
      if (path === '/project-resources') return { data: resourcesEnvelope() };
      throw new Error('down');
    }) as never);
    renderPanel();
    expect(await screen.findByText('Salaries could not be loaded.')).toBeInTheDocument();
    expect(screen.queryByText(/No margin yet/)).not.toBeInTheDocument();
  });
});
