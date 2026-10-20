import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router-dom';
import { coreApi } from '@/lib/core-api';
import { allocationsEnvelope } from '@/test/fixtures/allocations';
import { peopleEnvelope } from '@/test/fixtures/people';
import { projectsEnvelope } from '@/test/fixtures/projects';
import { renderWithProviders } from '@/test/utils';
import { AllocationPage } from './allocation-page';

vi.mock('@/lib/core-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/core-api')>()),
  coreApi: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock('@/lib/format', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/format')>()),
  localToday: () => '2026-10-20',
}));

/** Shows the address's query string, so a test can see which tab the page put there. */
function Search() {
  return <code data-testid="search">{useLocation().search}</code>;
}

function renderAt(route: string) {
  return renderWithProviders(
    <>
      <Routes>
        <Route path="/resources/allocation" element={<AllocationPage />} />
      </Routes>
      <Search />
    </>,
    { route }
  );
}

beforeEach(() => {
  vi.mocked(coreApi.get).mockImplementation((async (path: string) => {
    if (path === '/people') return { data: peopleEnvelope() };
    if (path === '/projects') return { data: projectsEnvelope() };
    if (path === '/allocations') return { data: allocationsEnvelope() };
    throw new Error(`unexpected GET ${path}`);
  }) as never);
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('AllocationPage', () => {
  it('is titled Allocation, with a Board tab and a Ledger tab', async () => {
    renderAt('/resources/allocation');
    expect(screen.getByRole('heading', { level: 1, name: 'Allocation' })).toBeInTheDocument();
    const tabs = screen.getByRole('tablist', { name: 'Allocation sections' });
    expect(
      within(tabs)
        .getAllByRole('tab')
        .map((tab) => tab.textContent)
    ).toEqual(['Board', 'Ledger']);
    expect(await screen.findByRole('heading', { level: 2, name: 'Bench' })).toBeInTheDocument();
  });

  it('opens on the board at the bare address, and only the board is on the page', async () => {
    renderAt('/resources/allocation');
    expect(screen.getByRole('tab', { name: 'Board' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByRole('heading', { level: 2, name: 'Bench' })).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Allocation ledger' })).not.toBeInTheDocument();
    expect(screen.getByTestId('search')).toHaveTextContent('');
  });

  it('opens the ledger from ?tab=ledger, which is the whole ledger, and not the board', async () => {
    renderAt('/resources/allocation?tab=ledger');
    expect(screen.getByRole('tab', { name: 'Ledger' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByRole('table', { name: 'Allocation ledger' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Person' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: 'Bench' })).not.toBeInTheDocument();
  });

  it('opens the board for a tab it does not know', async () => {
    renderAt('/resources/allocation?tab=nope');
    expect(screen.getByRole('tab', { name: 'Board' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByRole('heading', { level: 2, name: 'Bench' })).toBeInTheDocument();
  });

  it('puts the chosen tab in the address, and the board back to the bare address', async () => {
    const user = userEvent.setup();
    renderAt('/resources/allocation');
    await user.click(screen.getByRole('tab', { name: 'Ledger' }));
    expect(screen.getByTestId('search')).toHaveTextContent('?tab=ledger');
    expect(await screen.findByRole('table', { name: 'Allocation ledger' })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Board' }));
    expect(screen.getByTestId('search')).toHaveTextContent('');
    expect(await screen.findByRole('heading', { level: 2, name: 'Bench' })).toBeInTheDocument();
  });
});
