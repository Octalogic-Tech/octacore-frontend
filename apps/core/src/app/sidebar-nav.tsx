import { Link, NavLink } from 'react-router-dom';
import { NAV_GROUPS } from '@/app/nav';
import { Logo } from '@/components/logo';
import { Arm } from '@/components/ui/marks';
import { cn } from '@/lib/utils';

/** The one navigation: the logo, then three groups of text links. The current page carries a teal arm. */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-8 px-6 py-8">
      <Link to="/" onClick={onNavigate} aria-label="Octalogic Tech home" className="inline-flex min-h-11 items-center">
        <Logo height={30} />
      </Link>
      {NAV_GROUPS.map((group, index) => {
        const headingId = `nav-group-${index}`;
        return (
          <div key={group.label}>
            <p id={headingId} className="mb-1 text-small font-semibold uppercase tracking-[0.08em] text-on-navy-muted">
              {group.label}
            </p>
            <ul aria-labelledby={headingId}>
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        'group/nav flex min-h-11 items-center gap-3 px-1 text-body font-medium transition-colors',
                        isActive ? 'text-on-navy' : 'text-on-navy-muted hover:text-on-navy',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Arm
                          className={
                            isActive
                              ? 'w-4 text-teal'
                              : 'w-3 text-on-navy-muted group-hover/nav:w-4 group-hover/nav:text-teal'
                          }
                        />
                        {item.label}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
