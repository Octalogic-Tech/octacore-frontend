import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import { useState } from 'react';
import { coreApi } from '@/lib/core-api';
import { renderWithProviders } from '@/test/utils';
import { InvoicePreviewDialog } from './invoice-preview-dialog';

vi.mock('@/lib/core-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/core-api')>()),
  coreApi: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const invoice = { id: 1, number: 'OCTA/26-27/TKO/007' };
const FRAME = 'Invoice OCTA/26-27/TKO/007';

const file = () => ({ data: new Blob(['%PDF-1.4 test'], { type: 'application/pdf' }) });

const failure = (status: number) =>
  new AxiosError('failed', 'ERR_BAD_REQUEST', undefined, null, {
    status,
    data: new Blob(['{}']),
    statusText: String(status),
    headers: {},
    config: {} as never,
  });

function Harness() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open it</button>
      <InvoicePreviewDialog open={open} onOpenChange={setOpen} invoice={invoice} />
    </>
  );
}

beforeEach(() => {
  let counter = 0;
  vi.mocked(URL.createObjectURL).mockImplementation(() => `blob:preview-${++counter}`);
  vi.mocked(coreApi.get).mockImplementation((async () => file()) as never);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

describe('InvoicePreviewDialog', () => {
  it('asks the service for the file with the signed-in client and shows it in a frame', async () => {
    renderWithProviders(<InvoicePreviewDialog open onOpenChange={vi.fn()} invoice={invoice} />);

    const frame = await screen.findByTitle(FRAME);

    expect(frame).toHaveAttribute('src', 'blob:preview-1');
    expect(coreApi.get).toHaveBeenCalledWith('/invoices/1/pdf', { responseType: 'blob' });
    expect(screen.getByRole('dialog', { name: 'Preview OCTA/26-27/TKO/007' })).toBeInTheDocument();
  });

  it('says it is drawing the invoice while it waits, and keeps Download off until it is there', async () => {
    let release: () => void = () => undefined;
    vi.mocked(coreApi.get).mockReturnValue(
      new Promise((resolve) => {
        release = () => resolve(file());
      }) as never,
    );
    renderWithProviders(<InvoicePreviewDialog open onOpenChange={vi.fn()} invoice={invoice} />);

    expect(screen.getByRole('status')).toHaveTextContent('Drawing the invoice…');
    expect(screen.getByRole('button', { name: 'Download' })).toBeDisabled();
    act(() => release());
    await screen.findByTitle(FRAME);
    expect(screen.getByRole('button', { name: 'Download' })).toBeEnabled();
  });

  it('releases the object URL when it closes', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);
    await screen.findByTitle(FRAME);

    await user.click(screen.getByRole('button', { name: 'Close' }));

    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview-1'));
  });

  it('asks again each time it opens, so it shows what is saved now', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);
    await screen.findByTitle(FRAME);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Open it' }));

    expect(await screen.findByTitle(FRAME)).toHaveAttribute('src', 'blob:preview-2');
    expect(coreApi.get).toHaveBeenCalledTimes(2);
  });

  it('says so, with Try again, when the file cannot be drawn', async () => {
    vi.mocked(coreApi.get).mockRejectedValue(failure(500));
    const user = userEvent.setup();
    renderWithProviders(<InvoicePreviewDialog open onOpenChange={vi.fn()} invoice={invoice} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('The invoice could not be shown.');
    vi.mocked(coreApi.get).mockImplementation((async () => file()) as never);
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByTitle(FRAME)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('says the invoice details are not set up when the service answers 503', async () => {
    vi.mocked(coreApi.get).mockRejectedValue(failure(503));
    renderWithProviders(<InvoicePreviewDialog open onOpenChange={vi.fn()} invoice={invoice} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The invoice details are not set up on the server. Ask whoever runs it to add the company and bank settings.',
    );
  });

  it('downloads the same invoice from the dialog', async () => {
    const names: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      names.push(this.download);
    });
    const user = userEvent.setup();
    renderWithProviders(<InvoicePreviewDialog open onOpenChange={vi.fn()} invoice={invoice} />);
    await screen.findByTitle(FRAME);

    await user.click(screen.getByRole('button', { name: 'Download' }));

    await waitFor(() => expect(names).toEqual(['OCTA-26-27-TKO-007.pdf']));
  });

  it('says so when the download fails', async () => {
    const user = userEvent.setup();
    renderWithProviders(<InvoicePreviewDialog open onOpenChange={vi.fn()} invoice={invoice} />);
    await screen.findByTitle(FRAME);
    vi.mocked(coreApi.get).mockRejectedValue(failure(500));

    await user.click(screen.getByRole('button', { name: 'Download' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('That did not download. Try again.');
  });

  it('is closed without an invoice', () => {
    renderWithProviders(<InvoicePreviewDialog open onOpenChange={vi.fn()} invoice={null} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(coreApi.get).not.toHaveBeenCalled();
  });
});
