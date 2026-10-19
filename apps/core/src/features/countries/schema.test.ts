import { countryRows } from '@/test/fixtures/countries';
import {
  countriesSchema,
  countryFormSchema,
  countrySchema,
  rateProblem,
  syncResultSchema,
  taxRateProblem,
  toCountryBody,
  toCountryFormValues,
  type CountryFormValues,
} from './schema';

const row = {
  id: 99,
  iso: 'IN',
  iso3: 'IND',
  nicename: 'India',
  numcode: 356,
  phonecode: 91,
  currencyCode: 'INR',
  currencyName: 'Indian rupee',
  currencySymbol: '₹',
  rate: 88.25,
  taxRate: 18,
  active: true,
};

describe('countrySchema', () => {
  it('reads the currency, a nullable rate, the tax rate and the active flag', () => {
    expect(countrySchema.parse(row)).toEqual(row);
    expect(countrySchema.parse({ ...row, rate: null }).rate).toBeNull();
  });

  it('treats the legacy text NULL as no ISO3 code', () => {
    expect(countrySchema.parse({ ...row, iso3: 'NULL' }).iso3).toBe('');
    expect(countrySchema.parse({ ...row, iso3: ' null ' }).iso3).toBe('');
  });

  it('keeps a real ISO3 code, and the empty one the service sends for none', () => {
    expect(countrySchema.parse({ ...row, iso3: 'GBR' }).iso3).toBe('GBR');
    expect(countrySchema.parse({ ...row, iso3: '' }).iso3).toBe('');
  });

  it('drops the fields the page does not use', () => {
    const parsed = countrySchema.parse({
      ...row,
      name: 'INDIA',
      status: 1,
      createdDate: 'x',
      deletedDate: null,
    });
    expect(Object.keys(parsed).sort()).toEqual(Object.keys(row).sort());
  });

  it.each([
    'currencyCode',
    'currencyName',
    'currencySymbol',
    'rate',
    'taxRate',
    'active',
  ])(
    'refuses a row that lacks %s, as the service before this change sent it',
    (field) => {
      expect(
        countrySchema.safeParse({ ...row, [field]: undefined }).success
      ).toBe(false);
    }
  );

  it('refuses a rate sent as text and an active flag sent as a number', () => {
    expect(countrySchema.safeParse({ ...row, rate: '88.25' }).success).toBe(
      false
    );
    expect(countrySchema.safeParse({ ...row, active: 1 }).success).toBe(false);
  });

  it('reads every fixture row', () => {
    expect(countriesSchema.parse(countryRows)).toHaveLength(countryRows.length);
  });
});

describe('syncResultSchema', () => {
  it('reads the answer of a sync', () => {
    const body = {
      date: '2026-10-19',
      updatedCountries: 31,
      updatedCurrencies: ['EUR', 'INR'],
      missingCurrencies: ['ZWG'],
    };
    expect(syncResultSchema.parse(body)).toEqual(body);
  });

  it('refuses an answer without its counts', () => {
    expect(syncResultSchema.safeParse({ date: '2026-10-19' }).success).toBe(
      false
    );
  });
});

describe('rateProblem', () => {
  it.each(['88.25', '1', '0.000001', '1000000', ' 88.25 ', '0.92'])(
    'accepts %j',
    (text) => {
      expect(rateProblem(text)).toBeNull();
    }
  );

  it('asks for a rate when there is none', () => {
    expect(rateProblem('')).toBe('Enter a rate');
  });

  it.each(['1,5', '88.2512345', '-1', '1e3', 'lots', '.5', '8.', '٣'])(
    'explains how to type %j',
    (text) => {
      expect(rateProblem(text)).toBe(
        'Enter a rate like 88.25, with no commas and at most six decimals'
      );
    }
  );

  it('refuses zero and anything over a million', () => {
    expect(rateProblem('0')).toBe('The rate must be more than zero');
    expect(rateProblem('0.000000')).toBe('The rate must be more than zero');
    expect(rateProblem('1000000.01')).toBe('The rate is too large');
    expect(rateProblem('9999999')).toBe('The rate is too large');
  });
});

