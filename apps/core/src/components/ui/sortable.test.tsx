import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import {
  Sortable,
  SortableContent,
  SortableGroup,
  SortableGroupHandle,
  SortableItem,
  SortableItemHandle,
  SortableOverlay,
  type SortableAnnouncements,
  type SortableMove,
} from './sortable';

type Groups = Record<string, string[]>;

/** What a caller does with a move: the same as the editor, on plain lists of names. */
function applyMove(groups: Groups, move: SortableMove): Groups {
  const keys = Object.keys(groups);
  if (move.kind === 'group') {
    const order = [...keys];
    const [moved] = order.splice(move.from, 1);
    order.splice(move.to, 0, moved);
    return Object.fromEntries(order.map((key) => [key, groups[key]]));
  }
  const next = Object.fromEntries(keys.map((key) => [key, [...groups[key]]]));
  const [item] = next[keys[move.from.group]].splice(move.from.index, 1);
  next[keys[move.to.group]].splice(move.to.index, 0, item);
  return next;
}

const announcements: SortableAnnouncements = {
  pickedUp: ({ id }) => `Picked up ${id}`,
  moved: ({ id }, to) => (to.index === undefined ? `Moved ${id} to place ${to.group + 1}` : `Moved ${id} to group ${to.group + 1}, position ${to.index + 1}`),
  dropped: ({ id }, to) => (to.index === undefined ? `Dropped ${id} at place ${to.group + 1}` : `Dropped ${id} in group ${to.group + 1}, position ${to.index + 1}`),
  cancelled: ({ id }) => `Put ${id} back`,
};

const START: Groups = { g1: ['a1', 'a2'], g2: ['b1'], g3: [] };

/** Three groups of items, each group and item with its own handle, and an input in every item. */
function Board({ onMove = () => undefined, initial = START }: { onMove?: (move: SortableMove) => void; initial?: Groups }) {
  const [groups, setGroups] = useState(initial);
  return (
    <Sortable
      value={groups}
      onMove={(move) => {
        onMove(move);
        setGroups((current) => applyMove(current, move));
      }}
      announcements={announcements}
    >
      <SortableContent>
        {Object.entries(groups).map(([group, items]) => (
          <SortableGroup key={group} value={group} role="group" aria-label={group}>
            <SortableGroupHandle aria-label={`Drag ${group}`}>grip</SortableGroupHandle>
            {items.map((item) => (
              <SortableItem key={item} value={item} role="group" aria-label={item}>
                <span>{`${item} body`}</span>
                <SortableItemHandle aria-label={`Drag ${item}`}>grip</SortableItemHandle>
                <input aria-label={`${item} text`} />
              </SortableItem>
            ))}
          </SortableGroup>
        ))}
      </SortableContent>
      <SortableOverlay>{({ value, variant }) => <p>{`${variant} ${String(value)} in the air`}</p>}</SortableOverlay>
    </Sortable>
  );
}

const order = () =>
  screen.getAllByRole('group').map((group) => group.getAttribute('aria-label'));

type User = ReturnType<typeof userEvent.setup>;

// As in the kanban's tests: dnd-kit listens on the document, so each test ends with everything let go.
afterEach(async () => {
  fireEvent.keyDown(document, { code: 'Escape' });
  fireEvent.mouseUp(document);
  await new Promise((resolve) => setTimeout(resolve, 10));
});

async function pressAndMove(user: User, target: Element, distance: number) {
  await user.pointer([
    { keys: '[MouseLeft>]', target, coords: { clientX: 10, clientY: 10 } },
    { coords: { clientX: 10, clientY: 10 + distance } },
  ]);
}

/** Focuses a handle and picks its item or group up with Space. */
async function pickUp(user: User, name: string) {
  screen.getByRole('button', { name }).focus();
  await user.keyboard(' ');
}

