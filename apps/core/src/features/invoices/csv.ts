import { neutraliseFormula, toCsv } from '@/lib/csv';
import { STATUS_LABELS, invoiceStatus, type InvoiceListRow } from './filters';

const HEADERS = ['Number', 'Client', 'Project', 'Issued', 'Due', 'Paid', 'Amount', 'Status'];

/** One row per invoice, as listed. Dates stay `YYYY-MM-DD` and the amount a plain number, so a spreadsheet can sort them. */
export function invoicesToCsv(invoices: readonly InvoiceListRow[], today: string): string {
  return toCsv(
    HEADERS,
    invoices.map((invoice) => [
      neutraliseFormula(invoice.number),
      neutraliseFormula(invoice.clientName),
      neutraliseFormula(invoice.projectName),
      invoice.issueDate,
      invoice.dueDate ?? '',
      invoice.paidDate ?? '',
      String(invoice.amount),
      STATUS_LABELS[invoiceStatus(invoice, today)],
    ]),
  );
}
