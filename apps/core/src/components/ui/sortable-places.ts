import type { UniqueIdentifier } from '@dnd-kit/core';

/**
 * The places of `sortable.tsx`: where a group or an item is, where a held item goes, and the place one step up or down,
 * worked out on the ids alone. Kept apart from the components so the drag and drop's rules read on their own.
 */

/** Where a group or an item is, from 0: a group's place has no `index`. */
export interface SortablePlace {
  group: number;
  index?: number;
}

/** The group or item being dragged, and where it was picked up. */
export interface SortableDrag {
  id: string;
  kind: 'group' | 'item';
  from: SortablePlace;
}

/** A change for the caller to make to `value`. An item's `to.index` is its final position in that group. */
export type SortableMove =
  | { kind: 'group'; id: string; from: number; to: number }
  | { kind: 'item'; id: string; from: { group: number; index: number }; to: { group: number; index: number } };

/** What a screen reader is told, in the caller's words. */
export interface SortableAnnouncements {
  pickedUp: (drag: SortableDrag) => string;
  moved: (drag: SortableDrag, to: SortablePlace) => string;
  dropped: (drag: SortableDrag, to: SortablePlace) => string;
  cancelled: (drag: SortableDrag) => string;
}

export type Groups = Record<string, readonly string[]>;
export type Spot = { kind: 'group'; group: number } | { kind: 'item'; group: number; index: number };

export const placeText = (place: SortablePlace) =>
  place.index === undefined ? `position ${place.group + 1}` : `group ${place.group + 1}, position ${place.index + 1}`;

export const defaultAnnouncements: SortableAnnouncements = {
  pickedUp: ({ kind, from }) => `Picked up the ${kind} at ${placeText(from)}.`,
  moved: ({ kind }, to) => `Moved the ${kind} to ${placeText(to)}.`,
  dropped: ({ kind }, to) => `Dropped the ${kind} at ${placeText(to)}.`,
  cancelled: ({ kind, from }) => `Cancelled. The ${kind} is back at ${placeText(from)}.`,
};

export function locate(groups: Groups, id: UniqueIdentifier | null | undefined): Spot | null {
  if (id === null || id === undefined) return null;
  const key = String(id);
  const names = Object.keys(groups);
  const group = names.indexOf(key);
  if (group !== -1) return { kind: 'group', group };
  for (const [position, name] of names.entries()) {
    const index = groups[name].indexOf(key);
    if (index !== -1) return { kind: 'item', group: position, index };
  }
  return null;
}

export const placeOf = (spot: Spot): SortablePlace =>
  spot.kind === 'group' ? { group: spot.group } : { group: spot.group, index: spot.index };
export const samePlace = (a: SortablePlace | null, b: SortablePlace | null) =>
  a !== null && b !== null && a.group === b.group && a.index === b.index;

/**
 * Where a held item goes when it is over `over`: its own place in its own group (or, over an item there, that item's),
 * or, in another group, before the item it is over (after it when `below`), at the start of a group below it or at the
 * end of a group above it.
 */
export function itemTarget(groups: Groups, active: Spot & { kind: 'item' }, over: Spot, below: boolean) {
  const names = Object.keys(groups);
  if (over.group === active.group) {
    return { group: active.group, index: over.kind === 'item' ? over.index : active.index };
  }
  if (over.kind === 'item') return { group: over.group, index: over.index + (below ? 1 : 0) };
  return { group: over.group, index: over.group > active.group ? 0 : groups[names[over.group]].length };
}

/** The id one place up (`step` -1) or down (+1) from where the held group or item now is, if there is one. */
export function keyboardTarget(groups: Groups, activeId: string, overId: string | null, step: number): string | null {
  const names = Object.keys(groups);
  const active = locate(groups, activeId);
  if (!active) return null;
  const over = locate(groups, overId);
  if (active.kind === 'group') {
    const at = over?.kind === 'group' ? over.group : active.group;
    return names[at + step] ?? null;
  }
  const items = groups[names[active.group]];
  const at = over?.kind === 'item' && over.group === active.group ? over.index : active.index;
  const next = at + step;
  if (next >= 0 && next < items.length) return items[next];
  return names[active.group + step] ?? null;
}
