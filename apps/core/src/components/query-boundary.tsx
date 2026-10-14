import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface QueryBoundaryProps {
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  isEmpty: boolean;
  empty: ReactNode;
  children: ReactNode;
}

function LoadingRows() {
  return (
    <div role="status" aria-label="Loading" className="grid gap-px p-4">
      <span className="sr-only">Loading</span>
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="h-11 bg-secondary" />
      ))}
    </div>
  );
}

/** Every data view passes through here, so a failed or empty request is never a blank panel. */
export function QueryBoundary({ isLoading, isError, onRetry, isEmpty, empty, children }: QueryBoundaryProps) {
  if (isLoading) return <LoadingRows />;
  if (isError) {
    return (
      <div role="alert" className="grid justify-items-start gap-2 p-6">
        <p className="text-body">We could not load this data. Check that the API is running, then try again.</p>
        <Button variant="quiet" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }
  if (isEmpty) return <div className="p-6">{empty}</div>;
  return children;
}
