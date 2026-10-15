import { AxiosError } from 'axios';
import { coreApi } from '@/lib/core-api';
import { downloadInvoicePdf, notSetUpMessage, pdfFileName } from './invoice-pdf';

vi.mock('@/lib/core-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/core-api')>()),
  coreApi: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const failure = (status: number, data: unknown = {}) =>
  new AxiosError('failed', 'ERR_BAD_REQUEST', undefined, null, {
    status,
    data,
    statusText: String(status),
    headers: {},
    config: {} as never,
  });

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

describe('pdfFileName', () => {
  it.each([
    ['OCTA/26-27/TKO/007', 'OCTA-26-27-TKO-007.pdf'],
    ['INV 12', 'INV-12.pdf'],
    ['A/B "C"; D', 'A-B-C-D.pdf'],
    ['../../etc/passwd', 'etc-passwd.pdf'],
    ['日本語', 'invoice.pdf'],
    ['', 'invoice.pdf'],
  ])('names %j as %s, the way the service does', (number, name) => {
    expect(pdfFileName(number)).toBe(name);
  });
});

describe('downloadInvoicePdf', () => {
  it('fetches the file with the signed-in client and saves it under the invoice number', async () => {
    vi.mocked(URL.createObjectURL).mockReturnValue('blob:download-1');
    vi.mocked(coreApi.get).mockResolvedValue({ data: new Blob(['%PDF-1.4']) } as never);
    const saved: { href: string; name: string }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      saved.push({ href: this.href, name: this.download });
    });

    await downloadInvoicePdf({ id: 7, number: 'OCTA/26-27/TKO/007' });

    expect(coreApi.get).toHaveBeenCalledWith('/invoices/7/pdf', { responseType: 'blob' });
    expect(saved).toEqual([{ href: 'blob:download-1', name: 'OCTA-26-27-TKO-007.pdf' }]);
    expect(document.querySelector('a[download]')).toBeNull();
  });

  it('lets a failure through, for the page to say so', async () => {
    vi.mocked(coreApi.get).mockRejectedValue(failure(500));

    await expect(downloadInvoicePdf({ id: 7, number: 'X' })).rejects.toBeDefined();
  });
});

describe('notSetUpMessage', () => {
  it('says nothing for anything but a 503', () => {
    expect(notSetUpMessage(failure(500))).toBeUndefined();
    expect(notSetUpMessage(failure(404))).toBeUndefined();
    expect(notSetUpMessage(new Error('down'))).toBeUndefined();
  });

  it('says the SMTP settings are missing when the service said email is not set up', () => {
    const error = failure(503, { statusCode: 503, message: 'Email is not set up on the server', data: null });

    expect(notSetUpMessage(error)).toBe('Email is not set up on the server. Ask whoever runs it to add the SMTP settings.');
  });

  it('says the invoice details are missing for any other 503, including one whose body is a file', () => {
    expect(notSetUpMessage(failure(503, { message: 'Invoice details are not set up on the server' }))).toBe(
      'The invoice details are not set up on the server. Ask whoever runs it to add the company and bank settings.',
    );
    expect(notSetUpMessage(failure(503, new Blob(['{"message":"x"}'])))).toContain('invoice details');
  });
});
