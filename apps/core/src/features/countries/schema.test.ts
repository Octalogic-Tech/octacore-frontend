import { countrySchema } from './schema';

const row = { id: 8, iso: 'AQ', iso3: 'NULL', nicename: 'Antarctica', numcode: 0, phonecode: 0 };

describe('countrySchema', () => {
  it('treats the legacy text NULL as no ISO3 code', () => {
    expect(countrySchema.parse(row).iso3).toBe('');
    expect(countrySchema.parse({ ...row, iso3: ' null ' }).iso3).toBe('');
  });

  it('keeps a real ISO3 code as it is', () => {
    expect(countrySchema.parse({ ...row, iso3: 'GBR' }).iso3).toBe('GBR');
  });

  it('drops the fields the page does not use', () => {
    const parsed = countrySchema.parse({ ...row, name: 'ANTARCTICA', status: 1, createdDate: 'x', deletedDate: null });
    expect(Object.keys(parsed).sort()).toEqual(['id', 'iso', 'iso3', 'nicename', 'numcode', 'phonecode']);
  });
});
