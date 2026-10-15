import { useId, useState } from 'react';
import { useAuth } from '@/features/auth/auth-context';
import { ChangePasswordDialog } from '@/features/auth/change-password-dialog';

const action = 'min-h-11 text-left text-body font-medium text-on-navy-muted transition-colors hover:text-on-navy';

/** Who is signed in, and the two things they can do about it. It sits at the foot of the sidebar and the phone menu. */
export function AccountBlock() {
  const { user, signOut } = useAuth();
  const [passwordOpen, setPasswordOpen] = useState(false);
  // The desktop sidebar and the phone menu can both render this block, so the id cannot be a fixed string.
  const openerId = useId();

  if (!user) return null;

  return (
    <section aria-label="Account" className="border-t border-rule-on-navy pt-6">
      <p className="text-small text-on-navy-muted">Signed in as</p>
      <p className="text-body font-semibold text-on-navy">{user.name}</p>
      <p className="break-all text-small text-on-navy-muted">{user.email}</p>
      <div className="mt-3 grid justify-items-start">
        <button type="button" id={openerId} className={action} onClick={() => setPasswordOpen(true)}>
          Change password
        </button>
        <button type="button" className={action} onClick={() => void signOut()}>
          Sign out
        </button>
      </div>
      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} openerId={openerId} />
    </section>
  );
}
