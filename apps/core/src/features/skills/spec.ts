import type { PlannedDialogSpec, PlannedSpec } from '@/features/planned/types';

export const skillsDialog: PlannedDialogSpec = {
  title: 'Edit skills',
  previewLabel: 'Preview the skills dialog',
  summary: 'Record which technologies a person knows, and how well.',
  fields: ['Person', 'Technologies, each with a level', 'Last used, optional'],
  happens: [
    'Saved to the person’s skills, and the grid updates.',
    'A technology that is not in the list is added on the Technologies page first.',
    'The date of the last change is kept, so an entry that has gone stale shows.',
  ],
};

export const skillsSpec: PlannedSpec = {
  id: 'skills',
  title: 'Skills matrix',
  summary: 'Record which technologies each person knows, so you can ask who knows a stack and is free.',
  surface: 'page',
  home: 'Work › Skills',
  size: 'S–M',
  needs: [],
  does: [
    'A grid of people against technologies, with a level in each cell.',
    'Filter by technology or category to see who matches, with their allocation beside them.',
    'A project can list the technologies it is built with, from the same list.',
  ],
  buildsOn: [
    'The Technologies and Categories reference data. Nothing links to it today: no project, person or resource points at a technology.',
    'People, and the Allocation board for who is free.',
  ],
  decisions: [
    'Yes or no, or a level such as learning, working and expert.',
    'Who sets it: a partner, or each person for themselves.',
    'Whether years of experience or the date last used are kept.',
    'Whether engineers can see this page, which needs roles beyond admin.',
  ],
  dialogs: [skillsDialog],
};
