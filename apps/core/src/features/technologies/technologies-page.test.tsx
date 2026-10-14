import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { coreApi } from '@/lib/core-api';
import { categoriesEnvelope, categoryRows } from '@/test/fixtures/categories';
import { technologiesEnvelope, technologyRows } from '@/test/fixtures/technologies';
import { renderWithProviders } from '@/test/utils';
import { TechnologiesPage } from './technologies-page';

vi.mock('@/lib/core-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/core-api')>()),
  coreApi: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

/** The next GETs answer in the service's envelope: technologies from `rows`, categories from `categories`. */
const serve = (rows: unknown, categories: unknown = categoryRows) =>
  vi.mocked(coreApi.get).mockImplementation((async (url: string) => ({
    data: url === '/categories' ? categoriesEnvelope(categories) : technologiesEnvelope(rows),
  })) as never);

/** What the service answers a save with; the page does not read it. */
const saved = { data: { statusCode: 200, message: 'saved', data: technologyRows[0], meta: null } };

beforeEach(() => {
  serve(technologyRows);
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('TechnologiesPage', () => {
  it('asks the core service for the technologies, not the mock API', async () => {
    renderWithProviders(<TechnologiesPage />);
    await screen.findByText('React');
    expect(coreApi.get).toHaveBeenCalledWith('/technologies');
  });

  it('lists the category beside each technology, with a dash when there is none or it was deleted', async () => {
    renderWithProviders(<TechnologiesPage />);
    const react = (await screen.findByText('React')).closest('tr') as HTMLElement;
    expect(within(react).getByText('Web')).toBeInTheDocument();
    expect(within(react).getByText('A library for user interfaces.')).toBeInTheDocument();
    for (const name of ['Nest', 'Express']) {
      const row = screen.getByText(name).closest('tr') as HTMLElement;
      expect(within(row).getByText('—')).toBeInTheDocument();
    }
    expect(screen.getByText('1–3 of 3')).toBeInTheDocument();
  });

  it('searches name and description', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TechnologiesPage />);
    await screen.findByText('React');
    await user.type(screen.getByLabelText('Search technologies'), 'interfaces');
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.queryByText('Nest')).not.toBeInTheDocument();
    expect(screen.queryByText('Express')).not.toBeInTheDocument();
  });

  it('searches the category name', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TechnologiesPage />);
    await screen.findByText('React');
    await user.type(screen.getByLabelText('Search technologies'), 'web');
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.queryByText('Nest')).not.toBeInTheDocument();
    expect(screen.queryByText('Express')).not.toBeInTheDocument();
  });

  it('creates a technology with no category when none is chosen', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderWithProviders(<TechnologiesPage />);
    await user.click(await screen.findByRole('button', { name: 'Add technology' }));
    await waitFor(() => expect(screen.getByLabelText('Category')).toBeEnabled());
    expect(screen.getByLabelText('Category')).toHaveValue('');
    await user.type(screen.getByLabelText('Name'), 'Vite');
    await user.type(screen.getByLabelText('Description'), 'A build tool.');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(coreApi.post).toHaveBeenCalledWith('/technologies', {
        name: 'Vite',
        description: 'A build tool.',
        categoryId: null,
      }),
    );
  });

  it('blocks a technology without a name or description', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TechnologiesPage />);
    await user.click(await screen.findByRole('button', { name: 'Add technology' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(screen.getByText('Description is required')).toBeInTheDocument();
    expect(coreApi.post).not.toHaveBeenCalled();
  });

  it('edits with PATCH from the current category, leaving the resource and image links alone', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderWithProviders(<TechnologiesPage />);
    await user.click(await screen.findByRole('button', { name: 'Edit React' }));
    await waitFor(() => expect(screen.getByLabelText('Category')).toBeEnabled());
    expect(screen.getByLabelText('Name')).toHaveValue('React');
    expect(screen.getByLabelText('Category')).toHaveValue('1');
    await user.clear(screen.getByLabelText('Description'));
    await user.type(screen.getByLabelText('Description'), 'UI library.');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(coreApi.patch).toHaveBeenCalledWith('/technologies/1', {
        name: 'React',
        description: 'UI library.',
        categoryId: 1,
      }),
    );
  });

  it('edits a technology the service holds without a description from an empty field', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TechnologiesPage />);
    await user.click(await screen.findByRole('button', { name: 'Edit Nest' }));
    expect(screen.getByLabelText('Description')).toHaveValue('');
  });

  it('deletes only after the confirmation', async () => {
    vi.mocked(coreApi.delete).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderWithProviders(<TechnologiesPage />);
    await user.click(await screen.findByRole('button', { name: 'Delete React' }));
    expect(coreApi.delete).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Delete technology' }));
    await waitFor(() => expect(coreApi.delete).toHaveBeenCalledWith('/technologies/1'));
  });

  it('shows an error with a retry when the service is down', async () => {
    vi.mocked(coreApi.get).mockRejectedValue(new Error('down'));
    renderWithProviders(<TechnologiesPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load this data');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it.each([
    ['a bare array, which is what the json-server mock sends', technologyRows],
    ['an envelope whose row has lost its name', technologiesEnvelope([{ ...technologyRows[0], name: undefined }])],
    [
      'an envelope from a service that does not send categories yet',
      technologiesEnvelope(
        technologyRows.map((row) =>
          Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'categoryId' && key !== 'category')),
        ),
      ),
    ],
  ])('shows the error state, not a broken table, when the service answers with %s', async (_label, body) => {
    vi.mocked(coreApi.get).mockResolvedValue({ data: body });
    renderWithProviders(<TechnologiesPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load this data');
  });

  it('offers to add the first technology when there are none', async () => {
    serve([]);
    renderWithProviders(<TechnologiesPage />);
    expect(await screen.findByText('No technologies yet.')).toBeInTheDocument();
  });
});

