import { usePeople } from '@/features/people/api';
import { formatCurrency, pluralize } from '@/lib/format';
import type { ResourceRow } from './schema';
import { teamMargin } from './team-margin';

function Figure({ amount }: { amount: number }) {
  return <span className="tabular font-semibold">{formatCurrency(amount)}</span>;
}

/**
 * What the retainer's team bills a month against what its people are paid, in one sentence, with the rule it was worked
 * out by. Only the total is shown, never one person's salary.
 */
export function TeamMarginNote({ resources }: { resources: readonly ResourceRow[] }) {
  const people = usePeople();
  if (people.isLoading) return null;
  if (people.data === undefined) return <p className="mt-4 text-small text-navy-72">Salaries could not be loaded.</p>;

  const margin = teamMargin(resources, people.data);
  return (
    <div className="mt-4 grid max-w-[64ch] gap-1">
      <p className="text-body">
        {margin.counted === 0 ? (
          'No margin yet: none of these resources has a person with a salary and a Qty of 1.'
        ) : (
          <>
            At current salaries, {margin.counted} of {pluralize(margin.total, 'resource')}{' '}
            {margin.counted === 1 ? 'bills' : 'bill'} <Figure amount={margin.billed} /> a month against{' '}
            <Figure amount={margin.cost} /> in salary: {margin.margin >= 0 ? 'a margin' : 'a shortfall'} of{' '}
            <Figure amount={Math.abs(margin.margin)} />
            {margin.percent === null ? null : ` (${margin.percent}%)`}.
          </>
        )}
      </p>
      <p className="text-small text-navy-72">
        Salary is today’s figure, not what was paid. Resources with no person, no salary or a Qty above 1 are left out.
      </p>
    </div>
  );
}
