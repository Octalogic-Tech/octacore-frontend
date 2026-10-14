import { cn } from './utils';

describe('cn', () => {
  it('keeps a font-size token next to a colour', () => {
    expect(cn('text-lead text-navy')).toBe('text-lead text-navy');
  });

  it('lets the later font-size token win', () => {
    expect(cn('text-lead', 'text-small')).toBe('text-small');
  });

  it('drops falsy values', () => {
    expect(cn('a', false && 'b', undefined, 'c')).toBe('a c');
  });
});
