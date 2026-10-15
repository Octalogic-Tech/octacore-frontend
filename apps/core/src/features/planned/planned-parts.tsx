import { PLANNED } from './registry';
import type { PlannedSpec } from './types';

const titleOf = (id: string) => PLANNED.find((spec) => spec.id === id)?.title ?? id;

/** Size, where it will live, and what to build first, in one line so it reads as one fact. */
export function PlannedMeta({ spec }: { spec: PlannedSpec }) {
  const after = spec.needs.length > 0 ? ` · Build after: ${spec.needs.map(titleOf).join(', ')}` : '';
  return (
    <p className="text-small text-navy-80">{`Size ${spec.size} · Lives in ${spec.home}${after}`}</p>
  );
}

function Section({ level, title, items }: { level: 2 | 3; title: string; items: string[] }) {
  const Heading = level === 2 ? 'h2' : 'h3';
  return (
    <section>
      <Heading className="mb-2 text-title font-semibold">{title}</Heading>
      <ul className="grid max-w-[64ch] list-disc gap-2 pl-5 text-body">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

/** The three lists that describe a piece. `level` is the heading level: 2 on its own page, 3 inside an index card. */
export function PlannedSections({ spec, level }: { spec: PlannedSpec; level: 2 | 3 }) {
  return (
    <div className="grid gap-8">
      <Section level={level} title="What it will do" items={spec.does} />
      <Section level={level} title="Builds on" items={spec.buildsOn} />
      <Section level={level} title="Open decisions" items={spec.decisions} />
    </div>
  );
}
