import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/page-header';
import { QueryBoundary } from '@/components/query-boundary';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { LinkArrow } from '@/components/ui/link-arrow';
import { Panel } from '@/components/ui/panel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAllocations } from '@/features/allocation/api';
import { AllocationFormDialog } from '@/features/allocation/allocation-form-dialog';
import { AllocationLedger } from '@/features/allocation/allocation-ledger';
import { useLeaves } from '@/features/leave/api';
import { LeaveTable } from '@/features/leave/leave-table';
import { useProjects } from '@/features/projects/api';
import { statusOf } from '@/lib/core-api';
import { localToday } from '@/lib/format';
import { useDeletePerson, usePerson } from './api';
import { PersonFormDialog } from './person-form-dialog';
import { PersonOverview } from './person-overview';
import { placementOf } from './placement';

const INT32_MAX = 2_147_483_647;

// The focus fallback for every dialog on this page: <main> is not focusable, and Edit person is always there.
const EDIT_ID = 'edit-person';

// The page's tabs, in order. The chosen one is the `tab` in the address, so a reload, Back or a link lands on it.
const TABS = ['overview', 'allocations', 'leave'] as const;
type Tab = (typeof TABS)[number];
const tabOf = (value: string | null): Tab => TABS.find((tab) => tab === value) ?? 'overview';

const backLink =
  'mb-4 inline-flex min-h-11 items-center font-semibold decoration-teal decoration-2 underline-offset-[0.25em] hover:underline focus-visible:underline';

function PersonNotFound() {
  return (
    <>
      <PageHeader title="Person not found" />
      <Panel>
        <div className="grid justify-items-start gap-2 p-6">
          <p className="text-body">This person does not exist, or they were deleted.</p>
          <LinkArrow to="/resources/people">Back to people</LinkArrow>
        </div>
      </Panel>
    </>
  );
}

/** A tab's name with how many it holds, once that is known: "Leave 2". */
function TabLabel({ label, count }: { label: string; count?: number }) {
  if (count === undefined) return label;
  return (
    <>
      {label} <span className="tabular ml-1.5 font-normal">{count}</span>
    </>
  );
}

/** One person: where they are now and who they are (Overview), their allocation history and their leave. */
export function PersonDetailPage() {
  const { id = '' } = useParams();
  // Only a plain positive integer the service could hold is worth asking about; anything else is not a person.
  const personId = /^[1-9]\d{0,9}$/.test(id) ? Number(id) : 0;
  if (personId < 1 || personId > INT32_MAX) return <PersonNotFound />;
  return <PersonDetail personId={personId} />;
}

function PersonDetail({ personId }: { personId: number }) {
  const navigate = useNavigate();
  const person = usePerson(personId);
  // The same queries the tabs read, so this only adds where they are now and the counts in the tabs' names.
  const entries = useAllocations({ personId });
  const leaves = useLeaves({ personId });
  const projects = useProjects();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = tabOf(searchParams.get('tab'));
  const removePerson = useDeletePerson();
  const [personForm, setPersonForm] = useState(false);
  const [allocating, setAllocating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const data = person.data;
  const today = localToday();
  const placement = useMemo(() => {
    if (!data) return null;
    if (entries.isError || projects.isError) return 'unavailable' as const;
    if (!entries.data || !projects.data) return null;
    return placementOf({ person: data, projects: projects.data, entries: entries.data, today });
  }, [data, entries.data, entries.isError, projects.data, projects.isError, today]);

  if (statusOf(person.error) === 404) return <PersonNotFound />;

  // The overview is the bare address; every other tab is `?tab=`. Replacing the entry keeps Back for leaving the page.
  function showTab(next: string) {
    setSearchParams(next === 'overview' ? {} : { tab: next }, { replace: true });
  }

  return (
    <>
      <Link to="/resources/people" className={backLink}>
        Back to people
      </Link>
      <PageHeader title={data?.name ?? 'Person'}>
        {data ? (
          <>
            <Button id={EDIT_ID} variant="quiet" onClick={() => setPersonForm(true)}>
              Edit person
            </Button>
            <Button variant="quiet" onClick={() => setDeleting(true)}>
              Delete person
            </Button>
          </>
        ) : null}
      </PageHeader>

      <QueryBoundary
        isLoading={person.isLoading}
        isError={person.isError}
        onRetry={() => {
          void person.refetch();
          void entries.refetch();
          void leaves.refetch();
          void projects.refetch();
        }}
        isEmpty={false}
        empty={null}
      >
        {data ? (
          <Tabs value={tab} onValueChange={showTab}>
            <TabsList aria-label="Person sections">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="allocations">
                <TabLabel label="Allocations" count={entries.data?.length} />
              </TabsTrigger>
              <TabsTrigger value="leave">
                <TabLabel label="Leave" count={leaves.data?.length} />
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <PersonOverview person={data} placement={placement} onAllocate={() => setAllocating(true)} />
            </TabsContent>

            <TabsContent value="allocations">
              <AllocationLedger personId={personId} />
            </TabsContent>

            <TabsContent value="leave">
              <LeaveTable personId={personId} />
            </TabsContent>
          </Tabs>
        ) : null}
      </QueryBoundary>

      <PersonFormDialog open={personForm} onOpenChange={setPersonForm} person={data} fallbackFocusId={EDIT_ID} />

      <AllocationFormDialog
        open={allocating}
        onOpenChange={setAllocating}
        personId={personId}
        fallbackFocusId={EDIT_ID}
      />

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete person “${data?.name ?? ''}”?`}
        description="Project resources that name this person keep their own name and rate but lose the link to them. Their allocation entries and leaves are deleted with them. This cannot be undone."
        confirmLabel="Delete person"
        fallbackFocusId={EDIT_ID}
        onConfirm={async () => {
          await removePerson.mutateAsync(personId);
          navigate('/resources/people');
        }}
      />
    </>
  );
}
