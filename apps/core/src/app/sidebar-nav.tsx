import { Link, NavLink } from 'react-router-dom';
import { AccountBlock } from '@/app/account-block';
import { NAV_GROUPS } from '@/app/nav';
import { Logo } from '@/components/logo';
import { Arm } from '@/components/ui/marks';
import { useAuth } from '@/features/auth/auth-context';
import { cn } from '@/lib/utils';

/** The one navigation: the logo, then groups of text links. The current page carries a teal arm. The account block sits under it. */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth();
  const groups = NAV_GROUPS.filter((group) => !group.roles || (user !== null && group.roles.includes(user.role)));
  return (
    <div className="flex min-h-full flex-1 shrink-0 flex-col px-6 py-8">
      <nav aria-label="Main" className="flex flex-col gap-8">
        <Link to="/" onClick={onNavigate} aria-label="Octalogic Tech home" className="inline-flex min-h-11 items-center">
          <Logo height={30} />
        </Link>
        {groups.map((group, index) => {
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
      <div className="min-h-10 flex-1" />
      <AccountBlock />
    </div>
  );
}