describe('Sortable: only the handle starts a drag', () => {
  it('does not start from the item itself, or from an input in it, which stays editable', async () => {
    const user = userEvent.setup();
    render(<Board />);
    await pressAndMove(user, screen.getByText('a1 body'), 30);
    await user.pointer({ keys: '[/MouseLeft]' });
    await pressAndMove(user, screen.getByLabelText('a1 text'), 30);
    await user.pointer({ keys: '[/MouseLeft]' });
    expect(screen.queryByText(/in the air/)).toBeNull();

    await user.type(screen.getByLabelText('a1 text'), ' hello');
    expect(screen.getByLabelText('a1 text')).toHaveValue(' hello');
    expect(screen.queryByText(/in the air/)).toBeNull();
  });

  it('does not start on a click or a short move of the handle, and starts once the pointer has moved far enough', async () => {
    const user = userEvent.setup();
    render(<Board />);
    const handle = screen.getByRole('button', { name: 'Drag a1' });
    await user.click(handle);
    await pressAndMove(user, handle, 3);
    expect(screen.queryByText(/in the air/)).toBeNull();
    await user.pointer({ keys: '[/MouseLeft]' });

    await pressAndMove(user, handle, 12);
    expect(await screen.findByText('item a1 in the air')).toBeInTheDocument();
  });

  it('keeps a finger on a handle from scrolling the page, and shows a grab cursor', () => {
    render(<Board />);
    for (const name of ['Drag a1', 'Drag g1']) {
      expect(screen.getByRole('button', { name })).toHaveClass('touch-none', 'select-none', 'cursor-grab');
    }
    // The item and the group are not: touch scrolling over them keeps working.
    expect(screen.getByRole('group', { name: 'a1' })).not.toHaveClass('touch-none');
    expect(screen.getByRole('group', { name: 'g1' })).not.toHaveClass('touch-none');
  });

  it('is not picked up by a key pressed in an input inside the item', async () => {
    const onMove = vi.fn();
    const user = userEvent.setup();
    render(<Board onMove={onMove} />);
    await user.click(screen.getByLabelText('a1 text'));
    await user.keyboard(' {ArrowDown} ');
    expect(screen.queryByText(/in the air/)).toBeNull();
    expect(screen.getByLabelText('a1 text')).toHaveValue('  ');
    expect(onMove).not.toHaveBeenCalled();
  });
});

