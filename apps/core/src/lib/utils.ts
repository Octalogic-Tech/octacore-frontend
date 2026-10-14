import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// The app's own font-size tokens (see styles.css) must be known to tailwind-merge,
// or `text-lead` would be read as a colour and dropped next to `text-navy`.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['headline', 'title', 'statement', 'lead', 'body', 'small'] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
