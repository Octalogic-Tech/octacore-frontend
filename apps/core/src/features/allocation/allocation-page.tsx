import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AllocationBoard } from './allocation-board';
import { AllocationLedger } from './allocation-ledger';

// The page's tabs, in order. The chosen one is the `tab` in the address, so a reload, Back or a link lands on it.
const TABS = ['board', 'ledger'] as const;
type Tab = (typeof TABS)[number];
const tabOf = (value: string | null): Tab => TABS.find((tab) => tab === value) ?? 'board';

/** Where everyone is today (the board), and the dated history behind it (the ledger). */
export function AllocationPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = tabOf(searchParams.get('tab'));

  // The board is the bare address; the ledger is `?tab=`. Replacing the entry keeps Back for leaving the page.
  function showTab(next: string) {
    setSearchParams(next === 'board' ? {} : { tab: next }, { replace: true });
  }

  return (
    <>
      <PageHeader title="Allocation" />

      <Tabs value={tab} onValueChange={showTab}>
        <TabsList aria-label="Allocation sections">
          <TabsTrigger value="board">Board</TabsTrigger>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
        </TabsList>

        <TabsContent value="board">
          <AllocationBoard />
        </TabsContent>

        <TabsContent value="ledger">
          <AllocationLedger />
        </TabsContent>
      </Tabs>
    </>
  );
}
