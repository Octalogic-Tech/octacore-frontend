import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import { coreApi } from '@/lib/core-api';
import { emailDraftBody, emailDraftEnvelope } from '@/test/fixtures/projects';
import { renderWithProviders } from '@/test/utils';
import { InvoiceEmailDialog } from './invoice-email-dialog';

vi.mock('@/lib/core-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/core-api')>()),
  coreApi: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const invoice = { id: 1, number: 'INV-001' };
const sentReply = { data: { statusCode: 200, message: 'sent', data: { sentTo: [] }, meta: null } };

const failure = (status: number, message?: string) =>
  new AxiosError('failed', 'ERR_BAD_REQUEST', undefined, null, {
    status,
    data: { statusCode: status, message: message ?? 'x', data: null },
    statusText: String(status),
    headers: {},
    config: {} as never,
  });

function renderDialog() {
  const onSent = vi.fn();
  const onOpenChange = vi.fn();
  renderWithProviders(<InvoiceEmailDialog open onOpenChange={onOpenChange} invoice={invoice} onSent={onSent} />);
  return { onSent, onOpenChange };
}

beforeEach(() => {
  vi.mocked(coreApi.get).mockImplementation((async () => ({ data: emailDraftEnvelope() })) as never);
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('InvoiceEmailDialog: the draft', () => {
  it('opens on the draft: the contact, the subject and the message, all editable', async () => {
    renderDialog();

    expect(screen.getByRole('dialog', { name: 'Email INV-001' })).toBeInTheDocument();
    expect(await screen.findByLabelText('To')).toHaveValue('michael@example.com');
    expect(screen.getByLabelText('Subject')).toHaveValue('Invoice INV-001 from Test Company LLP');
    expect(screen.getByLabelText('Message')).toHaveValue(emailDraftBody.message);
    expect(coreApi.get).toHaveBeenCalledWith('/invoices/1/email-draft');
  });

  it('says it is preparing the email while it waits', async () => {
    let release: () => void = () => undefined;
    vi.mocked(coreApi.get).mockReturnValue(
      new Promise((resolve) => {
        release = () => resolve({ data: emailDraftEnvelope() });
      }) as never,
    );
    renderDialog();

    expect(screen.getByRole('status')).toHaveTextContent('Preparing the email…');
    expect(screen.queryByLabelText('To')).not.toBeInTheDocument();
    act(() => release());
    await screen.findByLabelText('To');
  });

  it('opens with an empty To when the client has no contact email', async () => {
    vi.mocked(coreApi.get).mockImplementation((async () => ({
      data: emailDraftEnvelope({ ...emailDraftBody, to: [] }),
    })) as never);
    renderDialog();

    expect(await screen.findByLabelText('To')).toHaveValue('');
  });

  it('says so, with Try again, when the draft cannot be made', async () => {
    vi.mocked(coreApi.get).mockRejectedValue(failure(500));
    const user = userEvent.setup();
    renderDialog();

    expect(await screen.findByRole('alert')).toHaveTextContent('The email could not be prepared.');
    vi.mocked(coreApi.get).mockImplementation((async () => ({ data: emailDraftEnvelope() })) as never);
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByLabelText('To')).toBeInTheDocument();
  });

  it('says the invoice details are not set up when the draft answers 503', async () => {
    vi.mocked(coreApi.get).mockRejectedValue(failure(503, 'Invoice details are not set up on the server'));
    renderDialog();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The invoice details are not set up on the server. Ask whoever runs it to add the company and bank settings.',
    );
  });
});

describe('InvoiceEmailDialog: sending', () => {
  it('sends what is on screen, tells the page who it went to, and closes', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(sentReply as never);
    const user = userEvent.setup();
    const { onSent, onOpenChange } = renderDialog();
    await screen.findByLabelText('To');

    await user.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.post).toHaveBeenCalledTimes(1);
    expect(coreApi.post).toHaveBeenCalledWith('/invoices/1/send', {
      to: ['michael@example.com'],
      subject: 'Invoice INV-001 from Test Company LLP',
      message: emailDraftBody.message,
    });
    expect(onSent).toHaveBeenCalledWith('Invoice INV-001 sent to michael@example.com.');
  });

  it('cleans a messy list of recipients: separators, spaces, repeats in any case', async () => {
    vi.mocked(coreApi.post).mockResolvedValue(sentReply as never);
    const user = userEvent.setup();
    const { onSent } = renderDialog();
    const to = await screen.findByLabelText('To');
    fireEvent.change(to, { target: { value: ' A@x.com; b@y.com ,  a@x.com\n c@z.com ' } });

    await user.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(coreApi.post).toHaveBeenCalled());
    expect(vi.mocked(coreApi.post).mock.calls[0][1]).toMatchObject({ to: ['A@x.com', 'b@y.com', 'c@z.com'] });
    expect(onSent).toHaveBeenCalledWith('Invoice INV-001 sent to A@x.com, b@y.com, c@z.com.');
  });

  it.each([
    ['', 'Enter at least one email address'],
    ['a@x.com, oops', 'That does not look like an email address: oops'],
    [Array.from({ length: 11 }, (_, i) => `p${i}@x.com`).join(', '), 'Send to 10 addresses or fewer'],
  ])('refuses the recipients %j on screen, before anything is sent', async (value, message) => {
    const user = userEvent.setup();
    renderDialog();
    fireEvent.change(await screen.findByLabelText('To'), { target: { value } });

    await user.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(coreApi.post).not.toHaveBeenCalled();
  });

  it('refuses a blank subject and sends nothing', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.clear(await screen.findByLabelText('Subject'));

    await user.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText('Subject is required')).toBeInTheDocument();
    expect(coreApi.post).not.toHaveBeenCalled();
  });

  it('sends one request however often Send is clicked while it is sending', async () => {
    let release: () => void = () => undefined;
    vi.mocked(coreApi.post).mockReturnValue(
      new Promise((resolve) => {
        release = () => resolve(sentReply as never);
      }) as never,
    );
    const user = userEvent.setup();
    const { onOpenChange } = renderDialog();
    await screen.findByLabelText('To');
    const send = screen.getByRole('button', { name: 'Send' });

    await user.click(send);
    await waitFor(() => expect(send).toBeDisabled());
    await user.click(send);
    act(() => release());

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(coreApi.post).toHaveBeenCalledTimes(1);
  });

  it('cannot be dismissed while it is sending', async () => {
    vi.mocked(coreApi.post).mockReturnValue(new Promise(() => undefined) as never);
    const user = userEvent.setup();
    const { onOpenChange } = renderDialog();
    await screen.findByLabelText('To');

    await user.click(screen.getByRole('button', { name: 'Send' }));
    await user.keyboard('{Escape}');

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it.each([
    [503, 'Email is not set up on the server', 'Email is not set up on the server. Ask whoever runs it to add the SMTP settings.'],
    [
      503,
      'Invoice details are not set up on the server',
      'The invoice details are not set up on the server. Ask whoever runs it to add the company and bank settings.',
    ],
    [502, 'The email could not be sent', 'The email could not be sent. Check the address and try again.'],
    [404, 'Invoice 1 not found', 'This invoice was removed elsewhere, so it cannot be sent. Close this dialog and go back to Projects.'],
    [500, 'Internal server error', 'That did not send. Try again.'],
  ])('says what went wrong for a %i (%s) and stays open', async (status, serviceText, shown) => {
    vi.mocked(coreApi.post).mockRejectedValue(failure(status, serviceText));
    const user = userEvent.setup();
    const { onSent, onOpenChange } = renderDialog();
    await screen.findByLabelText('To');

    await user.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(shown);
    expect(onSent).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
