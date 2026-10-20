/**
 * A sortable list of groups of items, in the manner of Dice UI's Sortable (`@diceui/sortable` in the shadcn registry) and
 * built the way `kanban.tsx` is, on dnd-kit: groups that can be put in a new order, and items that can be put in a new
 * order inside their group or moved to another one (an empty one too). A single list is one group.
 *
 * - `Sortable`: the root. `value` maps each group's id to its items' ids, in order (the keys' order is the groups'
 *   order). It owns nothing: every move is handed to `onMove`, and the caller changes `value`.
 * - `SortableContent`: the element that holds the groups.
 * - `SortableGroup`, `SortableGroupHandle`: a group, and the handle it is dragged by.
 * - `SortableItem`, `SortableItemHandle`: an item, and the handle it is dragged by.
 * - `SortableOverlay`: what is shown under the pointer while a group or an item is held.
 * Each takes `asChild` to lend its behaviour to the caller's own element (a `role="group"` row, an `IconButton`).
 *
 * How it behaves, and where it differs from the registry's:
 * - Only a handle starts a drag, so the inputs and buttons of an item keep working. A handle is `touch-none`, so a finger
 *   drags by it instead of scrolling the page; a group or an item is not.
 * - The mouse and touch sensors start a drag after the pointer has moved 6px, so a click on a handle is not a drag (the
 *   kanban's distance; a handle needs no press-and-hold, as it is not the whole card).
 * - The keyboard moves by position, not by geometry: Space (or Enter) on a handle picks up, the up and down arrows move
 *   one place, out of the end of a group into the next one (at its start) or the one before (at its end), Space drops and
 *   Escape cancels. The registry's keyboard moves by measured rectangles, which jsdom cannot give; this one is the same in
 *   a browser and in a test. As in the kanban, a drag begun from the keyboard runs every built-in step.
 * - An item moved to another group is moved there at once, while it is held (as the kanban does), so it is shown in its
 *   new group; a cancelled drag hands the caller the move that puts it back. A move inside one group, and a group's move,
 *   are handed over once, when the item or group is dropped.
 * - The pointer finds its target with closest corners (closest centre among the groups for a group).
 * - Screen readers are told what happens in the caller's words (`announcements`), and how to drag (`instructions`).
 *
 * Ids are strings, and a group's id must never equal an item's. The rules for places (where a held item goes, the place
 * a key moves it to) are in `sortable-places.ts`.
 */
import {
  type Announcements,
  closestCenter,
  closestCorners,
  type CollisionDetection,
  defaultDropAnimationSideEffects,
  DndContext,
  type DndContextProps,
  type DragCancelEvent,
  type DragEndEvent,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  type DropAnimation,
  KeyboardCode,
  type KeyboardCoordinateGetter,
  KeyboardSensor,
  MeasuringStrategy,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  type AnimateLayoutChanges,
  defaultAnimateLayoutChanges,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useComposedRefs } from '@radix-ui/react-compose-refs';
import { Slot } from '@radix-ui/react-slot';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { cn } from '@/lib/utils';
import {
  defaultAnnouncements,
  type Groups,
  itemTarget,
  keyboardTarget,
  locate,
  placeOf,
  samePlace,
  type SortableAnnouncements,
  type SortableDrag,
  type SortableMove,
  type SortablePlace,
} from './sortable-places';

const defaultInstructions =
  'To pick up, press space on the drag handle. Use the arrow keys to move it up or down. Press space again to drop it, or escape to cancel.';

const POINTER_ACTIVATION = { distance: 6 };

interface SortableContextValue {
  value: Groups;
  activeId: string | null;
  modifiers: DndContextProps['modifiers'];
}

const RootContext = React.createContext<SortableContextValue | null>(null);

function useRoot(consumer: string) {
  const context = React.useContext(RootContext);
  if (!context) throw new Error(`\`${consumer}\` must be used within \`Sortable\``);
  return context;
}

interface SortableProps {
  value: Groups;
  onMove: (move: SortableMove) => void;
  announcements?: SortableAnnouncements;
  /** How to drag, read out with every handle. */
  instructions?: string;
  modifiers?: DndContextProps['modifiers'];
  children: React.ReactNode;
}

