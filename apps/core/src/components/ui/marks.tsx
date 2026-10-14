import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

type SvgProps = Omit<ComponentProps<'svg'>, 'children'>;

/** A short bar at 45 degrees: the logo's offset arm. It rests in the colour it is given. */
export function Arm({ className, ...props }: ComponentProps<'span'>) {
  return <span aria-hidden="true" className={cn('arm', className)} {...props} />;
}

/** The arm that swings into an arrow when its link or button is hovered or focused (see styles.css). */
export function ArmArrow({ className, ...props }: SvgProps) {
  return (
    <svg
      className={cn('arm-arrow', className)}
      width="1.25em"
      height="1.25em"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <g className="arm-arrow__shaft">
        <path d="M4 12h16" stroke="currentColor" strokeWidth="2.6" strokeLinecap="butt" />
      </g>
      <path
        className="arm-arrow__head"
        d="M14.5 6.5 20 12l-5.5 5.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="square"
      />
    </svg>
  );
}

export function CheckMark({ className, ...props }: SvgProps) {
  return (
    <svg className={cn('size-4', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false" {...props}>
      <path d="M4 12.5 9.5 18 20 6.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="square" />
    </svg>
  );
}

export function ChevronDownMark({ className, ...props }: SvgProps) {
  return (
    <svg className={cn('size-4', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false" {...props}>
      <path d="m5 9 7 7 7-7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="square" />
    </svg>
  );
}

export function CloseMark({ className, ...props }: SvgProps) {
  return (
    <svg className={cn('size-4', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false" {...props}>
      <path d="m5 5 14 14M19 5 5 19" stroke="currentColor" strokeWidth="2.6" strokeLinecap="square" />
    </svg>
  );
}
