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
  timeBufferBp: 0,
  discountBp: 0,
};

// The workbook of the design's section 3.4: 1,188 base hours at the default settings.
const workbook = quoteTotals(settings, [{ units: 1, hoursHundredths: 118_800 }]);

// The plan's example: 24, 2 x 28 and 16.5 hours, 96.5 in all.
const exampleLines = [
  { units: 1, hoursHundredths: 2400 },
  { units: 2, hoursHundredths: 2800 },
  { units: 1, hoursHundredths: 1650 },
];

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

  it('shows no time buffer or discount rows while both are 0, and no negotiation buffer in the hours', () => {
    const totals = quoteTotals(settings, exampleLines);
    render(<QuoteTotalsPanel settings={settings} totals={totals} lineHours={9650} currencyCode="INR" />);

    expect(valuesOf('Hours', 'From the lines')).toEqual(['96.5 hours']);
    const hours = within(screen.getByRole('region', { name: 'Hours' }));
    expect(hours.getAllByRole('term').map((term) => term.textContent)).toEqual([
      'From the lines',
      'Development, incl. bug fixing',
      'Management',
      'Testing',
    ]);
    expect(hours.queryByText(/buffer/i)).toBeNull();
    const cost = within(screen.getByRole('region', { name: 'Cost' }));
    expect(cost.getAllByRole('term').map((term) => term.textContent)).toEqual([
      'Development',
      'Management',
      'Testing',
      'Subtotal',
      'Negotiation buffer (25%)',
      'Final quote',
    ]);
    // The default example: 96.5 hours and the defaults come to ₹4,64,425.00, as before the two new settings.
    expect(valuesOf('Hours', 'Management')).toEqual(['24.13 hours', '24.13 per person']);
    expect(valuesOf('Cost', 'Subtotal')).toEqual(['₹3,71,540.00']);
    expect(valuesOf('Cost', 'Negotiation buffer (25%)')).toEqual(['₹92,885.00']);
    expect(valuesOf('Cost', 'Final quote')).toEqual(['₹4,64,425.00']);
    expect(screen.queryByText(/Discount/)).toBeNull();
  });

  describe('with a time buffer of 10 % and a discount of 10 %', () => {
    // The service's own figures for these settings and lines (`compute_totals` in the backend), in rupees.
    const padded: CalcSettings = { ...settings, timeBufferBp: 1000, discountBp: 1000 };

    it('shows the hours the buffer adds, the padded hours, everything after them and the discount taken off', () => {
      render(
        <QuoteTotalsPanel
          settings={padded}
          totals={quoteTotals(padded, exampleLines)}
          lineHours={9650}
          currencyCode="INR"
        />,
      );

      const hours = within(screen.getByRole('region', { name: 'Hours' }));
      expect(hours.getAllByRole('term').map((term) => term.textContent)).toEqual([
        'From the lines',
        'Time buffer (10%)',
        'With time buffer',
        'Development, incl. bug fixing',
        'Management',
        'Testing',
      ]);
      expect(valuesOf('Hours', 'From the lines')).toEqual(['96.5 hours']);
      expect(valuesOf('Hours', 'Time buffer (10%)')).toEqual(['+9.65 hours']);
      expect(valuesOf('Hours', 'With time buffer')).toEqual(['106.15 hours']);
      expect(valuesOf('Hours', 'Development, incl. bug fixing')).toEqual(['106.15 hours', '35.38 per person']);
      expect(valuesOf('Hours', 'Management')).toEqual(['26.54 hours', '26.54 per person']);
      expect(valuesOf('Hours', 'Testing')).toEqual(['0 hours', '0 per person']);

      expect(valuesOf('Time', 'Total effort')).toEqual(['132.69 hours']);
      expect(valuesOf('Time', 'Person-days')).toEqual(['22.12', 'at 6 hours a day']);
      expect(valuesOf('Time', 'Elapsed')).toEqual(['0.22 months', 'with 3 developers']);

      const cost = within(screen.getByRole('region', { name: 'Cost' }));
      expect(cost.getAllByRole('term').map((term) => term.textContent)).toEqual([
        'Development',
        'Management',
        'Testing',
        'Subtotal',
        'Negotiation buffer (25%)',
        'Discount (10%)',
        'Final quote',
      ]);
      expect(valuesOf('Cost', 'Development')).toEqual(['₹3,29,065.00']);
      expect(valuesOf('Cost', 'Management')).toEqual(['₹79,620.00']);
      expect(valuesOf('Cost', 'Testing')).toEqual(['₹0.00']);
      expect(valuesOf('Cost', 'Subtotal')).toEqual(['₹4,08,685.00']);
      expect(valuesOf('Cost', 'Negotiation buffer (25%)')).toEqual(['₹1,02,171.25']);
      // A deduction, with a minus sign: 10 % of 5,10,856.25 is 51,085.625, floored to 51,085.62.
      expect(valuesOf('Cost', 'Discount (10%)')).toEqual(['−₹51,085.62']);
      expect(valuesOf('Cost', 'Final quote')).toEqual(['₹4,59,770.63']);
    });

    it('names each percentage as it was typed, and shows the discount alone when only it is set', () => {
      const odd: CalcSettings = { ...settings, timeBufferBp: 1250, discountBp: 750 };
      const { rerender } = render(
        <QuoteTotalsPanel settings={odd} totals={quoteTotals(odd, exampleLines)} lineHours={9650} currencyCode="INR" />,
      );
      expect(screen.getByText('Time buffer (12.5%)', { selector: 'dt' })).toBeInTheDocument();
      expect(screen.getByText('Discount (7.5%)', { selector: 'dt' })).toBeInTheDocument();

      const discountOnly: CalcSettings = { ...settings, discountBp: 1000 };
      rerender(
        <QuoteTotalsPanel
          settings={discountOnly}
          totals={quoteTotals(discountOnly, exampleLines)}
          lineHours={9650}
          currencyCode="INR"
        />,
      );
      expect(screen.queryByText(/Time buffer|With time buffer/)).toBeNull();
      // 10 % of 4,64,425.00 is 46,442.50.
      expect(valuesOf('Cost', 'Discount (10%)')).toEqual(['−₹46,442.50']);
      expect(valuesOf('Cost', 'Final quote')).toEqual(['₹4,17,982.50']);

      const timeBufferOnly: CalcSettings = { ...settings, timeBufferBp: 1000 };
      rerender(
        <QuoteTotalsPanel
          settings={timeBufferOnly}
          totals={quoteTotals(timeBufferOnly, exampleLines)}
          lineHours={9650}
          currencyCode="INR"
        />,
      );
      expect(valuesOf('Hours', 'With time buffer')).toEqual(['106.15 hours']);
      expect(screen.queryByText(/Discount/)).toBeNull();
    });
  });

  it('shows no discount row while the discount comes to no cents, rather than a minus sign before 0.00', () => {
    // 0.01 % of 99.99 is 0.9999 of a cent: the discount is floored to 0, so there is nothing to show as taken off.
    const tiny: CalcSettings = {
      ...settings,
      developerRateCents: 9999,
      managementBp: 0,
      negotiationBufferBp: 0,
      discountBp: 1,
    };
    const totals = quoteTotals(tiny, [{ units: 1, hoursHundredths: 100 }]);
    expect(totals.discountCents).toBe(0);
    render(<QuoteTotalsPanel settings={tiny} totals={totals} lineHours={100} currencyCode="INR" />);
    expect(screen.queryByText(/Discount/)).toBeNull();
    expect(screen.getByRole('region', { name: 'Cost' }).textContent).not.toMatch(/−/);
    expect(valuesOf('Cost', 'Final quote')).toEqual(['₹99.99']);
  });

  it('lays its sections side by side from `md`, and one under another in the column beside the lines from `xl`', () => {
    render(<QuoteTotalsPanel settings={settings} totals={workbook} lineHours={118_800} currencyCode="INR" />);
    const sections = screen.getByRole('region', { name: 'Time' }).parentElement;
    expect(sections).toContainElement(screen.getByRole('region', { name: 'Cost' }));
    expect(sections).toHaveClass('grid', 'md:grid-cols-3', 'xl:grid-cols-1');
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
    expect(screen.queryByText(/With time buffer|Time buffer|Discount/)).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(/NaN|₹/);
  });
});
