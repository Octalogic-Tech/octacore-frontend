import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { SidebarNav } from '@/app/sidebar-nav';
import { ErrorBoundary } from '@/components/error-boundary';
import { Logo, LogoMark } from '@/components/logo';
import { Sheet, SheetContent } from '@/components/ui/sheet';

/** A navy sidebar from 1024px; below that a header with a menu button that opens the same navigation in a sheet. */
export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <aside className="on-navy hidden bg-navy text-on-navy lg:block">
        <div className="sticky top-0 h-dvh overflow-y-auto">
          <SidebarNav />
        </div>
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-rule px-5 md:px-8 lg:hidden">
          <Link to="/" aria-label="Octalogic Tech home" className="inline-flex min-h-11 items-center">
            <Logo height={30} className="hidden sm:inline-flex" />
            <LogoMark height={34} className="sm:hidden" />
          </Link>
          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
            className="grid size-11 place-content-center gap-1.5 bg-navy"
          >
            <span aria-hidden="true" className="block h-0.5 w-5 bg-on-navy" />
            <span aria-hidden="true" className="block h-0.5 w-5 bg-on-navy" />
          </button>
        </header>
        <main id="main" className="mx-auto w-full max-w-[75rem] flex-1 px-5 py-8 md:px-8 lg:py-12 xl:px-10">
          <ErrorBoundary key={pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent title="Menu">
          <SidebarNav onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
