import type { PlannedDialogSpec, PlannedSpec } from '@/features/planned/types';

export const taxRateDialog: PlannedDialogSpec = {
  title: 'Tax rate',
  previewLabel: 'Preview the tax rate dialog',
  summary: 'Add or change a tax that invoices can carry.',
  fields: [
    'Name, for example GST or VAT',
    'Rate, as a percent',
    'Kind: added to the invoice, or withheld by the client',
    'Applies to: a country, or one client',
    'Active from',
  ],
  happens: [
    'Saved to the list of tax rates.',
    'New invoices pick it up by the client’s country; an invoice already issued keeps the rate it was given.',
    'A rate no invoice uses can be deleted; one that is used can only be switched off.',
  ],
};

export const currencyTaxSpec: PlannedSpec = {
  id: 'currency-tax',
  title: 'Currency and tax',
  summary: 'Bill in the client’s currency and add the tax that applies, instead of one fixed dollar sign and no tax.',
  surface: 'page',
  home: 'Finance › Currency and tax',
  size: 'M–L',
  needs: ['money-in-cents'],
  does: [
    'Each project has a billing currency. An invoice shows its subtotal, discount, tax lines and total in it.',
    'A list of tax rates (GST, VAT, TDS) that apply by the client’s country, added to an invoice or withheld by the client.',
    'The invoice preview, PDF and email draft follow the currency and show the tax lines.',
    'Reports (Overview, cash flow, profit and loss) convert to one base currency using a stored exchange rate.',
  ],
  buildsOn: [
    'The invoice editor, PDF and email, which print one dollar amount today.',
    'The money formatter, which is fixed to US dollars. Your product notes list the currency as an open decision.',
    'The client’s country, from the Countries reference data, and the project’s billing address.',
  ],
  decisions: [
    'The base currency to report in: dollars or rupees.',
    'Whether the currency is fixed per project or free per invoice.',
    'Where an exchange rate comes from (typed by a partner or a daily feed) and which date it applies on: issue or payment.',
    'Whether tax is added on top or already in the price, and how tax withheld by the client (TDS) shows: it lowers the cash received, not the invoice.',
    'The wording a tax invoice must carry in each country. Check with your accountant before the PDF changes.',
  ],
  dialogs: [taxRateDialog],
};
