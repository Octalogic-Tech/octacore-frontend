import type { PlannedDialogSpec, PlannedSpec } from '@/features/planned/types';

export const allocateDialog: PlannedDialogSpec = {
  title: 'Allocate a person',
  previewLabel: 'Preview the allocation dialog',
  summary: 'Put a person on a project for a stretch of time.',
  fields: [
    'Person',
    'Project',
    'Role (a category)',
    'From',
    'To, left blank while it has no end',
    'Share of their time, as a percent',
  ],
  happens: [
    'Saved against the project’s resource, so the project page and this page agree.',
    'A person above 100% across projects is flagged.',
    'The bench list and the ending-soon list update.',
  ],
};

export const allocationSpec: PlannedSpec = {
  id: 'allocation',
  title: 'Allocation and bench',
  summary: 'See who is on which project week by week, who is free next, and what an idle person costs.',
  surface: 'page',
  home: 'Work › Allocation',
  size: 'M',
  needs: [],
  does: [
    'Resources get a start date, an end date and a share of the person’s time.',
    'A grid of people against weeks, with one bar per project.',
    'A bench list: people with nothing allocated, with the monthly cost of each.',
    'Open slots (resource rows with no person yet) and engagements that end in the next 30 days.',
  ],
  buildsOn: [
    'Project resources: person, category, headcount and rate. A resource with no person is already possible.',
    'People: join and leave dates and monthly salary.',
    'Project status and dates, which are agreed but not built yet.',
  ],
  decisions: [
    'Share of time as a percent, or a headcount per resource as it is today.',
    'Weeks or months as the unit of the grid.',
    'Whether leave and public holidays reduce capacity. The retainer draft assumes 160 hours.',
    'The bench cost shows salary, so roles beyond admin have to come first.',
  ],
  dialogs: [allocateDialog],
};
