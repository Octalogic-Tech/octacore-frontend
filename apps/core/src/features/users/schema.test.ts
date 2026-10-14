import { toCreateBody, toUpdateBody, userFormSchema } from './schema';

const valid = { name: 'Linus', email: 'linus@example.com', role: 'admin', password: 'a long enough password' } as const;

const messages = (result: ReturnType<ReturnType<typeof userFormSchema>['safeParse']>) =>
  result.success ? [] : result.error.issues.map((issue) => issue.message);

describe('userFormSchema', () => {
  it('accepts a complete new user and trims the name and the email', () => {
    const parsed = userFormSchema(false).parse({ ...valid, name: '  Linus ', email: ' linus@example.com ' });
    expect(parsed).toEqual(valid);
  });

  it('says what is missing', () => {
    expect(messages(userFormSchema(false).safeParse({ name: ' ', email: '', role: 'admin', password: '' }))).toEqual(
      expect.arrayContaining(['Name is required', 'Email is required', 'Use at least 10 characters']),
    );
  });

  it('rejects an email that is not an address', () => {
    expect(messages(userFormSchema(false).safeParse({ ...valid, email: 'nope' }))).toContain(
      'Enter a valid email address',
    );
  });

  it('rejects a role the service does not know', () => {
    expect(userFormSchema(false).safeParse({ ...valid, role: 'owner' }).success).toBe(false);
  });

  it('needs a password of 10 to 128 characters when adding', () => {
    expect(userFormSchema(false).safeParse({ ...valid, password: '123456789' }).success).toBe(false);
    expect(userFormSchema(false).safeParse({ ...valid, password: '1234567890' }).success).toBe(true);
    expect(userFormSchema(false).safeParse({ ...valid, password: 'x'.repeat(128) }).success).toBe(true);
    expect(userFormSchema(false).safeParse({ ...valid, password: 'x'.repeat(129) }).success).toBe(false);
  });

  it('leaves the password optional when editing, but still checks one that is given', () => {
    expect(userFormSchema(true).safeParse({ ...valid, password: '' }).success).toBe(true);
    expect(userFormSchema(true).safeParse({ ...valid, password: 'short' }).success).toBe(false);
    expect(userFormSchema(true).safeParse({ ...valid, password: '1234567890' }).success).toBe(true);
  });

  it('uses a password exactly as typed, spaces included', () => {
    expect(userFormSchema(false).parse({ ...valid, password: '  padded password  ' }).password).toBe('  padded password  ');
  });
});

describe('request bodies', () => {
  it('sends the four fields when adding', () => {
    expect(toCreateBody(valid)).toEqual(valid);
  });

  it('leaves the password out when editing without one', () => {
    expect(toUpdateBody({ ...valid, password: '' })).toEqual({ name: 'Linus', email: 'linus@example.com', role: 'admin' });
  });

  it('sends the new password when one was typed', () => {
    expect(toUpdateBody(valid)).toEqual(valid);
  });
});
