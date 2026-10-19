import { invoicesToCsv } from './csv';
import { toListRows, type InvoiceListRow } from './filters';

const TODAY = '2026-11-20';
const HEADER = 'Number,Client,Project,Issued,Due,Paid,Amount,Status';

const make = (fields: Partial<InvoiceListRow> = {}): InvoiceListRow => ({
  ...toListRows(
    [
      {
        id: 1,
        projectId: 1,
        number: 'INV-001',
        description: '',
        subtotalCents: 36000,
        discountPercent: 0,
        amountCents: 36000,
        issueDate: '2026-10-01',
        dueDate: '2026-10-31',
        paidDate: '2026-10-12',
        periodStart: null,
        periodEnd: null,
        lineItems: [],
      },
    ],
    [
      {
        id: 1,
        name: 'Website',
        description: '',
        key: '',
        billingAddress: '',
        discountPercent: 0,
        clientId: 1,
        clientName: 'Acme',
        projectStatus: 'active',
        projectStatusLabel: 'Active',
        startDate: null,
        endDate: null,
        technologies: [],
        projectType: null,
        billingType: null,
        projectTypeLabel: '',
        billingTypeLabel: '',
        totalValueCents: 0,
        totalOutstandingCents: 0,
      },
    ],
  )[0],
  ...fields,
});

describe('invoicesToCsv', () => {
  it('writes a header and one CRLF-separated row per invoice, with ISO dates and the amount as a number', () => {
    expect(invoicesToCsv([make()], TODAY)).toBe(
      [HEADER, 'INV-001,Acme,Website,2026-10-01,2026-10-31,2026-10-12,360.00,Paid'].join('\r\n'),
    );
  });

  it.each([
    [36000, '360.00'],
    [123456, '1234.56'],
    [5, '0.05'],
    [0, '0.00'],
  ])('writes %i cents as the plain number %s, with two decimals, no symbol and no grouping', (amountCents, text) => {
    expect(invoicesToCsv([make({ amountCents })], TODAY)).toContain(`2026-10-12,${text},Paid`);
  });

  it('writes only the header when there are no invoices', () => {
    expect(invoicesToCsv([], TODAY)).toBe(HEADER);
  });

  it('leaves the due and paid dates empty when there are none', () => {
    const row = make({ number: 'INV-002', issueDate: '2026-11-01', dueDate: null, paidDate: null, amountCents: 12000 });
    expect(invoicesToCsv([row], TODAY)).toContain('INV-002,Acme,Website,2026-11-01,,,120.00,Unpaid');
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

  it('stops a spreadsheet running a typed value as a formula, and quotes values with commas', () => {
    const row = make({ number: '=1+1', clientName: '+Acme', projectName: 'Web, mobile' });
    const csv = invoicesToCsv([row], TODAY);
    expect(csv).toContain("'=1+1,'+Acme,\"Web, mobile\",");
  });
});
