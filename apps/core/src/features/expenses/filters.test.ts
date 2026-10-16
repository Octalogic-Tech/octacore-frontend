import { defaultFilters, isDefaultFilters, isRangeInverted, stripQuery, toQuery } from './filters';

const TODAY = '2026-10-16';

describe('the default filters', () => {
  it('are the current calendar year, for every type and project and source', () => {
    expect(defaultFilters(TODAY)).toEqual({
      expenseTypeId: null,
      projectId: null,
      from: '2026-01-01',
      to: '2026-12-31',
      source: 'all',
      q: '',
    });
  });

  it('are recognised, and any change is not', () => {
    expect(isDefaultFilters(defaultFilters(TODAY), TODAY)).toBe(true);
    expect(isDefaultFilters({ ...defaultFilters(TODAY), q: 'a' }, TODAY)).toBe(false);
    expect(isDefaultFilters({ ...defaultFilters(TODAY), from: '' }, TODAY)).toBe(false);
  });
});

describe('toQuery', () => {
  it('sends only the dates for the default filters', () => {
    expect(toQuery(defaultFilters(TODAY))).toEqual({ from: '2026-01-01', to: '2026-12-31' });
  });

  it('sends each filter that is set', () => {
    expect(
      toQuery({ expenseTypeId: 2, projectId: 1, from: '2026-09-01', to: '2026-09-30', source: 'recurring', q: ' fig ' }),
    ).toEqual({ expenseTypeId: 2, projectId: 1, from: '2026-09-01', to: '2026-09-30', recurring: true, q: 'fig' });
  });

  it('asks for one-time expenses with recurring false, and leaves a blank search and dates out', () => {
    expect(
      toQuery({ expenseTypeId: null, projectId: null, from: '', to: '', source: 'one-time', q: '   ' }),
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

describe('stripQuery', () => {
  it('runs from the start of last year to today, whatever the ledger shows', () => {
    expect(stripQuery(TODAY)).toEqual({ from: '2025-01-01', to: '2026-10-16' });
  });
});
