import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/page-header';
import { Panel } from '@/components/ui/panel';
import { PlannedMeta, PlannedSections } from './planned-parts';
import { PLANNED } from './registry';

const titleLink =
  'inline-flex min-h-11 items-center decoration-teal decoration-2 underline-offset-[0.25em] hover:underline focus-visible:underline';

/** Everything that is described but not built, in the order it is suggested to build it. */
export function PlannedPage() {
  return (
    <>
      <PageHeader title="Planned" />
      <p className="mb-8 max-w-[64ch] text-body text-navy-80">
        Work that is described but not built. Each page says what it will do, what it builds on and what is still to
        decide. The order is the one to build in, because later pieces store or read the money that the earlier ones
        change.
      </p>
      <ol aria-label="Suggested build order" className="grid gap-6">
        {PLANNED.map((spec, index) => (
          <li key={spec.id} aria-labelledby={`planned-${spec.id}`}>
            <Panel className="grid gap-4 p-6">
              <div className="flex items-baseline gap-4">
                <span aria-hidden="true" className="tabular text-title font-semibold text-navy-72">
                  {index + 1}
                </span>
                <h2 id={`planned-${spec.id}`} className="text-title font-semibold">
                  {spec.surface === 'page' ? (
                    <Link to={`/planned/${spec.id}`} className={titleLink}>
                      {spec.title}
                    </Link>
                  ) : (
                    spec.title
                  )}
                </h2>
              </div>
              <p className="max-w-[64ch] text-body">{spec.summary}</p>
              <PlannedMeta spec={spec} />
              {spec.surface === 'none' ? <PlannedSections spec={spec} level={3} /> : null}
            </Panel>
          </li>
        ))}
      </ol>
    </>
  );
}
