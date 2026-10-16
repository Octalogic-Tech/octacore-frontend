import { personRows } from '@/test/fixtures/people';
import {
  emptyPersonForm,
  personFormSchema,
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

const [ada, grace, linus] = personRowsSchema.parse(personRows);

describe('row schema', () => {
  it('keeps the person and the salary in whole dollars', () => {
    expect(ada).toMatchObject({
      id: 1,
      name: 'Ada Lovelace',
      joinDate: '2024-01-15',
      leaveDate: '',
      email: 'ada@example.com',
      phone: '+44 20 7946 0000',
      imageLink: 'https://example.com/ada.png',
      contractLink: 'https://example.com/ada-contract.pdf',
      monthlySalary: 5600,
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
      monthlySalary: null,
    });
  });

  it.each([
    ['a name', { ...personRows[0], name: undefined }],
    ['an id', { ...personRows[0], id: undefined }],
    ['the salary field', { ...personRows[0], monthlySalary: undefined }],
    ['a salary that is not a number', { ...personRows[0], monthlySalary: '5600' }],
    ['a salary with cents', { ...personRows[0], monthlySalary: 5600.5 }],
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

  it.each(['0', '5600', '2147483647'])('accepts a monthly salary of %s whole dollars', (salary) => {
    expect(messages(form({ monthlySalary: salary }))).toEqual([]);
  });

  it('does not need a salary', () => {
    expect(messages(form({ monthlySalary: '' }))).toEqual([]);
    expect(messages(form({ monthlySalary: '   ' }))).toEqual([]);
  });

  it.each(['5,600', '$5600', '5600.50', '-5', '56 00', 'lots', '1e3'])(
    'says what is wrong with a salary typed as “%s”, instead of dropping the odd character',
    (salary) => {
      expect(messages(form({ monthlySalary: salary }))).toEqual(['Enter a whole number, like 5600']);
    },
  );

  it('refuses a salary the service cannot store', () => {
    expect(messages(form({ monthlySalary: '2147483648' }))).toEqual(['Salary is too large']);
  });
});

describe('toFormValues', () => {
  it('opens a new person empty', () => {
    expect(toFormValues()).toEqual(emptyPersonForm);
  });

  it('writes every field as text, the salary included', () => {
    expect(toFormValues(ada)).toEqual({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      phone: '+44 20 7946 0000',
      joinDate: '2024-01-15',
      leaveDate: '',
      imageLink: 'https://example.com/ada.png',
      contractLink: 'https://example.com/ada-contract.pdf',
      monthlySalary: '5600',
    });
  });

  it('opens a person without a salary on an empty salary, and a salary of zero on 0', () => {
    expect(toFormValues(linus).monthlySalary).toBe('');
    expect(toFormValues({ ...linus, monthlySalary: 0 }).monthlySalary).toBe('0');
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
      monthlySalary: null,
    });
  });

  it('sends the salary as a number of dollars', () => {
    expect(toPersonBody(form({ monthlySalary: '5600' })).monthlySalary).toBe(5600);
    expect(toPersonBody(form({ monthlySalary: '0' })).monthlySalary).toBe(0);
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
      monthlySalary: 7250,
    });
  });
});