describe('taxRateProblem', () => {
  it.each(['0', '18', '7.5', '7.25', '100', '100.00', ' 20 '])(
    'accepts %j',
    (text) => {
      expect(taxRateProblem(text)).toBeNull();
    }
  );

  it('asks for a tax rate when there is none', () => {
    expect(taxRateProblem('')).toBe('Enter a tax rate, or 0 for none');
  });

  it.each(['1,5', '7.255', '-1', '1e1', 'lots', '.5', '18%', '1000'])(
    'explains how to type %j',
    (text) => {
      expect(taxRateProblem(text)).toBe(
        'Enter a tax rate like 18 or 7.25, with no commas and at most two decimals'
      );
    }
  );

  it('refuses more than 100', () => {
    expect(taxRateProblem('100.01')).toBe(
      'The tax rate cannot be more than 100'
    );
    expect(taxRateProblem('101')).toBe('The tax rate cannot be more than 100');
  });
});

const valid: CountryFormValues = {
  nicename: 'India',
  iso: 'IN',
  iso3: 'IND',
  numcode: '356',
  phonecode: '91',
  currencyCode: 'INR',
  currencyName: 'Indian rupee',
  currencySymbol: '₹',
  rate: '88.25',
  taxRate: '18',
  active: true,
};

function issueFor(
  values: CountryFormValues,
  field: string
): string | undefined {
  const result = countryFormSchema.safeParse(values);
  const issues = result.success ? [] : result.error.issues;
  return issues.find((issue) => issue.path[0] === field)?.message;
}

