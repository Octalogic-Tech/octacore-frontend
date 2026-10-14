import type { Bill } from './types';

const HEADERS = [
  'Bill date',
  'Amount',
  'Bill type',
  'Reimbursement',
  'Uploaded by',
  'Submitted by',
  'Approved',
  'Approved by',
  'Bill file',
];

/** A leading = + - @ (or a tab or return) makes a spreadsheet run the cell as a formula; an apostrophe stops it. */
export function neutraliseFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function cell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** RFC 4180: CRLF between rows, and quotes around any value with a comma, quote or line break. */
export function billsToCsv(bills: Bill[]): string {
  const rows = bills.map((bill) => [
    bill.billDate,
    String(bill.amount),
    bill.billType,
    bill.actualExpense ? 'Yes' : 'No',
    neutraliseFormula(bill.uploadedBy),
    neutraliseFormula(bill.submittedBy),
    bill.approved ? 'Yes' : 'No',
    neutraliseFormula(bill.approvedBy),
    neutraliseFormula(bill.billPath),
  ]);
  return [HEADERS, ...rows].map((row) => row.map(cell).join(',')).join('\r\n');
}

/** Saves the text as a UTF-8 file (with a byte-order mark so Excel reads accents correctly). */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