describe('TechnologiesPage dialogs', () => {
  it('creates a technology in the chosen category', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderWithProviders(<TechnologiesPage />);
    await user.click(await screen.findByRole('button', { name: 'Add technology' }));
    await waitFor(() => expect(screen.getByLabelText('Category')).toBeEnabled());
    await user.type(screen.getByLabelText('Name'), 'Vite');
    await user.type(screen.getByLabelText('Description'), 'A build tool.');
    await user.selectOptions(screen.getByLabelText('Category'), 'Mobile');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(coreApi.post).toHaveBeenCalledWith('/technologies', {
        name: 'Vite',
        description: 'A build tool.',
        categoryId: 2,
      }),
    );
  });

  it('clears the category when None is chosen on an edit', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderWithProviders(<TechnologiesPage />);
    await user.click(await screen.findByRole('button', { name: 'Edit React' }));
    await waitFor(() => expect(screen.getByLabelText('Category')).toBeEnabled());
    await user.selectOptions(screen.getByLabelText('Category'), 'None');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(coreApi.patch).toHaveBeenCalledWith('/technologies/1', {
        name: 'React',
        description: 'A library for user interfaces.',
        categoryId: null,
      }),
    );
  });

  it('opens a technology whose category was deleted on None, and saving clears the stale link', async () => {
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderWithProviders(<TechnologiesPage />);
    await user.click(await screen.findByRole('button', { name: 'Edit Express' }));
    await waitFor(() => expect(screen.getByLabelText('Category')).toBeEnabled());
    expect(screen.getByLabelText('Category')).toHaveValue('');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(coreApi.patch).toHaveBeenCalledWith('/technologies/3', {
        name: 'Express',
        description: 'A framework for Node.',
        categoryId: null,
      }),
    );
  });

  it('keeps the current category when the categories could not be loaded', async () => {
    vi.mocked(coreApi.get).mockImplementation((async (url: string) => {
      if (url === '/categories') throw new Error('down');
      return { data: technologiesEnvelope(technologyRows) };
    }) as never);
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderWithProviders(<TechnologiesPage />);
    await user.click(await screen.findByRole('button', { name: 'Edit React' }));
    expect(await screen.findByText('Categories could not be loaded.')).toBeInTheDocument();
    expect(screen.getByLabelText('Category')).toBeDisabled();
    await user.clear(screen.getByLabelText('Description'));
    await user.type(screen.getByLabelText('Description'), 'UI library.');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(coreApi.patch).toHaveBeenCalledWith('/technologies/1', { name: 'React', description: 'UI library.' }),
    );
  });

  it('creates without a category when the categories could not be loaded', async () => {
    vi.mocked(coreApi.get).mockImplementation((async (url: string) => {
      if (url === '/categories') throw new Error('down');
      return { data: technologiesEnvelope(technologyRows) };
    }) as never);
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderWithProviders(<TechnologiesPage />);
    await user.click(await screen.findByRole('button', { name: 'Add technology' }));
    expect(await screen.findByText('Categories could not be loaded.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Name'), 'Vite');
    await user.type(screen.getByLabelText('Description'), 'A build tool.');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(coreApi.post).toHaveBeenCalledWith('/technologies', { name: 'Vite', description: 'A build tool.' }),
    );
  });

  it('disables the Category select while the categories are still loading', async () => {
    vi.mocked(coreApi.get).mockImplementation((async (url: string) => {
      if (url === '/categories') return new Promise(() => undefined);
      return { data: technologiesEnvelope(technologyRows) };
    }) as never);
    const user = userEvent.setup();
    renderWithProviders(<TechnologiesPage />);
    await user.click(await screen.findByRole('button', { name: 'Edit React' }));
    expect(screen.getByLabelText('Category')).toBeDisabled();
  });

  it('offers two categories with the same name and sends the id of the one chosen', async () => {
    serve(technologyRows, [categoryRows[0], { ...categoryRows[0], id: 3 }]);
    vi.mocked(coreApi.post).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderWithProviders(<TechnologiesPage />);
    await user.click(await screen.findByRole('button', { name: 'Add technology' }));
    await waitFor(() => expect(screen.getByLabelText('Category')).toBeEnabled());
    expect(screen.getAllByRole('option', { name: 'Web' })).toHaveLength(2);
    await user.type(screen.getByLabelText('Name'), 'Vite');
    await user.type(screen.getByLabelText('Description'), 'A build tool.');
    await user.selectOptions(screen.getByLabelText('Category'), '3');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(coreApi.post).toHaveBeenCalledWith('/technologies', {
        name: 'Vite',
        description: 'A build tool.',
        categoryId: 3,
      }),
    );
  });

  it('keeps a category the cached list has not heard of yet, instead of erasing it on save', async () => {
    // the page loaded its categories before "Web" existed; the technologies refetched since and carry it
    serve(technologyRows, [categoryRows[1]]);
    vi.mocked(coreApi.patch).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderWithProviders(<TechnologiesPage />);
    await user.click(await screen.findByRole('button', { name: 'Edit React' }));
    await waitFor(() => expect(screen.getByLabelText('Category')).toBeEnabled());
    expect(screen.getByLabelText('Category')).toHaveValue('1');
    expect(within(screen.getByLabelText('Category')).getByRole('option', { name: 'Web' })).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Description'));
    await user.type(screen.getByLabelText('Description'), 'UI library.');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(coreApi.patch).toHaveBeenCalledWith('/technologies/1', {
        name: 'React',
        description: 'UI library.',
        categoryId: 1,
      }),
    );
  });

  it('keeps what was typed when the categories arrive after the dialog was opened', async () => {
    let release!: () => void;
    vi.mocked(coreApi.get).mockImplementation((async (url: string) => {
      if (url === '/categories') {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        return { data: categoriesEnvelope(categoryRows) };
      }
      return { data: technologiesEnvelope(technologyRows) };
    }) as never);
    const user = userEvent.setup();
    renderWithProviders(<TechnologiesPage />);
    await user.click(await screen.findByRole('button', { name: 'Edit React' }));
    await user.clear(screen.getByLabelText('Description'));
    await user.type(screen.getByLabelText('Description'), 'UI library.');
    await act(async () => {
      release();
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    await waitFor(() => expect(screen.getByLabelText('Category')).toBeEnabled());
    expect(screen.getByLabelText('Description')).toHaveValue('UI library.');
    expect(screen.getByLabelText('Category')).toHaveValue('1');
  });

  it('keeps what was typed when the categories refresh with the same data', async () => {
    const user = userEvent.setup();
    const { client } = renderWithProviders(<TechnologiesPage />);
    await user.click(await screen.findByRole('button', { name: 'Edit React' }));
    await waitFor(() => expect(screen.getByLabelText('Category')).toBeEnabled());
    await user.clear(screen.getByLabelText('Description'));
    await user.type(screen.getByLabelText('Description'), 'UI library.');
    await act(async () => {
      await client.invalidateQueries({ queryKey: ['categories'] });
      // TanStack Query tells its observers on a zero-delay timer; let that notification (and the render) land
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    // the refetch really happened (one read when the page loaded, one from the invalidation), and the typing survived
    const categoryReads = vi.mocked(coreApi.get).mock.calls.filter(([url]) => url === '/categories');
    expect(categoryReads.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByLabelText('Description')).toHaveValue('UI library.');
  });

  it('keeps the dialog open while saving, so a failed save is not lost', async () => {
    let fail!: (error: Error) => void;
    vi.mocked(coreApi.post).mockImplementation(
      (() =>
        new Promise((_, reject) => {
          fail = reject;
        })) as never,
    );
    const user = userEvent.setup();
    renderWithProviders(<TechnologiesPage />);
    await user.click(await screen.findByRole('button', { name: 'Add technology' }));
    await user.type(screen.getByLabelText('Name'), 'Vite');
    await user.type(screen.getByLabelText('Description'), 'A build tool.');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog', { name: 'New technology' })).toBeInTheDocument();
    fail(new Error('down'));
    expect(await screen.findByText('That did not save. Try again.')).toBeInTheDocument();
  });

  it('moves focus to the search field after a delete removes the row that held it', async () => {
    vi.mocked(coreApi.delete).mockImplementation((async () => {
      serve(technologyRows.slice(1));
      return saved;
    }) as never);
    const user = userEvent.setup();
    renderWithProviders(<TechnologiesPage />);
    await user.click(await screen.findByRole('button', { name: 'Delete React' }));
    await user.click(screen.getByRole('button', { name: 'Delete technology' }));
    await waitFor(() => expect(screen.getByLabelText('Search technologies')).toHaveFocus());
  });
});