describe('the country form', () => {
  it('accepts a complete form', () => {
    expect(countryFormSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts a country with no ISO3 code, no numeric code, no calling code and no rate yet', () => {
    const bare = { ...valid, iso3: '', numcode: '', phonecode: '', rate: '' };
    expect(countryFormSchema.safeParse(bare).success).toBe(true);
  });

  it.each([
    ['nicename', { nicename: '  ' }, 'Name is required'],
    ['iso', { iso: 'in' }, 'Two capital letters, like IN'],
    ['iso', { iso: 'IND' }, 'Two capital letters, like IN'],
    [
      'iso3',
      { iso3: 'IN' },
      'Three capital letters, like IND, or leave it empty',
    ],
    [
      'numcode',
      { numcode: '1000' },
      'The numeric code must be a whole number from 0 to 999',
    ],
    [
      'numcode',
      { numcode: 'x' },
      'The numeric code must be a whole number from 0 to 999',
    ],
    [
      'phonecode',
      { phonecode: '10000' },
      'The calling code must be a whole number from 0 to 9999',
    ],
    [
      'phonecode',
      { phonecode: '+91' },
      'The calling code must be a whole number from 0 to 9999',
    ],
    [
      'currencyCode',
      { currencyCode: 'inr' },
      'Three capital letters, like EUR',
    ],
    ['currencyCode', { currencyCode: 'IN' }, 'Three capital letters, like EUR'],
    ['currencyName', { currencyName: '' }, 'Currency name is required'],
    ['currencySymbol', { currencySymbol: '' }, 'Symbol is required'],
    ['currencySymbol', { currencySymbol: '€€€€€' }, 'Up to four characters'],
    [
      'rate',
      { rate: '1,5' },
      'Enter a rate like 88.25, with no commas and at most six decimals',
    ],
    ['rate', { rate: '0' }, 'The rate must be more than zero'],
    ['rate', { rate: '1000001' }, 'The rate is too large'],
    ['taxRate', { taxRate: '' }, 'Enter a tax rate, or 0 for none'],
    ['taxRate', { taxRate: '100.5' }, 'The tax rate cannot be more than 100'],
  ])('refuses a bad %s', (field, override, message) => {
    expect(issueFor({ ...valid, ...override }, field)).toBe(message);
  });

  it('does not check the rate of a US dollar country: it is always 1', () => {
    expect(
      issueFor({ ...valid, currencyCode: 'USD', rate: 'garbage' }, 'rate')
    ).toBeUndefined();
  });
});

describe('toCountryFormValues', () => {
  it('starts a new country empty, with a tax rate of 0 and switched off', () => {
    expect(toCountryFormValues(undefined)).toMatchObject({
      nicename: '',
      rate: '',
      taxRate: '0',
      active: false,
    });
  });

  it('turns a country into text, a missing code or rate into an empty field', () => {
    expect(toCountryFormValues(countrySchema.parse(row))).toEqual(valid);
    const bare = countrySchema.parse({
      ...row,
      iso3: '',
      numcode: 0,
      phonecode: 0,
      rate: null,
      taxRate: 7.5,
      active: false,
    });
    expect(toCountryFormValues(bare)).toMatchObject({
      iso3: '',
      numcode: '',
      phonecode: '',
      rate: '',
      taxRate: '7.5',
      active: false,
    });
  });
});

describe('toCountryBody', () => {
  it('sends numbers as numbers', () => {
    expect(toCountryBody(valid)).toEqual({
      iso: 'IN',
      nicename: 'India',
      iso3: 'IND',
      numcode: 356,
      phonecode: 91,
      currencyCode: 'INR',
      currencyName: 'Indian rupee',
      currencySymbol: '₹',
      rate: 88.25,
      taxRate: 18,
      active: true,
    });
  });

  it('sends an empty rate as null, which clears it, and an empty code as 0', () => {
    expect(
      toCountryBody({
        ...valid,
        rate: ' ',
        numcode: '',
        phonecode: '',
        iso3: '',
      })
    ).toMatchObject({
      rate: null,
      numcode: 0,
      phonecode: 0,
      iso3: '',
    });
  });

  it('sends a US dollar country with rate 1, whatever the field holds', () => {
    expect(
      toCountryBody({ ...valid, currencyCode: 'USD', rate: '' }).rate
    ).toBe(1);
    expect(
      toCountryBody({ ...valid, currencyCode: 'USD', rate: '5' }).rate
    ).toBe(1);
  });

  it('trims what was typed', () => {
    expect(
      toCountryBody({
        ...valid,
        nicename: ' India ',
        currencyName: ' Indian rupee ',
      })
    ).toMatchObject({
      nicename: 'India',
      currencyName: 'Indian rupee',
    });
  });

  describe('on an edit', () => {
    // A sync can set a newer rate than the one this form was filled with, so an unchanged rate is not sent back.
    it('leaves the rate out when neither the rate nor the currency changed', () => {
      const body = toCountryBody({ ...valid, taxRate: '7.5' }, valid);

      expect(body).not.toHaveProperty('rate');
      expect(body).toMatchObject({
        taxRate: 7.5,
        currencyCode: 'INR',
        active: true,
      });
    });

    it('sends the rate once it is typed, or emptied to clear it', () => {
      expect(toCountryBody({ ...valid, rate: '90' }, valid).rate).toBe(90);
      expect(toCountryBody({ ...valid, rate: '' }, valid).rate).toBeNull();
    });

    it('sends the rate when the currency changes, so the service is told what the new currency is worth', () => {
      expect(
        toCountryBody({ ...valid, currencyCode: 'EUR', rate: '0.9' }, valid)
          .rate
      ).toBe(0.9);
      expect(
        toCountryBody({ ...valid, currencyCode: 'EUR', rate: '' }, valid).rate
      ).toBeNull();
      expect(
        toCountryBody({ ...valid, currencyCode: 'USD', rate: '1' }, valid).rate
      ).toBe(1);
    });

    it('still sends every other field, so the body stays a whole country', () => {
      expect(Object.keys(toCountryBody(valid, valid)).sort()).toEqual(
        [
          'active',
          'currencyCode',
          'currencyName',
          'currencySymbol',
          'iso',
          'iso3',
          'nicename',
          'numcode',
          'phonecode',
          'taxRate',
        ].sort()
      );
    });

    it('treats a rate typed as the same number in other words as unchanged', () => {
      expect(
        toCountryBody({ ...valid, rate: ' 88.25 ' }, valid)
      ).not.toHaveProperty('rate');
    });
  });
});
