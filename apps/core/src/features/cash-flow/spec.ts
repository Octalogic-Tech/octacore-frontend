import type { PlannedSpec } from '@/features/planned/types';

export const cashFlowSpec: PlannedSpec = {
  id: 'cash-flow',
  title: 'Cash-flow forecast',
  summary: 'Forecast the coming weeks of cash in and out from invoices due, scheduled milestones and salaries.',
  surface: 'page',
  home: 'Finance › Cash flow',
  size: 'S–M',
  needs: ['money-in-cents', 'currency-tax', 'milestones'],
  does: [
    'A bar per week of money expected in against payroll going out, with a running balance and the list behind each bar.',
    'Money in comes from unpaid invoices at their expected pay date, from milestones not yet invoiced, and from recurring drafts.',
    'Money out starts with salaries and adds expenses once they are recorded.',
    'Overdue invoices show as brought forward, not lost.',
  ],
  buildsOn: [
    'Invoices: the due date, the paid date and the overdue state that is already worked out.',
    'People’s monthly salary.',
    'Milestones, recurring drafts and expenses, which do not exist yet. The page can start with invoices and salaries alone.',
  ],
  decisions: [
    'The horizon: 13 weeks, or another span.',
    'The expected pay date: the due date, or the due date plus how late that client usually pays.',
    'No bank balance is stored, so start from zero or from a balance a partner types in.',
    'Payroll dates, since only a monthly figure exists.',
    'Salaries show on this page, so the question of who may see them comes first.',
  ],
  dialogs: [],
};
