import {
  inrInvoiceRow,
  invoiceRows,
  projectRows,
} from '@/test/fixtures/projects';
import { invoicesToCsv } from './csv';
import { toListRows, type InvoiceListRow } from './filters';
import {
  invoiceRowsSchema,
  projectRowsSchema,
} from '@/features/projects/schema';

const TODAY = '2026-11-20';
const HEADER =
  'Number,Client,Project,Issued,Due,Paid,Amount,Tax,Total,Currency,Status';

// Website (client Acme) and INV-001 from the shared fixtures: paid, in dollars, $36,000.00 as 3,600,000 cents. Each test
// overrides what it is about.
const projects = projectRowsSchema.parse(projectRows);
const [paid] = invoiceRowsSchema.parse(invoiceRows);
const [rupees] = invoiceRowsSchema.parse([inrInvoiceRow]);

const make = (fields: Partial<InvoiceListRow> = {}): InvoiceListRow => ({
  ...toListRows(
    [{ ...paid, amountCents: 36000, totalCents: 36000 }],
    projects
  )[0],
  ...fields,
});

describe('invoicesToCsv', () => {
  it('writes a header and one CRLF-separated row per invoice, with ISO dates and the amount as a number', () => {
    expect(invoicesToCsv([make()], TODAY)).toBe(
      [
        HEADER,
        'INV-001,Acme,Website,2026-10-01,2026-10-31,2026-10-12,360.00,0.00,360.00,USD,Paid',
      ].join('\r\n')
    );
  });

  it.each([
    [36000, '360.00'],
    [123456, '1234.56'],
    [5, '0.05'],
    [0, '0.00'],
  ])(
    'writes %i cents as the plain number %s, with two decimals, no symbol and no grouping',
    (amountCents, text) => {
      expect(
        invoicesToCsv([make({ amountCents, totalCents: amountCents })], TODAY)
      ).toContain(`2026-10-12,${text},0.00,${text},USD,Paid`);
    }
  );

  it('writes only the header when there are no invoices', () => {
    expect(invoicesToCsv([], TODAY)).toBe(HEADER);
  });

  it('leaves the due and paid dates empty when there are none', () => {
    const row = make({
      number: 'INV-002',
      issueDate: '2026-11-01',
      dueDate: null,
      paidDate: null,
      amountCents: 12000,
      totalCents: 12000,
    });
    expect(invoicesToCsv([row], TODAY)).toContain(
      'INV-002,Acme,Website,2026-11-01,,,120.00,0.00,120.00,USD,Unpaid'
    );
  });

  it('says Overdue for an unpaid invoice past its due date, as of today', () => {
    const row = make({ dueDate: '2026-11-19', paidDate: null });
    expect(invoicesToCsv([row], TODAY)).toMatch(/,Overdue$/);
    expect(invoicesToCsv([row], '2026-11-19')).toMatch(/,Unpaid$/);
  });

  it('leaves the client and project blank when the invoice has none', () => {
    const row = make({ clientId: null, clientName: '', projectName: '' });
    expect(invoicesToCsv([row], TODAY)).toContain('INV-001,,,2026-10-01');
  });

  it('writes the amount before tax, the tax and the total in the invoice’s own currency, with its code: never dollars', () => {
    // ₹2,00,000.00 as 20,000,000 paise, its 18% tax ₹36,000.00 and the total ₹2,36,000.00. Its dollars (2,266.29) are not written.
    const row = toListRows([rupees], projects)[0];
    const csv = invoicesToCsv([row], TODAY);
    expect(csv).toBe(
      [
        HEADER,
        'INV-003,,Mobile app,2026-10-05,2026-10-20,,200000.00,36000.00,236000.00,INR,Overdue',
      ].join('\r\n')
    );
    expect(csv).not.toContain('2266');
  });

  it('writes a row for each currency, each with its own code', () => {
    const rows = toListRows([paid, rupees], projects);
    const lines = invoicesToCsv(rows, TODAY).split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines.filter((line) => line.endsWith(',USD,Paid'))).toHaveLength(1);
    expect(lines.filter((line) => line.includes(',INR,'))).toHaveLength(1);
  });

  it('stops a spreadsheet running a typed value as a formula, and quotes values with commas', () => {
    const row = make({
      number: '=1+1',
      clientName: '+Acme',
      projectName: 'Web, mobile',
    });
    const csv = invoicesToCsv([row], TODAY);
    expect(csv).toContain('\'=1+1,\'+Acme,"Web, mobile",');
  });
});
