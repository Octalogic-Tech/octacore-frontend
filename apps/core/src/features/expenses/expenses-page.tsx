import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { localToday } from '@/lib/format';
import { isMonth, monthOf } from './months';
import { OneTimeTab } from './one-time-tab';
import { OverviewTab } from './overview-tab';
import { RecurringTab } from './recurring-tab';

// The page's tabs, in order. The chosen one is the `tab` in the address, so a reload, Back or a link lands on it.
const TABS = ['overview', 'one-time', 'recurring'] as const;
type Tab = (typeof TABS)[number];

const tabOf = (value: string | null): Tab => TABS.find((tab) => tab === value) ?? 'overview';

/** All the company's spending in one place: a month at a glance, the one-off expenses, and the ones that repeat. */
export function ExpensesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = tabOf(searchParams.get('tab'));
  // Read each render, so "this month" follows the date without a reload.
  const thisMonth = monthOf(localToday());
  const requested = searchParams.get('month');
  const month = isMonth(requested) ? requested : thisMonth;

  // The Overview is the bare address; every other tab is `?tab=`. Replacing the entry keeps Back for leaving the page.
  function showTab(next: string) {
    setSearchParams(next === 'overview' ? {} : { tab: next }, { replace: true });
  }

  // The month on the Overview is `?month=`, left out for this month.
  function showMonth(next: string) {
    setSearchParams(next === thisMonth ? {} : { month: next }, { replace: true });
  }

  return (
    <>
      <PageHeader title="Expenses" />
      <Tabs value={tab} onValueChange={showTab}>
        <TabsList aria-label="Expense sections">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="one-time">One-time</TabsTrigger>
          <TabsTrigger value="recurring">Recurring</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <OverviewTab month={month} thisMonth={thisMonth} onMonthChange={showMonth} />
        </TabsContent>
        <TabsContent value="one-time">
          <OneTimeTab />
        </TabsContent>
        <TabsContent value="recurring">
          <RecurringTab />
        </TabsContent>
      </Tabs>
    </>
  );
}
