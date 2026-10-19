import type { PlannedDialogSpec, PlannedSpec } from '@/features/planned/types';

export const scheduleDialog: PlannedDialogSpec = {
  title: 'Schedule a retainer project',
  previewLabel: 'Preview the schedule dialog',
  summary: 'Choose when a retainer project’s invoice is drafted.',
  fields: [
    'Project (retainer projects only)',
    'Day of the month',
    'Period to bill: the month just ended, or the month starting',
    'Hours per resource (160 unless changed)',
    'Who to tell when a draft is ready',
    'Active',
  ],
  happens: [
    'Saved as the project’s schedule, with its next run date shown in the list.',
    'On the day, a draft invoice is made from the project’s resources, with the project’s discount.',
    'The draft waits in the review queue. Nothing is sent until a partner sends it.',
    'Switching a schedule off stops future drafts and keeps the ones already made.',
  ],
};

export const recurringInvoicesSpec: PlannedSpec = {
  id: 'recurring-invoices',
  title: 'Recurring retainer drafts',
  summary: 'Draft each retainer project’s invoice on a set day, for a partner to review and send.',
  surface: 'page',
  home: 'Finance › Recurring invoices',
  size: 'S',
  needs: [],
  does: [
    'A schedule per retainer project: the day of the month and the period to bill.',
    'On the day, a draft is made from the project’s resources at 160 hours each, with the project’s discount.',
    'A review queue of drafts that are waiting, and the last and next run for each project.',
    'Nothing is sent without a partner pressing send.',
  ],
  buildsOn: [
    'The retainer invoice draft the project page already makes: resources at 160 hours each.',
    'Invoice numbering from the project key, and the send and email flow.',
    'The project discount.',
  ],
  decisions: [
    'Draft only, which is the safe default, or send automatically.',
    'The day, and the time zone it runs in.',
    'A headcount change in the middle of a month: prorate it, or bill it from the next month.',
    'Where the scheduled job runs: outside the service or inside it.',
    'How partners are told a draft is ready: by email, or on the Overview.',
  ],
  dialogs: [scheduleDialog],
};
