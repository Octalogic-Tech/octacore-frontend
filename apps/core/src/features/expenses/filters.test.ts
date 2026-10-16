import {
  NO_OVERVIEW_FILTERS,
  defaultOneTimeFilters,
  hasOverviewFilters,
  isDefaultOneTimeFilters,
  isRangeInverted,
  toOneTimeQuery,
  toOverviewQuery,
} from './filters';

const TODAY = '2026-10-16';

describe('the One-time tab’s default filters', () => {
  it('are the current calendar year, for every type, project and person', () => {
    expect(defaultOneTimeFilters(TODAY)).toEqual({
      expenseTypeId: null,
      projectId: null,
      personId: null,
      from: '2026-01-01',
      to: '2026-12-31',
      q: '',
    });
  });

  it('are recognised, and any change is not', () => {
    expect(isDefaultOneTimeFilters(defaultOneTimeFilters(TODAY), TODAY)).toBe(true);
    expect(isDefaultOneTimeFilters({ ...defaultOneTimeFilters(TODAY), q: 'a' }, TODAY)).toBe(false);
    expect(isDefaultOneTimeFilters({ ...defaultOneTimeFilters(TODAY), personId: 1 }, TODAY)).toBe(false);
    expect(isDefaultOneTimeFilters({ ...defaultOneTimeFilters(TODAY), from: '' }, TODAY)).toBe(false);
  });
});

describe('toOneTimeQuery', () => {
  it('asks only for one-time expenses, with the dates, for the default filters', () => {
    expect(toOneTimeQuery(defaultOneTimeFilters(TODAY))).toEqual({
      from: '2026-01-01',
      to: '2026-12-31',
      recurring: false,
    });
  });

  it('sends each filter that is set', () => {
    expect(
      toOneTimeQuery({
        expenseTypeId: 2,
        projectId: 1,
        personId: 3,
        from: '2026-09-01',
        to: '2026-09-30',
        q: ' fig ',
      }),
    ).toEqual({
      expenseTypeId: 2,
      projectId: 1,
      personId: 3,
      from: '2026-09-01',
      to: '2026-09-30',
      recurring: false,
      q: 'fig',
    });
  });

  it('leaves blank dates and a search of only spaces out, and still asks for one-time only', () => {
    expect(
      toOneTimeQuery({ expenseTypeId: null, projectId: null, personId: null, from: '', to: '', q: '   ' }),
    ).toEqual({ recurring: false });
  });
});

describe('isRangeInverted', () => {
  it('is true only when both dates are set and the start is after the end', () => {
    expect(isRangeInverted({ from: '2026-12-31', to: '2026-01-01' })).toBe(true);
    expect(isRangeInverted({ from: '2026-01-01', to: '2026-12-31' })).toBe(false);
    expect(isRangeInverted({ from: '', to: '2026-01-01' })).toBe(false);
    expect(isRangeInverted({ from: '2026-01-01', to: '2026-01-01' })).toBe(false);
  });
});

describe('the Overview tab’s query', () => {
  it('is the whole month, one-time and recurring together, with no other filter', () => {
    expect(toOverviewQuery('2026-10', NO_OVERVIEW_FILTERS)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(toOverviewQuery('2028-02', NO_OVERVIEW_FILTERS)).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });

  it('adds each filter that is set', () => {
    expect(toOverviewQuery('2026-10', { expenseTypeId: 2, projectId: 1, personId: 3 })).toEqual({
      from: '2026-10-01',
      to: '2026-10-31',
      expenseTypeId: 2,
      projectId: 1,
      personId: 3,
    });
  });

  it('says whether any filter is set', () => {
    expect(hasOverviewFilters(NO_OVERVIEW_FILTERS)).toBe(false);
    expect(hasOverviewFilters({ ...NO_OVERVIEW_FILTERS, personId: 3 })).toBe(true);
  });
});