function Sortable({
  value,
  onMove,
  announcements = defaultAnnouncements,
  instructions = defaultInstructions,
  modifiers,
  children,
}: SortableProps) {
  const id = React.useId();
  const [activeId, setActiveId] = React.useState<string | null>(null);
  // Read by dnd-kit's callbacks, which outlive a render: always the latest.
  const groupsRef = React.useRef(value);
  const onMoveRef = React.useRef(onMove);
  React.useLayoutEffect(() => {
    groupsRef.current = value;
    onMoveRef.current = onMove;
  });
  const drag = React.useRef<SortableDrag | null>(null);
  // While the keyboard drags, the id it is over: the collision detection takes it as it is.
  const keyboardOver = React.useRef<string | null>(null);
  // Where the held thing is now, and the last place a screen reader was told.
  const place = React.useRef<SortablePlace | null>(null);
  const told = React.useRef<SortablePlace | null>(null);
  const ended = React.useRef<{ drag: SortableDrag; place: SortablePlace } | null>(null);

  const coordinateGetter: KeyboardCoordinateGetter = React.useCallback((event, { context, currentCoordinates }) => {
    const step = event.code === KeyboardCode.Down ? 1 : event.code === KeyboardCode.Up ? -1 : 0;
    const held = drag.current;
    if (step === 0 || !held) return undefined;
    event.preventDefault();
    const target = keyboardTarget(groupsRef.current, held.id, keyboardOver.current, step);
    if (target === null) return undefined;
    keyboardOver.current = target;
    const rect = context.droppableRects.get(target);
    return rect ? { x: rect.left, y: rect.top } : currentCoordinates;
  }, []);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: POINTER_ACTIVATION }),
    useSensor(TouchSensor, { activationConstraint: POINTER_ACTIVATION }),
    useSensor(KeyboardSensor, { coordinateGetter }),
  );

  const collisionDetection: CollisionDetection = React.useCallback((args) => {
    if (keyboardOver.current !== null) return [{ id: keyboardOver.current }];
    const groups = groupsRef.current;
    if (drag.current?.kind === 'group') {
      return closestCenter({
        ...args,
        droppableContainers: args.droppableContainers.filter((container) => String(container.id) in groups),
      });
    }
    return closestCorners(args);
  }, []);

  const finish = (held: SortableDrag, at: SortablePlace) => {
    ended.current = { drag: held, place: at };
    drag.current = null;
    keyboardOver.current = null;
    place.current = null;
    setActiveId(null);
  };

  const onDragStart = ({ active, activatorEvent }: DragStartEvent) => {
    const spot = locate(groupsRef.current, active.id);
    if (!spot) return;
    const from = placeOf(spot);
    drag.current = { id: String(active.id), kind: spot.kind, from };
    keyboardOver.current = activatorEvent instanceof KeyboardEvent ? String(active.id) : null;
    place.current = from;
    told.current = from;
    ended.current = null;
    setActiveId(String(active.id));
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    const held = drag.current;
    const groups = groupsRef.current;
    const spot = locate(groups, active.id);
    const target = locate(groups, over?.id);
    if (!held || !spot || !target) return;
    if (spot.kind === 'group') {
      if (target.kind === 'group') place.current = { group: target.group };
      return;
    }
    const translated = active.rect.current.translated;
    const below =
      translated !== null && over !== null && translated.top + translated.height / 2 > over.rect.top + over.rect.height / 2;
    const to = itemTarget(groups, spot, target, below);
    place.current = to;
    if (to.group !== spot.group) {
      onMoveRef.current({ kind: 'item', id: held.id, from: { group: spot.group, index: spot.index }, to });
    }
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const held = drag.current;
    const groups = groupsRef.current;
    const spot = locate(groups, active.id);
    if (!held || !spot) return;
    const target = locate(groups, over?.id);
    let at = placeOf(spot);
    if (target && spot.kind === 'group' && target.kind === 'group') {
      at = { group: target.group };
      if (target.group !== spot.group) onMoveRef.current({ kind: 'group', id: held.id, from: spot.group, to: target.group });
    } else if (target && spot.kind === 'item') {
      const to = itemTarget(groups, spot, target, false);
      at = to;
      if (to.group !== spot.group || to.index !== spot.index) {
        onMoveRef.current({ kind: 'item', id: held.id, from: { group: spot.group, index: spot.index }, to });
      }
    }
    finish(held, at);
  };

  const onDragCancel = ({ active }: DragCancelEvent) => {
    const held = drag.current;
    if (!held) return;
    const spot = locate(groupsRef.current, active.id);
    // Only a move to another group was made while held; put it back.
    if (spot?.kind === 'item' && held.from.index !== undefined && (spot.group !== held.from.group || spot.index !== held.from.index)) {
      onMoveRef.current({
        kind: 'item',
        id: held.id,
        from: { group: spot.group, index: spot.index },
        to: { group: held.from.group, index: held.from.index },
      });
    }
    finish(held, held.from);
  };

  // dnd-kit calls a handler above, then asks for the announcement: these read what the handler has just worked out.
  const accessibility: DndContextProps['accessibility'] = React.useMemo(() => {
    const said: Announcements = {
      onDragStart: () => (drag.current ? announcements.pickedUp(drag.current) : undefined),
      onDragOver: () => {
        const held = drag.current;
        const now = place.current;
        if (!held || !now || samePlace(now, told.current)) return undefined;
        told.current = now;
        return announcements.moved(held, now);
      },
      onDragEnd: () => (ended.current ? announcements.dropped(ended.current.drag, ended.current.place) : undefined),
      onDragCancel: () => (ended.current ? announcements.cancelled(ended.current.drag) : undefined),
    };
    return { announcements: said, screenReaderInstructions: { draggable: instructions } };
  }, [announcements, instructions]);

  const contextValue = React.useMemo<SortableContextValue>(
    () => ({ value, activeId, modifiers }),
    [value, activeId, modifiers],
  );

  return (
    <RootContext.Provider value={contextValue}>
      <DndContext
        id={id}
        sensors={sensors}
        collisionDetection={collisionDetection}
        modifiers={modifiers}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
        accessibility={accessibility}
      >
        {children}
      </DndContext>
    </RootContext.Provider>
  );
}

