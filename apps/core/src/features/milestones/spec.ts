import type { PlannedDialogSpec, PlannedSpec } from '@/features/planned/types';

export const milestoneDialog: PlannedDialogSpec = {
  title: 'Milestone',
  previewLabel: 'Preview the milestone dialog',
  summary: 'Add or change one step in a fixed-cost project’s payment schedule.',
  fields: ['Name', 'Amount, or a percent of the agreed price', 'Due date', 'Notes'],
  happens: [
    'Added to the project’s schedule in the order of its due date.',
    'The schedule shows its total against the agreed price and warns when they differ.',
    'Invoice this milestone makes a draft with one line and links the two.',
    'Once a milestone is invoiced its amount is locked.',
  ],
};

export const milestonesSpec: PlannedSpec = {
  id: 'milestones',
  title: 'Milestone schedule',
  summary: 'Split a fixed-cost project’s price into milestones with an amount and a due date, and invoice each one.',
  surface: 'page',
  home: 'Project page › Milestones tab',
  size: 'M',
  needs: [],
  does: [
    'An ordered list of milestones on each fixed-cost project: name, amount, due date and state.',
    'Their total is the project’s agreed price, shown against what has been invoiced and paid.',
    'Invoice this milestone makes a draft invoice with one line and links the two.',
    'A warning when the milestones do not add up to the price.',
  ],
  buildsOn: [
    'The fixed-cost billing type. It will be a Milestones tab on the project page, beside Overview, Invoices and Resources.',
    'The invoice dialog and the draft flow.',
    'The project totals, which come only from invoices today, so a fixed-cost project has no agreed price anywhere.',
  ],
  decisions: [
    'Whether the agreed price is its own field on the project or only the sum of its milestones.',
    'Amounts as fixed figures or as a percent of the price.',
    'Whether one milestone can be invoiced in parts.',
    'What marks a milestone done: a partner, or the client’s acceptance.',
  ],
  dialogs: [milestoneDialog],
};
