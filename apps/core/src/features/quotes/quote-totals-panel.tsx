import type { ReactNode } from 'react';
import { Panel } from '@/components/ui/panel';
import { formatMoney } from '@/features/expenses/money';
import { cn } from '@/lib/utils';
import { formatHours, type CalcSettings, type QuoteTotals } from './calc';

interface QuoteTotalsPanelProps {
  /** Null while any setting is invalid: then there are no totals to show, only the hours from the lines. */
  settings: CalcSettings | null;
  totals: QuoteTotals | null;
  /** The lines' own hours (units x hours per unit, valid lines only), in hundredths. Known whatever the settings. */
  lineHours: number;
  /** The quote's currency, in capitals. Only read while the settings, the currency among them, are valid. */
  currencyCode: string;
}

/** A true minus sign, for a figure taken off: a hyphen reads as a dash. */
const MINUS = '\u2212';

/** Hundredths of something counted, with its noun: `1 hour`, `2.5 hours`, `0 months`. */
function counted(hundredths: number, noun: string) {
  return `${formatHours(hundredths)} ${hundredths === 100 ? noun : `${noun}s`}`;
}

/** A label, its value and an optional line under the value, as one entry of a description list. */
function Row({ label, value, note, strong }: { label: string; value: ReactNode; note?: string; strong?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 border-b border-rule-soft py-2 last:border-b-0">
      <dt className={cn('text-small', strong && 'font-semibold')}>{label}</dt>
      <dd className={cn('tabular text-right', strong ? 'text-title font-semibold' : 'text-small')}>{value}</dd>
      {note ? <dd className="basis-full text-right text-small text-navy-72">{note}</dd> : null}
    </div>
  );
}

/** A titled list of rows, a region named by its heading. */
function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid gap-1">
      <h2 id={id} className="text-small font-semibold text-navy-80">
        {title}
      </h2>
      <dl>{children}</dl>
    </section>
  );
}

/**
 * The quote's totals as the form stands: the time it takes, the hours by role and the cost ending in the final quote.
 * It never shows a total worked out from a blank or wrong setting: those are replaced by a note to check the settings.
 */
export function QuoteTotalsPanel({ settings, totals, lineHours, currencyCode }: QuoteTotalsPanelProps) {
  const ready = settings !== null && totals !== null;
  const money = (minor: number) => formatMoney(minor, { currencyCode, currencySymbol: currencyCode });

  return (
    <Panel>
      {/* One column in the narrow column beside the lines (`xl`); under them, the sections side by side from `md`. */}
      <div className="grid items-start gap-6 p-6 md:grid-cols-3 xl:grid-cols-1">
        {ready ? (
          <Section id="quote-totals-time" title="Time">
            <Row label="Total effort" value={counted(totals.totalHours, 'hour')} />
            <Row
              label="Person-days"
              value={formatHours(totals.personDays)}
              note={`at ${counted(settings.hoursPerDay * 100, 'hour')} a day`}
            />
            <Row
              label="Elapsed"
              value={counted(totals.elapsedMonths, 'month')}
              note={`with ${settings.developerCount} ${settings.developerCount === 1 ? 'developer' : 'developers'}`}
            />
          </Section>
        ) : null}

        <Section id="quote-totals-hours" title="Hours">
          <Row label="From the lines" value={counted(lineHours, 'hour')} />
          {/* The padded hours, with what the time buffer added; with no time buffer they are the lines' own. */}
          {ready && settings.timeBufferBp > 0 ? (
            <>
              <Row
                label={`Time buffer (${settings.timeBufferBp / 100}%)`}
                value={`+${counted(totals.timeBufferHours, 'hour')}`}
              />
              <Row label="With time buffer" value={counted(totals.bufferedBaseHours, 'hour')} />
            </>
          ) : null}
          {ready ? (
            <>
              <Row
                label="Development, incl. bug fixing"
                value={counted(totals.developmentHours, 'hour')}
                note={`${formatHours(totals.developmentHoursPerPerson)} per person`}
              />
              <Row
                label="Management"
                value={counted(totals.managementHours, 'hour')}
                note={`${formatHours(totals.managementHoursPerPerson)} per person`}
              />
              <Row
                label="Testing"
                value={counted(totals.testingHours, 'hour')}
                note={`${formatHours(totals.testingHoursPerPerson)} per person`}
              />
            </>
          ) : null}
        </Section>

        {ready ? (
          <Section id="quote-totals-cost" title="Cost">
            <Row label="Development" value={money(totals.developmentCostCents)} />
            <Row label="Management" value={money(totals.managementCostCents)} />
            <Row label="Testing" value={money(totals.testingCostCents)} />
            <Row label="Subtotal" value={money(totals.subtotalCents)} />
            <Row
              label={`Negotiation buffer (${settings.negotiationBufferBp / 100}%)`}
              value={money(totals.negotiationBufferCents)}
            />
            {settings.discountBp > 0 ? (
              <Row
                label={`Discount (${settings.discountBp / 100}%)`}
                value={`${MINUS}${money(totals.discountCents)}`}
              />
            ) : null}
            <Row label="Final quote" value={money(totals.finalQuoteCents)} strong />
          </Section>
        ) : (
          <p className="text-small font-semibold text-foreground">Check the settings to see the totals.</p>
        )}
      </div>
    </Panel>
  );
}
