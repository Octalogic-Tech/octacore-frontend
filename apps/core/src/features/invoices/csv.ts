import { neutraliseFormula, toCsv } from '@/lib/csv';
import { toAmountText } from '@/lib/money';
import { STATUS_LABELS, invoiceStatus, type InvoiceListRow } from './filters';

const HEADERS = [
  'Number',
  'Client',
  'Project',
  'Issued',
  'Due',
  'Paid',
  'Amount',
  'Tax',
  'Total',
  'Currency',
  'Status',
];

/**
 * One row per invoice, as listed. Dates stay `YYYY-MM-DD` and the money plain numbers of units and hundredths of the
 * invoice's own currency (`360.00`): the amount before tax, the tax and the total the client pays, then the currency's
 * code, so a spreadsheet can sort and filter them.
 */
export function invoicesToCsv(
  invoices: readonly InvoiceListRow[],
  today: string
): string {
  return toCsv(
    HEADERS,
    invoices.map((invoice) => [
      neutraliseFormula(invoice.number),
      neutraliseFormula(invoice.clientName),
      neutraliseFormula(invoice.projectName),
      invoice.issueDate,
      invoice.dueDate ?? '',
      invoice.paidDate ?? '',
      toAmountText(invoice.amountCents),
      toAmountText(invoice.taxCents),
      toAmountText(invoice.totalCents),
      invoice.currencyCode,
      STATUS_LABELS[invoiceStatus(invoice, today)],
    ])
  );
}
