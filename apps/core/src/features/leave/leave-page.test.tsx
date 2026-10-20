import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { coreApi } from '@/lib/core-api';
import { leaveRows, leavesEnvelope } from '@/test/fixtures/leaves';
import { peopleEnvelope } from '@/test/fixtures/people';
import { renderWithProviders } from '@/test/utils';
import { LeavePage } from './leave-page';

vi.mock('@/lib/core-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/core-api')>()),
  coreApi: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

beforeEach(() => {
  vi.mocked(coreApi.get).mockImplementation((async (path: string) => {
    if (path === '/leaves') return { data: leavesEnvelope() };
    if (path === '/people') return { data: peopleEnvelope() };
    throw new Error(`unexpected GET ${path}`);
  }) as never);
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('LeavePage', () => {
  it('is titled Leave, and lists every leave of everyone', async () => {
    renderWithProviders(<LeavePage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Leave' })).toBeInTheDocument();
    const table = await screen.findByRole('table', { name: 'Leave' });
    expect(within(table).getAllByRole('row')).toHaveLength(leaveRows.length + 1);
    expect(screen.getByRole('columnheader', { name: 'Person' })).toBeInTheDocument();
    expect(coreApi.get).toHaveBeenCalledWith('/leaves', { params: undefined });
  });

  it('has a search and an Add leave button', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LeavePage />);
    expect(await screen.findByLabelText('Search leave')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add leave' }));
    expect(screen.getByRole('dialog', { name: 'New leave' })).toBeInTheDocument();
  });
});
