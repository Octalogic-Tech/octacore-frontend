import { PageHeader } from '@/components/page-header';
import { LinkArrow } from '@/components/ui/link-arrow';

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Page not found" />
      <p className="mb-4 max-w-[66ch] text-body text-navy-80">That address does not match a page in this app.</p>
      <LinkArrow to="/">Go to Overview</LinkArrow>
    </>
  );
}
