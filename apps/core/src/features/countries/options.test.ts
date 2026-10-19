import { countryRows } from '@/test/fixtures/countries';
import { countryPickerOptions, dollarCountry } from './options';
import { countriesSchema } from './schema';

const countries = countriesSchema.parse(countryRows);
const labels = (options: { label: string }[]) => options.map((option) => option.label);

describe('countryPickerOptions', () => {
  it('offers the active countries, A to Z', () => {
    expect(labels(countryPickerOptions(countries))).toEqual(['Germany', 'India', 'Japan', 'United States']);
  });

  it('labels an option with its currency when asked', () => {
    expect(labels(countryPickerOptions(countries, { withCurrency: true }))).toEqual([
      'Germany · EUR',
      'India · INR',
      'Japan · JPY',
      'United States · USD',
    ]);
  });

  it('leaves out a country with no rate when a rate is needed', () => {
    expect(labels(countryPickerOptions(countries, { needsRate: true }))).toEqual(['Germany', 'India', 'United States']);
  });

  it('adds the record’s own country even when it is switched off', () => {
    const options = countryPickerOptions(countries, { current: { id: 225, name: 'United Kingdom' } });
    expect(labels(options)).toEqual(['Germany', 'India', 'Japan', 'United Kingdom', 'United States']);
  });

  it('adds the record’s own country even when it has no rate to give', () => {
    const options = countryPickerOptions(countries, { needsRate: true, current: { id: 107, name: 'Japan' } });
    expect(labels(options)).toEqual(['Germany', 'India', 'Japan', 'United States']);
  });

  it('keeps the record’s own country while the list is still loading', () => {
    const options = countryPickerOptions([], {
      withCurrency: true,
      current: { id: 99, name: 'India', currencyCode: 'INR' },
    });
    expect(options).toEqual([{ id: 99, label: 'India · INR' }]);
  });

  it('does not list the record’s own country twice', () => {
    const options = countryPickerOptions(countries, { current: { id: 99, name: 'India' } });
    expect(options.filter((option) => option.id === 99)).toHaveLength(1);
  });
});

describe('dollarCountry', () => {
  it('prefers the United States', () => {
    expect(dollarCountry(countries)?.iso).toBe('US');
  });

  it('skips an inactive country that uses dollars', () => {
    expect(dollarCountry(countries.filter((country) => country.iso !== 'US'))).toBeUndefined();
  });

  it('falls back to the first active country that uses dollars', () => {
    const ecuador = { ...countries[0], id: 60, iso: 'EC', nicename: 'Ecuador', currencyCode: 'USD', rate: 1, active: true };
    const withoutUs = countries.filter((country) => country.iso !== 'US');
    expect(dollarCountry([...withoutUs, ecuador])?.iso).toBe('EC');
  });

  it('is undefined while the list is empty', () => {
    expect(dollarCountry([])).toBeUndefined();
  });
});
