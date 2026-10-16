import { useRef } from 'react';

/**
 * Radix returns focus to a Trigger when a dialog closes, but this app opens its dialogs from state, so
 * without a Trigger focus would fall to <body> and a keyboard user would lose their place. This returns
 * focus to the element that opened the dialog, or, when that element is gone (a deleted row, an empty
 * state that was replaced, a popover that closed as the dialog opened), to a stable fallback element.
 */
export function useReturnFocus(fallbackId?: string) {
  const opener = useRef<HTMLElement | null>(null);

  return {
    onOpenAutoFocus: () => {
      // Focus on <body> means the opener was already removed: <body> is connected, but it is no place to return to.
      const active = document.activeElement;
      opener.current = active instanceof HTMLElement && active !== document.body ? active : null;
    },
    onCloseAutoFocus: (event: Event) => {
      event.preventDefault();
      const target = opener.current?.isConnected
        ? opener.current
        : fallbackId
          ? document.getElementById(fallbackId)
          : null;
      target?.focus();
    },
  };
}
