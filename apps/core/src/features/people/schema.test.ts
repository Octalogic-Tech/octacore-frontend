import { MAX_CENTS } from '@/lib/money';
import { personRows } from '@/test/fixtures/people';
import {
  emptyPersonForm,
  personFormSchema,
  personMatches,
  personRowsSchema,
  toFormValues,
  toPersonBody,
  type PersonFormValues,
} from './schema';

const form = (over: Partial<PersonFormValues> = {}): PersonFormValues => ({ ...emptyPersonForm, name: 'Ada', ...over });

const messages = (values: PersonFormValues) => {
  const result = personFormSchema.safeParse(values);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

const WRONG_FORMAT = 'Enter an amount like 7.20, with no commas or signs';

const [ada, grace, linus] = personRowsSchema.parse(personRows);

describe('row schema', () => {
  it('keeps the person, the salary in whole paise and the technologies by name', () => {
    expect(ada).toMatchObject({
      id: 1,
      name: 'Ada Lovelace',
      joinDate: '2024-01-15',
      leaveDate: '',
      email: 'ada@example.com',
      phone: '+44 20 7946 0000',
      imageLink: 'https://example.com/ada.png',
      contractLink: 'https://example.com/ada-contract.pdf',
      monthlySalaryPaise: 8_500_000,
      technologies: [
        { id: 2, name: 'Nest' },
        { id: 1, name: 'React' },
      ],
    });
    expect(ada).not.toHaveProperty('status');
    expect(ada).not.toHaveProperty('createdDate');
  });

  it('turns every optional text that is null into empty text, and leaves a missing salary null', () => {
    expect(linus).toEqual({
      id: 3,
      name: 'Linus Torvalds',
      joinDate: '',
      leaveDate: '',
      email: '',
      phone: '',
      imageLink: '',
      contractLink: '',
      monthlySalaryPaise: null,
      technologies: [],
    });
  });

  it.each([
    ['a name', { ...personRows[0], name: undefined }],
    ['an id', { ...personRows[0], id: undefined }],
    ['the salary field', { ...personRows[0], monthlySalaryPaise: undefined }],
    ['a salary that is not a number', { ...personRows[0], monthlySalaryPaise: '8500000' }],
    ['a salary that is not a whole number of paise', { ...personRows[0], monthlySalaryPaise: 8_500_000.5 }],
    ['the technologies missing', { ...personRows[0], technologies: undefined }],
    ['a technology with no name', { ...personRows[0], technologies: [{ id: 1 }] }],
  ])('rejects a person row with %s', (_label, row) => {
    expect(personRowsSchema.safeParse([row]).success).toBe(false);
  });
});

describe('personFormSchema', () => {
  it('needs a name', () => {
    expect(messages(form({ name: '' }))).toEqual(['Name is required']);
    expect(messages(form({ name: '   ' }))).toEqual(['Name is required']);
  });

  it('accepts a person with only a name', () => {
    expect(messages(form())).toEqual([]);
  });

  it('accepts a valid email and refuses a bad one', () => {
    expect(messages(form({ email: 'ada@example.com' }))).toEqual([]);
    expect(messages(form({ email: 'not-an-email' }))).toEqual(['Enter a valid email address']);
  });

  it.each(['0', '0.00', '85000', '85000.5', '85000.75', '100000000', '100000000.00'])(
    'accepts a monthly salary of %s rupees',
    (salary) => {
      expect(messages(form({ monthlySalary: salary }))).toEqual([]);
    },
  );

  it('does not need a salary', () => {
    expect(messages(form({ monthlySalary: '' }))).toEqual([]);
    expect(messages(form({ monthlySalary: '   ' }))).toEqual([]);
  });

  it.each(['85,000', '₹85000', '$85000', '85000.755', '-5', '85 000', 'lots', '1e3', '.5', '5.'])(
    'says what is wrong with a salary typed as “%s”, instead of dropping the odd character',
    (salary) => {
      expect(messages(form({ monthlySalary: salary }))).toEqual([WRONG_FORMAT]);
    },
  );

  it('refuses a salary the service cannot store', () => {
    expect(messages(form({ monthlySalary: '100000000.01' }))).toEqual(['The amount is too large']);
  });
});

describe('toFormValues', () => {
  it('opens a new person empty', () => {
    expect(toFormValues()).toEqual(emptyPersonForm);
    expect(emptyPersonForm.technologyIds).toEqual([]);
  });

  it('writes every field as text, the salary and the ticked technologies included', () => {
    expect(toFormValues(ada)).toEqual({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      phone: '+44 20 7946 0000',
      joinDate: '2024-01-15',
      leaveDate: '',
      imageLink: 'https://example.com/ada.png',
      contractLink: 'https://example.com/ada-contract.pdf',
      monthlySalary: '85000.00',
      technologyIds: ['2', '1'],
    });
  });

  it('opens a person without a salary on an empty salary, and a salary of zero on 0.00', () => {
    expect(toFormValues(linus).monthlySalary).toBe('');
    expect(toFormValues({ ...linus, monthlySalaryPaise: 0 }).monthlySalary).toBe('0.00');
  });

  it('writes a salary to the paisa', () => {
    expect(toFormValues({ ...linus, monthlySalaryPaise: 8_500_075 }).monthlySalary).toBe('85000.75');
  });

  it.each([0, 1, 5, 1250, 15000, 8_500_075, MAX_CENTS])(
    'sends a saved salary of %i paise back as the same paise, so saving it unchanged cannot drift',
    (paise) => {
      const values = toFormValues({ ...ada, monthlySalaryPaise: paise });

      expect(messages(values)).toEqual([]);
      expect(toPersonBody(values).monthlySalaryPaise).toBe(paise);
    },
  );

  it('opens a person who knows nothing with no technology ticked', () => {
    expect(toFormValues(linus).technologyIds).toEqual([]);
  });

  it('keeps no salary as none: empty and back to null', () => {
    const values = toFormValues(linus);

    expect(values.monthlySalary).toBe('');
    expect(messages(values)).toEqual([]);
    expect(toPersonBody(values).monthlySalaryPaise).toBeNull();
  });
});

describe('toPersonBody', () => {
  it('sends every empty optional field as null, so a PATCH clears it', () => {
    expect(toPersonBody(form())).toEqual({
      name: 'Ada',
      email: null,
      phone: null,
      joinDate: null,
      leaveDate: null,
      imageLink: null,
      contractLink: null,
      monthlySalaryPaise: null,
      technologyIds: [],
    });
  });

  it('sends the salary as a number of paise', () => {
    expect(toPersonBody(form({ monthlySalary: '85000' })).monthlySalaryPaise).toBe(8_500_000);
    expect(toPersonBody(form({ monthlySalary: '85000.75' })).monthlySalaryPaise).toBe(8_500_075);
    expect(toPersonBody(form({ monthlySalary: '0' })).monthlySalaryPaise).toBe(0);
  });

  it('sends the ticked technologies as ids, in the order they were ticked, and an empty list to clear them', () => {
    expect(toPersonBody(form({ technologyIds: ['3', '1'] })).technologyIds).toEqual([3, 1]);
    expect(toPersonBody(form({ technologyIds: [] })).technologyIds).toEqual([]);
  });

  it('sends the filled fields as typed', () => {
    expect(toPersonBody(toFormValues(grace))).toEqual({
      name: 'Grace Hopper',
      email: null,
      phone: '+1 202 555 0100',
      joinDate: '2023-03-01',
      leaveDate: '2025-06-30',
      imageLink: null,
      contractLink: null,
      monthlySalaryPaise: 9_250_000,
      technologyIds: [3],
    });
  });
});

describe('personMatches', () => {
  it('finds a person by a technology they know, whatever the case', () => {
    expect(personMatches(ada, 'react')).toBe(true);
    expect(personMatches(ada, 'NEST')).toBe(true);
    expect(personMatches(grace, 'react')).toBe(false);
    expect(personMatches(grace, 'express')).toBe(true);
  });

  it('finds a person by the start of a technology name, or by a middle part of it', () => {
    expect(personMatches(ada, 'rea')).toBe(true);
    expect(personMatches(ada, 'eact')).toBe(true);
  });

  it('finds a person by name, email and phone', () => {
    expect(personMatches(ada, 'ada')).toBe(true);
    expect(personMatches(ada, 'ada@example')).toBe(true);
    expect(personMatches(grace, '202 555')).toBe(true);
    expect(personMatches(grace, 'ada')).toBe(false);
  });

  it('finds nobody for text that is nowhere on them', () => {
    expect(personMatches(ada, 'zzz')).toBe(false);
    expect(personMatches(linus, 'react')).toBe(false);
  });

  it('matches everyone for a blank query', () => {
    expect(personMatches(ada, '')).toBe(true);
    expect(personMatches(linus, '  ')).toBe(true);
  });

  it('does not search the salary, the dates or the links', () => {
    expect(personMatches(ada, '85000')).toBe(false);
    expect(personMatches(ada, '2024')).toBe(false);
    expect(personMatches(ada, 'contract')).toBe(false);
  });
});
