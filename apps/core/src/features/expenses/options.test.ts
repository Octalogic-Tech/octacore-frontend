import { withCurrent } from './options';

describe('withCurrent', () => {
  const options = [
    { id: 1, label: 'One' },
    { id: 2, label: 'Two' },
  ];

  it('adds the record’s own choice when the list lacks it', () => {
    expect(withCurrent(options, { id: 9, label: 'Nine' })).toEqual([...options, { id: 9, label: 'Nine' }]);
  });

  it('leaves the list alone when it has the choice, or there is none', () => {
    expect(withCurrent(options, { id: 2, label: 'Two' })).toBe(options);
    expect(withCurrent(options, undefined)).toBe(options);
  });
});
