import { formatUsd } from './money';
import type { StripFigures } from './summary';

interface SummaryStripProps {
  /** Undefined while the summary is loading or has failed: each figure then shows a dash. */
  figures: StripFigures | undefined;
  /** What the active recurring expenses cost per month, in US cents. */
  monthlyRecurring: number | undefined;
}

/** What the company has spent lately and what it commits to each month, in US dollars. */
export function SummaryStrip({ figures, monthlyRecurring }: SummaryStripProps) {
  const items = [
    { label: 'This month', value: figures?.thisMonth },
    { label: 'Last month', value: figures?.lastMonth },
    { label: 'Year to date', value: figures?.yearToDate },
    { label: 'Recurring per month', value: monthlyRecurring },
  ];
  return (
    <dl aria-label="Spend at a glance" className="mb-6 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(({ label, value }) => (
        <div key={label}>
          <dt className="text-small text-navy-72">{label}</dt>
          <dd className="tabular text-title font-semibold">{value === undefined ? '—' : formatUsd(value)}</dd>
        </div>
      ))}
    </dl>
  );
}