interface PrimitiveProps extends React.ComponentProps<'div'> {
  asChild?: boolean;
}

/** Holds the groups, in order. */
function SortableContent({ asChild, ...props }: PrimitiveProps) {
  const { value } = useRoot('SortableContent');
  const groups = React.useMemo(() => Object.keys(value), [value]);
  const Primitive = asChild ? Slot : 'div';
  return (
    <SortableContext items={groups} strategy={verticalListSortingStrategy}>
      <Primitive data-slot="sortable-content" {...props} />
    </SortableContext>
  );
}

interface HandleContextValue {
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners | undefined;
  setActivatorNodeRef: (node: HTMLElement | null) => void;
  isDragging: boolean;
  disabled?: boolean;
}

const GroupHandleContext = React.createContext<HandleContextValue | null>(null);
const ItemHandleContext = React.createContext<HandleContextValue | null>(null);

// A group that moves keeps animating into its new place, as the kanban's columns do.
const animateLayoutChanges: AnimateLayoutChanges = (args) => defaultAnimateLayoutChanges({ ...args, wasDragging: true });

interface SortableNodeProps extends PrimitiveProps {
  value: string;
  disabled?: boolean;
}

function useSortableNode(kind: 'group' | 'item', { value, disabled, style, ref }: SortableNodeProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: value,
    disabled,
    animateLayoutChanges: kind === 'group' ? animateLayoutChanges : undefined,
  });
  const composedRef = useComposedRefs(ref, setNodeRef);
  const composedStyle = React.useMemo<React.CSSProperties>(
    () => ({ transform: CSS.Translate.toString(transform), transition, ...style }),
    [transform, transition, style],
  );
  const handle = React.useMemo<HandleContextValue>(
    () => ({ attributes, listeners, setActivatorNodeRef, isDragging, disabled }),
    [attributes, listeners, setActivatorNodeRef, isDragging, disabled],
  );
  return { composedRef, composedStyle, handle, isDragging };
}

