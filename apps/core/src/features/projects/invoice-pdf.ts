import axios from 'axios';
import { statusOf } from '@/lib/core-api';
import { fetchInvoicePdf } from './api';

/** The invoice number made safe for a file name, the way the service does it: `OCTA/26-27/TKO/007` is `OCTA-26-27-TKO-007.pdf`. */
export function pdfFileName(number: string): string {
  const name = number.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[-.]+|[-.]+$/g, '');
  return `${name || 'invoice'}.pdf`;
}

/** Fetches the same file the preview shows and saves it. A failure goes to the caller, which says so. */
export async function downloadInvoicePdf(invoice: { id: number; number: string }): Promise<void> {
  const blob = await fetchInvoicePdf(invoice.id);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = pdfFileName(invoice.number);
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Not at once: the browser may still be reading the file when the click returns.
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/**
 * What a 503 from an invoice route means to a person: the server has not been given its company and bank details, or
 * its mail settings. A file answer (the preview and download routes ask for a blob) carries no readable message, and
 * for those routes the letterhead is the only thing that can be missing.
 */
export function notSetUpMessage(error: unknown): string | undefined {
  if (statusOf(error) !== 503) return undefined;
  const data = axios.isAxiosError(error) ? (error.response?.data as { message?: unknown } | undefined) : undefined;
  return typeof data?.message === 'string' && data.message.startsWith('Email')
    ? 'Email is not set up on the server. Ask whoever runs it to add the SMTP settings.'
    : 'The invoice details are not set up on the server. Ask whoever runs it to add the company and bank settings.';
}
