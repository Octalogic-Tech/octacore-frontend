import type { InvoiceRow, ProjectRow } from '@/features/projects/schema';
import { summarize } from './summary';

// Every amount is in whole US cents.
const project = (id: number, totalValueCents: number, totalOutstandingCents: number): ProjectRow => ({
  id,
  name: `Project ${id}`,
  description: '',
  key: '',
  billingAddress: '',
  discountPercent: 0,
  clientId: 1,
  projectStatus: 'active',
  projectStatusLabel: 'Active',
  startDate: null,
  endDate: null,
  technologies: [],
  clientName: 'Client A',
  projectType: 'product',
  billingType: 'retainer',
  projectTypeLabel: 'Product',
  billingTypeLabel: 'Retainer',
  totalValueCents,
  totalOutstandingCents,
});

const invoice = (id: number, fields: Partial<InvoiceRow> = {}): InvoiceRow => ({
  id,
  projectId: 1,
  number: `INV-${id}`,
  description: '',
  subtotalCents: 10,
  discountPercent: 0,
  amountCents: 10,
  issueDate: '2026-10-01',
  dueDate: null,
  paidDate: null,
  periodStart: null,
  periodEnd: null,
  lineItems: [],
  ...fields,
});

const ids = (list: { id: number }[]) => list.map((item) => item.id);

describe('summarize', () => {
  it('totals value and outstanding across projects', () => {
    const summary = summarize([project(1, 1000, 200), project(2, 500, 0), project(3, 2500, 900)], []);
    expect(summary.projectCount).toBe(3);
    expect(summary.totalValue).toBe(4000);
    expect(summary.totalOutstanding).toBe(1100);
  });

  it('ranks the five largest outstanding amounts and leaves settled projects out', () => {
    const outstanding = [0, 10, 70, 30, 60, 50, 20];
    const summary = summarize(outstanding.map((amount, index) => project(index + 1, 100, amount)), []);
    expect(summary.topOutstanding.map((item) => item.id)).toEqual([3, 5, 6, 4, 7]);
  });

  it('counts every unpaid invoice but lists only the five due soonest', () => {
    // Entered in reverse of their due dates, so the order shown is the sort and not the order given.
    const unpaid = Array.from({ length: 7 }, (_, index) => invoice(index + 1, { dueDate: `2026-11-0${7 - index}` }));
    const paid = [invoice(8, { dueDate: '2026-10-01', paidDate: '2026-10-02' }), invoice(9, { paidDate: '2026-10-03' })];
    const summary = summarize([], [...unpaid, ...paid]);
    expect(summary.unpaidCount).toBe(7);
    expect(ids(summary.unpaidInvoices)).toEqual([7, 6, 5, 4, 3]);
  });

  it('puts an invoice with no due date after the dated ones, the older issue first', () => {
    const summary = summarize(
      [],
      [
        invoice(1, { issueDate: '2026-10-01' }),
        invoice(2, { issueDate: '2026-09-01' }),
        invoice(3, { dueDate: '2026-12-31' }),
      ],
    );
    expect(ids(summary.unpaidInvoices)).toEqual([3, 2, 1]);
  });

  it('breaks a tie on the due date by the older issue, then the earlier entry', () => {
    const due = '2026-11-15';
    const summary = summarize(
      [],
      [
        invoice(3, { dueDate: due, issueDate: '2026-10-05' }),
        invoice(2, { dueDate: due, issueDate: '2026-10-05' }),
        invoice(1, { dueDate: due, issueDate: '2026-10-09' }),
      ],
    );
    expect(ids(summary.unpaidInvoices)).toEqual([2, 3, 1]);
  });

  it("names each unpaid invoice's project", () => {
    const summary = summarize([project(1, 0, 0), project(2, 0, 0)], [invoice(1, { projectId: 2 })]);
    expect(summary.unpaidInvoices[0]).toMatchObject({ projectName: 'Project 2' });
  });

  it('leaves the invoices it is given in their order', () => {
    const given = [invoice(1, { dueDate: '2026-12-01' }), invoice(2, { dueDate: '2026-11-01' })];
    summarize([], given);
    expect(ids(given)).toEqual([1, 2]);
  });

  it('copes with no data at all', () => {
    expect(summarize([], [])).toEqual({
      projectCount: 0,
      totalValue: 0,
      totalOutstanding: 0,
      topOutstanding: [],
      unpaidCount: 0,
      unpaidInvoices: [],
    });
  });
});
