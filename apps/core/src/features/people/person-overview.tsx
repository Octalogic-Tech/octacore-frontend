import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/format';
import { formatInr } from '@/lib/money';
import { pluralize } from '@/lib/format';
import type { CardPlacement, Placement } from './placement';
import type { PersonRow } from './schema';

const NONE = '—';

const mailLink =
  'inline-flex min-h-11 items-center decoration-teal decoration-2 underline-offset-[0.25em] hover:underline focus-visible:underline';
const projectLink =
  'font-semibold decoration-teal decoration-2 underline-offset-[0.25em] hover:underline focus-visible:underline';

interface PersonOverviewProps {
  person: PersonRow;
  /**
   * Where they are today. Null while it is being read, and 'unavailable' when it could not be (the entries or the
   * projects failed to load): the facts below do not wait for it.
   */
  placement: Placement | null | 'unavailable';
  onAllocate: () => void;
}

/** The places of several cards, each place once with how many cards are on it: Website, the bench, and so on. */
function places(cards: readonly CardPlacement[]) {
  const grouped: { key: string; project: CardPlacement['project']; count: number }[] = [];
  for (const { project } of cards) {
    const key = project ? `project-${project.id}` : 'bench';
    const found = grouped.find((place) => place.key === key);
    if (found) found.count += 1;
    else grouped.push({ key, project, count: 1 });
  }
  return grouped;
}

/** "Website, Mobile app and the bench": the places in a list, the last after an "and". */
function listOf(items: readonly ReactNode[]): ReactNode {
  return items.map((item, index) => (
    <span key={index}>
      {index === 0 ? '' : index === items.length - 1 ? ' and ' : ', '}
      {item}
    </span>
  ));
}

/** Where the person is, said first, then who they are: contact, dates, pay, contract and what they know. */
function placementSentence(placement: Placement | 'unavailable'): ReactNode {
  if (placement === 'unavailable') return 'Where they are now is unavailable';
  switch (placement.kind) {
    case 'project':
      return (
        <>
          On{' '}
          <Link to={`/projects/${placement.project.id}`} className={projectLink}>
            {placement.project.name}
          </Link>{' '}
          since <span className="tabular font-semibold">{formatDate(placement.since)}</span>
        </>
      );
    case 'bench':
      if (placement.note !== null) return `On the bench. ${placement.note}`;
      return (
        <>
          On the bench since <span className="tabular font-semibold">{formatDate(placement.since ?? '')}</span>
        </>
      );
    case 'several': {
      // A card on a project that is not active is on the bench, and the sentence says which project it was on.
      const notes = placement.cards.flatMap((card) => (card.note === null ? [] : [card.note]));
      return (
        <>
          On{' '}
          {listOf(
            places(placement.cards).map(({ project, count }) => (
              <>
                {project ? (
                  <Link to={`/projects/${project.id}`} className={projectLink}>
                    {project.name}
                  </Link>
                ) : (
                  'the bench'
                )}
                {count > 1 ? ` (${pluralize(count, 'card')})` : null}
              </>
            ))
          )}
          {notes.map((note) => `. ${note}`).join('')}
        </>
      );
    }
    case 'unallocated':
      return 'Not allocated yet';
    case 'left':
      return `Left on ${formatDate(placement.date)}, so not on the board`;
    case 'not-joined':
      return `Joins on ${formatDate(placement.date)}, so not on the board yet`;
  }
}

export function PersonOverview({ person, placement, onAllocate }: PersonOverviewProps) {
  return (
    <>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <p className="max-w-[64ch] text-statement">{placement === null ? null : placementSentence(placement)}</p>
        <Button id="allocate-person" onClick={onAllocate}>
          Allocate
        </Button>
      </div>

      <dl className="mb-6 grid gap-x-12 gap-y-4 sm:grid-cols-3">
        <div>
          <dt className="text-small text-navy-80">Email</dt>
          <dd className="font-semibold">
            {person.email ? (
              <a href={`mailto:${person.email}`} className={mailLink}>
                {person.email}
              </a>
            ) : (
              NONE
            )}
          </dd>
        </div>
        <div>
          <dt className="text-small text-navy-80">Phone</dt>
          <dd className="font-semibold">{person.phone || NONE}</dd>
        </div>
        <div>
          <dt className="text-small text-navy-80">Monthly salary</dt>
          <dd className="tabular font-semibold">
            {person.monthlySalaryPaise === null ? NONE : formatInr(person.monthlySalaryPaise)}
          </dd>
        </div>
        <div>
          <dt className="text-small text-navy-80">Joined</dt>
          <dd className="tabular font-semibold">{person.joinDate ? formatDate(person.joinDate) : NONE}</dd>
        </div>
        <div>
          <dt className="text-small text-navy-80">Left</dt>
          <dd className="tabular font-semibold">{person.leaveDate ? formatDate(person.leaveDate) : NONE}</dd>
        </div>
        <div>
          <dt className="text-small text-navy-80">Contract</dt>
          <dd className="font-semibold">
            {person.contractLink ? (
              <a
                href={person.contractLink}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Contract for ${person.name}`}
                className={mailLink}
              >
                Contract
              </a>
            ) : (
              NONE
            )}
          </dd>
        </div>
        <div className="sm:col-span-3">
          <dt className="text-small text-navy-80">Technologies</dt>
          <dd className="font-semibold">
            {person.technologies.map((technology) => technology.name).join(', ') || NONE}
          </dd>
        </div>
      </dl>
    </>
  );
}
