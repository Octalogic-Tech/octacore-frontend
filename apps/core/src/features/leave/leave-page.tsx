import { PageHeader } from '@/components/page-header';
import { LeaveTable } from './leave-table';

/** Who was away and when: the leave register, with a record of each leave a person took. */
export function LeavePage() {
  return (
    <>
      <PageHeader title="Leave" />
      <LeaveTable />
    </>
  );
}
