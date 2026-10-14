import logoSvg from '@/assets/brand/logo.svg?raw';
import markSvg from '@/assets/brand/logo-mark.svg?raw';
import { cn } from '@/lib/utils';

// The supplied SVGs, inlined. Never redraw or recolour: on navy the stylesheet applies the approved
// reversal (white wordmark and mark, the offset arm keeps its teal). The artwork is a trusted repo asset.
const clean = (svg: string) => svg.replace(/<\?xml[^>]*>\s*/, '').replace(/\s(id|data-name)="[^"]*"/g, '');

interface LogoProps {
  /** Rendered height in px of the artwork. */
  height?: number;
  className?: string;
}

const LOCKUP_ASPECT = 2711.13 / 563.93;
const MARK_ASPECT = 569.93 / 566.6;

export function Logo({ height = 32, className }: LogoProps) {
  const svg = clean(logoSvg).replace(
    '<svg ',
    `<svg aria-hidden="true" focusable="false" height="${height}" width="${Math.round(height * LOCKUP_ASPECT)}" `,
  );
  return <span className={cn('logo inline-flex leading-[0]', className)} dangerouslySetInnerHTML={{ __html: svg }} />;
}

export function LogoMark({ height = 32, className }: LogoProps) {
  const svg = clean(markSvg).replace(
    '<svg ',
    `<svg aria-hidden="true" focusable="false" height="${height}" width="${Math.round(height * MARK_ASPECT)}" `,
  );
  return <span className={cn('logo inline-flex leading-[0]', className)} dangerouslySetInnerHTML={{ __html: svg }} />;
}
