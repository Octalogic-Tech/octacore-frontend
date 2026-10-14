import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PageHeader } from './page-header';
import { QueryBoundary } from './query-boundary';
import { SearchField } from './search-field';
import { TablePager } from './table-pager';

describe('PageHeader', () => {
  it('has one h1 and its actions beside it', () => {
    render(
      <PageHeader title="Categories">
        <button type="button">Add</button>
      </PageHeader>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Categories' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
  });
});

describe('SearchField', () => {
  it('reports what is typed', async () => {
    const onChange = vi.fn();
    render(<SearchField id="s" label="Search items" value="" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText('Search items'), 'a');
    expect(onChange).toHaveBeenCalledWith('a');
  });
});

describe('QueryBoundary', () => {
  const base = { isLoading: false, isError: false, onRetry: vi.fn(), isEmpty: false, empty: <p>Nothing here</p> };

  it('shows a loading status first', () => {
    render(
      <QueryBoundary {...base} isLoading isError>
        <p>Rows</p>
      </QueryBoundary>,
    );
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
    expect(screen.queryByText('Rows')).not.toBeInTheDocument();
  });

  it('shows an error with a retry, never a blank panel', async () => {
    const onRetry = vi.fn();
    render(
      <QueryBoundary {...base} isError onRetry={onRetry}>
        <p>Rows</p>
      </QueryBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('We could not load this data');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows the empty state', () => {
    render(
      <QueryBoundary {...base} isEmpty>
        <p>Rows</p>
      </QueryBoundary>,
    );
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    expect(screen.queryByText('Rows')).not.toBeInTheDocument();
  });

  it('shows the children otherwise', () => {
    render(
      <QueryBoundary {...base}>
        <p>Rows</p>
      </QueryBoundary>,
    );
    expect(screen.getByText('Rows')).toBeInTheDocument();
  });
});

describe('TablePager', () => {
  const props = { page: 0, pageCount: 3, pageSize: 5, total: 12, onPageChange: vi.fn(), onPageSizeChange: vi.fn() };

  it('reports the visible range', () => {
    render(<TablePager {...props} />);
    expect(screen.getByText('1–5 of 12')).toBeInTheDocument();
  });

  it('cannot go before the first page', () => {
    render(<TablePager {...props} />);
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
  });

  it('cannot go past the last page and reports a short last range', () => {
    render(<TablePager {...props} page={2} />);
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(screen.getByText('11–12 of 12')).toBeInTheDocument();
  });

  it('reports 0–0 for an empty table', () => {
    render(<TablePager {...props} page={0} pageCount={1} total={0} />);
    expect(screen.getByText('0–0 of 0')).toBeInTheDocument();
  });

  it('changes page and page size', async () => {
    const onPageChange = vi.fn();
    const onPageSizeChange = vi.fn();
    render(<TablePager {...props} onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onPageChange).toHaveBeenCalledWith(1);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Rows per page' }), '10');
    expect(onPageSizeChange).toHaveBeenCalledWith(10);
  });
});