/** A group of items, dragged by its `SortableGroupHandle`. Its items are put in order inside it. */
function SortableGroup(props: SortableNodeProps) {
  const { value, asChild, disabled, className, style, ref, ...rest } = props;
  const { value: groups } = useRoot('SortableGroup');
  const { composedRef, composedStyle, handle, isDragging } = useSortableNode('group', { value, disabled, style, ref });
  const items = React.useMemo(() => [...(groups[value] ?? [])], [groups, value]);
  const Primitive = asChild ? Slot : 'div';
  return (
    <GroupHandleContext.Provider value={handle}>
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        <Primitive
          data-slot="sortable-group"
          data-dragging={isDragging ? '' : undefined}
          {...rest}
          ref={composedRef}
          style={composedStyle}
          className={cn(isDragging && 'opacity-50', className)}
        />
      </SortableContext>
    </GroupHandleContext.Provider>
  );
}

/** An item of a group, dragged by its `SortableItemHandle`. */
function SortableItem(props: SortableNodeProps) {
  const { value, asChild, disabled, className, style, ref, ...rest } = props;
  const { composedRef, composedStyle, handle, isDragging } = useSortableNode('item', { value, disabled, style, ref });
  const Primitive = asChild ? Slot : 'div';
  return (
    <ItemHandleContext.Provider value={handle}>
      <Primitive
        data-slot="sortable-item"
        data-dragging={isDragging ? '' : undefined}
        {...rest}
        ref={composedRef}
        style={composedStyle}
        className={cn(isDragging && 'opacity-50', className)}
      />
    </ItemHandleContext.Provider>
  );
}

interface HandleProps extends React.ComponentProps<'button'> {
  asChild?: boolean;
}

function Handle({
  context,
  slot,
  asChild,
  disabled,
  className,
  ref,
  ...props
}: HandleProps & { context: HandleContextValue | null; slot: string }) {
  const composedRef = useComposedRefs(ref, context?.setActivatorNodeRef);
  if (!context) throw new Error(`\`${slot}\` must be used within its group or item`);
  const isDisabled = disabled ?? context.disabled;
  const Primitive = asChild ? Slot : 'button';
  return (
    <Primitive
      type="button"
      data-slot={slot}
      data-dragging={context.isDragging ? '' : undefined}
      {...props}
      {...(isDisabled ? {} : context.attributes)}
      {...(isDisabled ? {} : context.listeners)}
      ref={composedRef}
      disabled={isDisabled}
      className={cn('cursor-grab touch-none select-none data-dragging:cursor-grabbing', className)}
    />
  );
}

function SortableGroupHandle(props: HandleProps) {
  return <Handle {...props} context={React.useContext(GroupHandleContext)} slot="sortable-group-handle" />;
}

function SortableItemHandle(props: HandleProps) {
  return <Handle {...props} context={React.useContext(ItemHandleContext)} slot="sortable-item-handle" />;
}

const dropAnimation: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }),
};

interface SortableOverlayProps {
  children: (held: { value: string; variant: 'group' | 'item' }) => React.ReactNode;
}

/** What follows the pointer, or the keyboard, while something is held: the caller draws it. */
function SortableOverlay({ children }: SortableOverlayProps) {
  const { value, activeId, modifiers } = useRoot('SortableOverlay');
  const variant = activeId !== null && activeId in value ? 'group' : 'item';
  return ReactDOM.createPortal(
    <DragOverlay dropAnimation={dropAnimation} modifiers={modifiers} className="cursor-grabbing">
      {activeId === null ? null : children({ value: activeId, variant })}
    </DragOverlay>,
    document.body,
  );
}

export type { SortableAnnouncements, SortableDrag, SortableMove, SortablePlace } from './sortable-places';
export {
  Sortable,
  SortableContent,
  SortableGroup,
  SortableGroupHandle,
  SortableItem,
  SortableItemHandle,
  SortableOverlay,
  type SortableProps,
};
