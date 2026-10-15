import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { PlannedMeta, PlannedSections } from './planned-parts';
import type { PlannedSpec } from './types';

const backLink =
  'mb-4 inline-flex min-h-11 items-center font-semibold decoration-teal decoration-2 underline-offset-[0.25em] hover:underline focus-visible:underline';

/** The skeleton page of a piece that is described but not built. Replace this with the real page when it is picked up. */
export function PlannedFeature({ spec, actions }: { spec: PlannedSpec; actions?: ReactNode }) {
  return (
    <>
      <Link to="/planned" className={backLink}>
        All planned work
      </Link>
      <PageHeader title={spec.title}>{actions}</PageHeader>
      <div className="mb-8 grid max-w-[64ch] justify-items-start gap-3">
        <Badge variant="outline">Planned, not built yet</Badge>
        <p className="text-statement">{spec.summary}</p>
        <PlannedMeta spec={spec} />
      </div>
      <PlannedSections spec={spec} level={2} />
    </>
  );
}