describe('Sortable: the keyboard', () => {
  it('picks an item up with Space from its handle, shows the overlay and says so', async () => {
    const user = userEvent.setup();
    render(<Board />);
    await pickUp(user, 'Drag a1');
    expect(await screen.findByText('item a1 in the air')).toBeInTheDocument();
    expect(await screen.findByText('Picked up a1')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByText(/in the air/)).toBeNull());
  });

  it('moves an item down inside its group, and reports the move once, when it is dropped', async () => {
    const onMove = vi.fn();
    const user = userEvent.setup();
    render(<Board onMove={onMove} />);
    await pickUp(user, 'Drag a1');
    await user.keyboard('{ArrowDown}');
    expect(await screen.findByText('Moved a1 to group 1, position 2')).toBeInTheDocument();
    // Inside one group nothing changes until the item is put down.
    expect(onMove).not.toHaveBeenCalled();
    await user.keyboard(' ');
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove).toHaveBeenCalledWith({ kind: 'item', id: 'a1', from: { group: 0, index: 0 }, to: { group: 0, index: 1 } });
    expect(order()).toEqual(['g1', 'a2', 'a1', 'g2', 'b1', 'g3']);
    expect(await screen.findByText('Dropped a1 in group 1, position 2')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(/in the air/)).toBeNull());
    // Focus goes back to the handle it was picked up by.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Drag a1' })).toHaveFocus());
  });

  it('moves an item past the end of its group to the start of the next, while it is held', async () => {
    const onMove = vi.fn();
    const user = userEvent.setup();
    render(<Board onMove={onMove} />);
    await pickUp(user, 'Drag a2');
    await user.keyboard('{ArrowDown}');
    // It is shown in the new group while it is still held.
    await waitFor(() => expect(order()).toEqual(['g1', 'a1', 'g2', 'a2', 'b1', 'g3']));
    expect(onMove).toHaveBeenCalledWith({ kind: 'item', id: 'a2', from: { group: 0, index: 1 }, to: { group: 1, index: 0 } });
    expect(await screen.findByText('Moved a2 to group 2, position 1')).toBeInTheDocument();
    // On down the group, then into the empty group after it.
    await user.keyboard('{ArrowDown}');
    expect(await screen.findByText('Moved a2 to group 2, position 2')).toBeInTheDocument();
    await user.keyboard('{ArrowDown}');
    await waitFor(() => expect(order()).toEqual(['g1', 'a1', 'g2', 'b1', 'g3', 'a2']));
    expect(await screen.findByText('Moved a2 to group 3, position 1')).toBeInTheDocument();
    await user.keyboard(' ');
    expect(await screen.findByText('Dropped a2 in group 3, position 1')).toBeInTheDocument();
    expect(order()).toEqual(['g1', 'a1', 'g2', 'b1', 'g3', 'a2']);
    // Into the second group, then into the third: the step inside the second group was never a change of its own.
    expect(onMove).toHaveBeenCalledTimes(2);
    expect(onMove).toHaveBeenLastCalledWith({ kind: 'item', id: 'a2', from: { group: 1, index: 0 }, to: { group: 2, index: 0 } });
  });

  it('moves an item above the start of its group to the end of the one before', async () => {
    const user = userEvent.setup();
    render(<Board />);
    await pickUp(user, 'Drag b1');
    await user.keyboard('{ArrowUp}');
    await waitFor(() => expect(order()).toEqual(['g1', 'a1', 'a2', 'b1', 'g2', 'g3']));
    expect(await screen.findByText('Moved b1 to group 1, position 3')).toBeInTheDocument();
    await user.keyboard('{ArrowUp}');
    expect(await screen.findByText('Moved b1 to group 1, position 2')).toBeInTheDocument();
    await user.keyboard(' ');
    expect(order()).toEqual(['g1', 'a1', 'b1', 'a2', 'g2', 'g3']);
  });

  it('puts a moved item back where it was on Escape', async () => {
    const onMove = vi.fn();
    const user = userEvent.setup();
    render(<Board onMove={onMove} />);
    await pickUp(user, 'Drag a2');
    await user.keyboard('{ArrowDown}');
    await waitFor(() => expect(order()).toEqual(['g1', 'a1', 'g2', 'a2', 'b1', 'g3']));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(order()).toEqual(['g1', 'a1', 'a2', 'g2', 'b1', 'g3']));
    expect(onMove).toHaveBeenLastCalledWith({ kind: 'item', id: 'a2', from: { group: 1, index: 0 }, to: { group: 0, index: 1 } });
    expect(await screen.findByText('Put a2 back')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(/in the air/)).toBeNull());
  });

  it('changes nothing when an item is put down where it was, or Escape is pressed before it moved', async () => {
    const onMove = vi.fn();
    const user = userEvent.setup();
    render(<Board onMove={onMove} />);
    await pickUp(user, 'Drag a1');
    await user.keyboard(' ');
    await pickUp(user, 'Drag a1');
    await user.keyboard('{ArrowDown}{ArrowUp} ');
    await pickUp(user, 'Drag a1');
    await user.keyboard('{Escape}');
    expect(onMove).not.toHaveBeenCalled();
    expect(order()).toEqual(['g1', 'a1', 'a2', 'g2', 'b1', 'g3']);
  });

  it('reorders the groups by their own handles', async () => {
    const onMove = vi.fn();
    const user = userEvent.setup();
    render(<Board onMove={onMove} />);
    await pickUp(user, 'Drag g1');
    expect(await screen.findByText('group g1 in the air')).toBeInTheDocument();
    await user.keyboard('{ArrowDown}');
    expect(await screen.findByText('Moved g1 to place 2')).toBeInTheDocument();
    await user.keyboard('{ArrowDown}');
    expect(await screen.findByText('Moved g1 to place 3')).toBeInTheDocument();
    expect(onMove).not.toHaveBeenCalled();
    await user.keyboard(' ');
    expect(onMove).toHaveBeenCalledWith({ kind: 'group', id: 'g1', from: 0, to: 2 });
    expect(order()).toEqual(['g2', 'b1', 'g3', 'g1', 'a1', 'a2']);
    expect(await screen.findByText('Dropped g1 at place 3')).toBeInTheDocument();
  });

  it('stops at the ends: up from the first place and down from the last do nothing', async () => {
    const onMove = vi.fn();
    const user = userEvent.setup();
    render(<Board onMove={onMove} />);
    await pickUp(user, 'Drag g1');
    await user.keyboard('{ArrowUp} ');
    await pickUp(user, 'Drag a1');
    await user.keyboard('{ArrowUp} ');
    expect(onMove).not.toHaveBeenCalled();
    expect(order()).toEqual(['g1', 'a1', 'a2', 'g2', 'b1', 'g3']);
  });

  it('describes how to drag to a screen reader on every handle', () => {
    render(<Board />);
    const handle = screen.getByRole('button', { name: 'Drag a1' });
    expect(handle).toHaveAccessibleDescription(/space/i);
    expect(handle).toHaveAccessibleDescription(/arrow keys/i);
    expect(handle).toHaveAccessibleDescription(/escape/i);
  });
});
