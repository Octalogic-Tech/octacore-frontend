import { Component, type ReactNode } from 'react';
import { buttonVariants } from '@/components/ui/button';

interface ErrorBoundaryState {
  failed: boolean;
}

/** A page that throws (for example on a row missing a field) must not take the whole app down with it. */
export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="grid justify-items-start gap-2 border-t border-navy pt-4">
        <p className="text-body">
          Something went wrong showing this page. The data may not be in the shape the app expects.
        </p>
        <a href={window.location.href} className={buttonVariants({ variant: 'quiet' })}>
          Reload this page
        </a>
      </div>
    );
  }
}
