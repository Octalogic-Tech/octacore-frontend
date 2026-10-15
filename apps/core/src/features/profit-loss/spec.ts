import type { PlannedDialogSpec, PlannedSpec } from '@/features/planned/types';

export const expenseDialog: PlannedDialogSpec = {
  title: 'Add an expense',
  previewLabel: 'Preview the expense dialog',
  summary: 'Record money the company spent that is not a salary.',
  fields: [
    'Date',
    'Category: rent, tools, contractors or other',
    'Amount and currency',
    'Vendor',
    'Project, optional',
    'Repeats monthly',
    'Note',
  ],
  happens: [
    'Counted in the month of its date.',
    'Charged to the project’s cost when a project is chosen, otherwise to overhead.',
    'A repeating expense adds itself each month until it is switched off.',
  ],
};

export const profitLossSpec: PlannedSpec = {
  id: 'profit-loss',
  title: 'Profit and loss',
  summary: 'See each month’s revenue minus payroll and expenses, and which projects and clients earn the margin.',
  surface: 'page',
  home: 'Finance › Profit and loss',
  size: 'M',
  needs: ['money-in-cents', 'currency-tax', 'allocation'],
  does: [
    'A monthly table of revenue, payroll, other expenses and profit.',
    'A project and client view: revenue against the payroll of the people allocated to them.',
    'Expenses entered by a partner (rent, tools, contractors), one-off or repeating.',
    'A CSV export for the accountant.',
  ],
  buildsOn: [
    'Invoices, and the project totals calculated from them.',
    'People’s monthly salary and the project resources, so payroll can be charged to projects.',
    'Allocation dates (Allocation and bench) and the base currency (Currency and tax).',
  ],
  decisions: [
    'Cash basis (counted when paid) or accrual (counted when invoiced).',
    'Salary is one current figure with no history, so past months would be restated at today’s salary. Either keep a salary history first, or accept the error.',
    'How a person’s cost is split across projects: by allocated share, or by hours billed.',
    'Whether overhead is spread over projects or kept apart.',
    'Who may see it, because salary shows through here.',
  ],
  dialogs: [expenseDialog],
};
