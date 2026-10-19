import { render, screen, within } from '@testing-library/react';
import { quoteTotals, type CalcSettings } from './calc';
import { QuoteTotalsPanel } from './quote-totals-panel';

// The default settings of a new quote, as the mirror takes them.
const settings: CalcSettings = {
  developerCount: 3,
  developerRateCents: 310_000,
  managerCount: 1,
  managerRateCents: 300_000,
  testerCount: 1,
  testerRateCents: 0,
  negotiationBufferBp: 2500,
  managementBp: 2500,
  testingBp: 0,
  bugFixBp: 0,
  hoursPerDay: 6,
  hoursPerMonth: 160,
};

// The workbook of the design's section 3.4: 1,188 base hours at the default settings.
const workbook = quoteTotals(settings, [{ units: 1, hoursHundredths: 118_800 }]);

/** Every value printed beside a label in one section of the panel. */
const valuesOf = (section: string, label: string) => {
  const term = within(screen.getByRole('region', { name: section })).getByText(label, { selector: 'dt' });
  return Array.from((term.parentElement as HTMLElement).querySelectorAll('dd')).map((value) => value.textContent);
};

describe('QuoteTotalsPanel', () => {
  it('shows the time, the hours and the cost of the workbook in rupees', () => {
    render(<QuoteTotalsPanel settings={settings} totals={workbook} lineHours={118_800} currencyCode="INR" />);

    expect(valuesOf('Time', 'Total effort')).toEqual(['1,485 hours']);
    expect(valuesOf('Time', 'Person-days')).toEqual(['247.5', 'at 6 hours a day']);
    expect(valuesOf('Time', 'Elapsed')).toEqual(['2.48 months', 'with 3 developers']);

    expect(valuesOf('Hours', 'From the lines')).toEqual(['1,188 hours']);
    expect(valuesOf('Hours', 'Development, incl. bug fixing')).toEqual(['1,188 hours', '396 per person']);
    expect(valuesOf('Hours', 'Management')).toEqual(['297 hours', '297 per person']);
    expect(valuesOf('Hours', 'Testing')).toEqual(['0 hours', '0 per person']);

    expect(valuesOf('Cost', 'Development')).toEqual(['₹36,82,800.00']);
    expect(valuesOf('Cost', 'Management')).toEqual(['₹8,91,000.00']);
    expect(valuesOf('Cost', 'Testing')).toEqual(['₹0.00']);
    expect(valuesOf('Cost', 'Subtotal')).toEqual(['₹45,73,800.00']);
    expect(valuesOf('Cost', 'Negotiation buffer (25%)')).toEqual(['₹11,43,450.00']);
    expect(valuesOf('Cost', 'Final quote')).toEqual(['₹57,17,250.00']);
  });

  it('formats the money in the quote’s currency and the buffer as typed', () => {
    const dollars = { ...settings, negotiationBufferBp: 750, developerCount: 1, hoursPerDay: 1 };
    render(
      <QuoteTotalsPanel
        settings={dollars}
        totals={quoteTotals(dollars, [{ units: 1, hoursHundredths: 100 }])}
        lineHours={100}
        currencyCode="USD"
      />,
    );
    expect(valuesOf('Cost', 'Final quote')).toEqual(['$4,138.75']);
    expect(valuesOf('Cost', 'Negotiation buffer (7.5%)')).toEqual(['$288.75']);
    // One of each reads as one.
    expect(valuesOf('Time', 'Total effort')).toEqual(['1.25 hours']);
    expect(valuesOf('Time', 'Elapsed')).toEqual(['0.01 months', 'with 1 developer']);
    expect(valuesOf('Time', 'Person-days')).toEqual(['1.25', 'at 1 hour a day']);
  });

  it('asks for the settings instead of totals while they are invalid, and keeps the hours from the lines', () => {
    const { container } = render(
      <QuoteTotalsPanel settings={null} totals={null} lineHours={1500} currencyCode="abc" />,
    );
    expect(screen.getByText('Check the settings to see the totals.')).toBeInTheDocument();
    expect(valuesOf('Hours', 'From the lines')).toEqual(['15 hours']);
    expect(screen.queryByRole('region', { name: 'Time' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Cost' })).not.toBeInTheDocument();
    expect(screen.queryByText('Final quote')).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(/NaN|₹/);
  });
});
