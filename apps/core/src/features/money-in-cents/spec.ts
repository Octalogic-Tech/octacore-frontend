import type { PlannedSpec } from '@/features/planned/types';

/** Described on the Planned index only: it is a migration and a change to the formatter, with no page of its own. */
export const moneyInCentsSpec: PlannedSpec = {
  id: 'money-in-cents',
  title: 'Money in cents',
  summary:
    'Rates and salaries are stored as whole dollars, so a rate of $12.50 an hour cannot be saved. Store every amount as whole cents instead.',
  surface: 'none',
  home: 'the service and every amount in the app',
  size: 'M',
  needs: [],
  does: [
    'A migration multiplies every stored amount by 100, and the service sends and accepts cents.',
    'The app converts in one place: forms take dollars and cents, the money formatter shows them, and nothing else does arithmetic on dollars.',
    'Invoice totals and the project discount still round once per invoice, now to the cent.',
    'The invoice PDF and the Invoices CSV export show dollars and cents.',
  ],
  buildsOn: [
    "A resource's rate, an invoice line's rate and a person's monthly salary, all whole dollars today.",
    'The calculated invoice amount and the project totals, which add up what each client pays.',
    'The money formatter, the invoice PDF, the CSV export, and the rate and salary form fields.',
    'The live-contract tests and Cypress fixtures that use dollar amounts. This list comes from the models and the formatter, so look for more when it is picked up.',
  ],
  decisions: [
    'Release the service and the app together in one step, or accept both units for a while.',
    'Whether form inputs take dollars (recommended, because nobody types cents) and convert on save.',
    'Currencies with no minor unit (yen) or three (dinar): settle this together with Currency and tax.',
    'The rounding rule when a percent discount lands between two cents.',
  ],
  dialogs: [],
};
