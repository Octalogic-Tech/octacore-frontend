import type { PlannedDialogSpec, PlannedSpec } from '@/features/planned/types';

export const quoteDialog: PlannedDialogSpec = {
  title: 'New quote',
  previewLabel: 'Preview the quote dialog',
  summary: 'Start a quote for a client or a prospect.',
  fields: [
    'Client, or a prospect’s name',
    'Project type: resource augmentation or product',
    'Valid until',
    'Currency',
    'Resources, each with a category, headcount, rate and months',
    'Discount, as a percent',
    'Notes',
  ],
  happens: [
    'Saved as a draft quote with its own number.',
    'The monthly and total price are worked out from the resources, the discount and the tax.',
    'It can be previewed and downloaded as a PDF in the invoice’s style, and emailed from here.',
    'Marking it won offers to create the client and the project with these resources.',
  ],
};

export const quotesSpec: PlannedSpec = {
  id: 'quotes',
  title: 'Quote generator',
  summary: 'Build a quote from rates, headcount and months, send it as a PDF, and turn a won quote into a project.',
  surface: 'page',
  home: 'Work › Quotes',
  size: 'M',
  needs: ['money-in-cents', 'currency-tax'],
  does: [
    'A list of quotes, each with a status: draft, sent, won or lost.',
    'A quote editor: resources (category, headcount, rate, months), a discount, a currency and tax, giving a monthly and a total price.',
    'A PDF in the style of the invoice, and an email draft like the invoice’s.',
    'Marking a quote won creates the client if they are new, then the project and its resources.',
  ],
  buildsOn: [
    'Categories, and the rates already kept on project resources.',
    'The invoice PDF drawing, the email draft and the project discount.',
    'Currency and tax, so a quote can be in the client’s currency.',
  ],
  decisions: [
    'A rate card per category: where it lives, and whether a quote may go below it.',
    'Quotes for fixed-cost work, which are by milestones rather than by months.',
    'Versions of a quote, and an expiry date.',
    'There is no lead list, and the website’s contact form has no endpoint, so a quote starts from an existing client or a typed prospect name.',
  ],
  dialogs: [quoteDialog],
};
