import { Link, type LinkProps } from 'react-router-dom';
import { ArmArrow } from '@/components/ui/marks';
import { cn } from '@/lib/utils';

/** A section's onward link: the label, then the arm that swings into an arrow on hover and focus. */
export function LinkArrow({ className, children, ...props }: LinkProps) {
  return (
    <Link
      className={cn('inline-flex min-h-11 items-center gap-[0.55em] font-semibold text-foreground', className)}
      {...props}
    >
      {children}
      <ArmArrow className="size-[1.35em]" />
    </Link>
  );
}
