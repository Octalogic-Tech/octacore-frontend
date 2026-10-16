import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDownMark } from '@/components/ui/marks';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuth } from '@/features/auth/auth-context';
import { ChangePasswordDialog } from '@/features/auth/change-password-dialog';
import { cn } from '@/lib/utils';

/** The first letter of the first and last word of a name: "Grace Murray Hopper" is "GH", "Madonna" is "M". */
function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0], words[words.length - 1]] : words.slice(0, 1);
  return letters.map((word) => Array.from(word)[0]).join('').toUpperCase();
}

/** Who is signed in, as a name and an avatar. It opens the two things they can do about it. It sits at the foot of the sidebar and the phone menu. */
export function AccountBlock() {
  const { user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  // The desktop sidebar and the phone menu can both render this block, so the id cannot be a fixed string.
  const triggerId = useId();

  if (!user) return null;

  return (
    <section aria-label="Account" className="border-t border-rule-on-navy pt-6">
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger
          id={triggerId}
          className="group/account flex min-h-11 w-full items-center gap-3 text-left text-body font-semibold text-on-navy"
        >
          <span
            aria-hidden="true"
            className="grid size-9 flex-none place-items-center bg-navy-deep text-small font-semibold text-on-navy"
          >
            {initials(user.name)}
          </span>
          <span className="min-w-0 flex-1 truncate">{user.name}</span>
          <ChevronDownMark
            className={cn(
              'flex-none rotate-180 text-on-navy-muted transition-colors group-hover/account:text-on-navy',
              menuOpen && 'text-on-navy',
            )}
          />
        </PopoverTrigger>
        <PopoverContent side="top" align="start" aria-label="Account options">
          <p className="break-all px-3 pb-2 pt-1 text-small text-navy-80">{user.email}</p>
          <div className="grid">
            <Button
              variant="quiet"
              className="w-full justify-start"
              onClick={() => {
                setMenuOpen(false);
                setPasswordOpen(true);
              }}
            >
              Change password
            </Button>
            <Button variant="quiet" className="w-full justify-start" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} openerId={triggerId} />
    </section>
  );
}
