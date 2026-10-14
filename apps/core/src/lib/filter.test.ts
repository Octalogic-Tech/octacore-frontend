import { filterBy } from './filter';

const rows = [
  { id: 1, name: 'Web', description: 'Websites and portals' },
  { id: 2, name: 'Mobile', description: 'Phone apps' },
];

describe('filterBy', () => {
  it('returns every row for a blank query', () => {
    expect(filterBy(rows, '', ['name'])).toEqual(rows);
    expect(filterBy(rows, '   ', ['name'])).toEqual(rows);
  });

  it('matches case-insensitively on any of the keys', () => {
    expect(filterBy(rows, 'PHONE', ['name', 'description'])).toEqual([rows[1]]);
    expect(filterBy(rows, 'web', ['name'])).toEqual([rows[0]]);
  });

  it('does not look at keys it was not given', () => {
    expect(filterBy(rows, 'phone', ['name'])).toEqual([]);
  });

  it('treats a missing value as empty text', () => {
    expect(filterBy([{ name: undefined }], 'x', ['name'])).toEqual([]);
  });
});
