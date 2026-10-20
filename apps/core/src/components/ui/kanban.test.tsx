import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { Kanban, KanbanBoard, KanbanColumn, KanbanItem, KanbanItemHandle, KanbanOverlay } from './kanban';

interface Card {
  key: string;
}

/** Two columns and one card, with a handle to pick it up by and an overlay that shows while it is held. */
function Board(props: Partial<ComponentProps<typeof Kanban<Card>>>) {
  return (
    <Kanban value={{ 'col-a': [{ key: 'card-1' }], 'col-b': [] }} getItemValue={(card) => card.key} {...props}>
      <KanbanBoard>
        <KanbanColumn value="col-a">
          <KanbanItem value="card-1">
            <KanbanItemHandle aria-label="Drag card 1">grip</KanbanItemHandle>
          </KanbanItem>
        </KanbanColumn>
        <KanbanColumn value="col-b">nothing here</KanbanColumn>
      </KanbanBoard>
      <KanbanOverlay>{() => <p>Card in the air</p>}</KanbanOverlay>
    </Kanban>
  );
}

type User = ReturnType<typeof userEvent.setup>;

// dnd-kit puts its listeners on the document, which outlives a test: a drag still held at the end of one (a mouse not
// released, a card not put down) would take the next test's click or Tab, and a click is swallowed for a moment after a
// drag ends. So each test ends with everything let go and dnd-kit given the moment it takes to clean up.
afterEach(async () => {
  fireEvent.keyDown(document, { code: 'Escape' });
  fireEvent.mouseUp(document);
  await new Promise((resolve) => setTimeout(resolve, 10));
});

/**
 * Presses the mouse on `target` and moves it `distance` pixels along, which is a drag once it is far enough. The button
 * is left down for the caller to release, or the test to end with.
 */
async function pressAndMove(user: User, target: Element, distance: number) {
  await user.pointer([
    { keys: '[MouseLeft>]', target, coords: { clientX: 10, clientY: 10 } },
    { coords: { clientX: 10 + distance, clientY: 10 } },
  ]);
}

/** A press and move that is let go again where it ended. */
async function dragAndRelease(user: User, target: Element, distance: number) {
  await pressAndMove(user, target, distance);
  await user.pointer({ keys: '[/MouseLeft]' });
}

/** One card that is its own handle, with a link and a button inside it, and an overlay that shows while it is held. */
function CardBoard(
  props: Partial<ComponentProps<typeof Kanban<Card>>> & { onLink?: () => void; onButton?: () => void }
) {
  const { onLink, onButton, ...kanbanProps } = props;
  return (
    <Kanban value={{ 'col-a': [{ key: 'card-1' }], 'col-b': [] }} getItemValue={(card) => card.key} {...kanbanProps}>
      <KanbanBoard>
        <KanbanColumn value="col-a">
          <KanbanItem
            value="card-1"
            asHandle
            aria-label="Ada"
            sortableAttributes={{ role: 'group', roleDescription: 'draggable card' }}
          >
            <a
              href="#ada"
              onClick={(event) => {
                event.preventDefault();
                onLink?.();
              }}
            >
              Ada
            </a>
            <button type="button" onClick={onButton}>
              Menu
            </button>
          </KanbanItem>
        </KanbanColumn>
        <KanbanColumn value="col-b">nothing here</KanbanColumn>
      </KanbanBoard>
      <KanbanOverlay>{() => <p>Card in the air</p>}</KanbanOverlay>
    </Kanban>
  );
}

describe('Kanban: a card picked up with the keyboard', () => {
  it('is carried by the overlay until it is dropped with the same key', async () => {
    const onDragStart = vi.fn();
    const onDragEnd = vi.fn();
    const user = userEvent.setup();
    render(<Board onDragStart={onDragStart} onDragEnd={onDragEnd} />);
    expect(screen.queryByText('Card in the air')).not.toBeInTheDocument();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Drag card 1' })).toHaveFocus();
    await user.keyboard(' ');
    expect(await screen.findByText('Card in the air')).toBeInTheDocument();
    expect(onDragStart).toHaveBeenCalledTimes(1);
    await user.keyboard(' ');
    await waitFor(() => expect(screen.queryByText('Card in the air')).not.toBeInTheDocument());
    expect(onDragEnd).toHaveBeenCalledTimes(1);
  });

  it('is put down again by Escape, which tells the caller', async () => {
    const onDragCancel = vi.fn();
    const user = userEvent.setup();
    render(<Board onDragCancel={onDragCancel} />);
    await user.tab();
    await user.keyboard(' ');
    expect(await screen.findByText('Card in the air')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByText('Card in the air')).not.toBeInTheDocument());
    expect(onDragCancel).toHaveBeenCalledTimes(1);
  });

  it('keeps the registry’s own announcements when the caller supplies none', async () => {
    const user = userEvent.setup();
    render(<Board />);
    await user.tab();
    await user.keyboard(' ');
    expect(await screen.findByText('Picked up item at position 1 of 1')).toBeInTheDocument();
    // Put it down again: a card still held at the end of a test would swallow the next test's Tab (dnd-kit ends a drag on it).
    await user.keyboard('{Escape}');
  });
});

describe('Kanban: a caller that opts out', () => {
  it('keeps the built-in drag from starting by preventing default on the event that began it (a pointer drag)', async () => {
    const user = userEvent.setup();
    render(<Board onDragStart={(event) => event.activatorEvent.preventDefault()} />);
    await pressAndMove(user, screen.getByRole('button', { name: 'Drag card 1' }), 30);
    expect(screen.queryByText('Card in the air')).not.toBeInTheDocument();
  });

  it('lets a pointer drag start when it does not', async () => {
    const user = userEvent.setup();
    render(<Board />);
    await pressAndMove(user, screen.getByRole('button', { name: 'Drag card 1' }), 30);
    expect(await screen.findByText('Card in the air')).toBeInTheDocument();
  });
});

describe('Kanban: a pointer drag', () => {
  it('does not start on a press that does not move, or that moves only a little', async () => {
    const onDragStart = vi.fn();
    const user = userEvent.setup();
    render(<Board onDragStart={onDragStart} />);
    const handle = screen.getByRole('button', { name: 'Drag card 1' });
    await dragAndRelease(user, handle, 0);
    await dragAndRelease(user, handle, 4);
    expect(screen.queryByText('Card in the air')).not.toBeInTheDocument();
    expect(onDragStart).not.toHaveBeenCalled();
  });

  it('starts once the pointer has moved far enough, and ends when it is released', async () => {
    const onDragStart = vi.fn();
    const onDragEnd = vi.fn();
    const user = userEvent.setup();
    render(<Board onDragStart={onDragStart} onDragEnd={onDragEnd} />);
    await pressAndMove(user, screen.getByRole('button', { name: 'Drag card 1' }), 12);
    expect(await screen.findByText('Card in the air')).toBeInTheDocument();
    expect(onDragStart).toHaveBeenCalledTimes(1);
    await user.pointer({ keys: '[/MouseLeft]' });
    await waitFor(() => expect(screen.queryByText('Card in the air')).not.toBeInTheDocument());
    expect(onDragEnd).toHaveBeenCalledTimes(1);
  });
});

describe('Kanban: a card that is its own handle', () => {
  it('is picked up by pressing on the card itself and moving', async () => {
    const onDragStart = vi.fn();
    const user = userEvent.setup();
    render(<CardBoard onDragStart={onDragStart} />);
    await pressAndMove(user, screen.getByRole('group', { name: 'Ada' }), 20);
    expect(await screen.findByText('Card in the air')).toBeInTheDocument();
    expect(onDragStart).toHaveBeenCalledTimes(1);
  });

  it('is picked up by pressing on a link inside it and moving, and the click that ends it does not follow the link', async () => {
    const onLink = vi.fn();
    const user = userEvent.setup();
    render(<CardBoard onLink={onLink} />);
    await pressAndMove(user, screen.getByRole('link', { name: 'Ada' }), 20);
    expect(await screen.findByText('Card in the air')).toBeInTheDocument();
    await user.pointer({ keys: '[/MouseLeft]' });
    await waitFor(() => expect(screen.queryByText('Card in the air')).not.toBeInTheDocument());
    expect(onLink).not.toHaveBeenCalled();
  });

  it('still lets a link or a button inside it be clicked: a click is not a drag', async () => {
    const onLink = vi.fn();
    const onButton = vi.fn();
    const onDragStart = vi.fn();
    const user = userEvent.setup();
    render(<CardBoard onLink={onLink} onButton={onButton} onDragStart={onDragStart} />);
    await user.click(screen.getByRole('link', { name: 'Ada' }));
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    expect(onLink).toHaveBeenCalledTimes(1);
    expect(onButton).toHaveBeenCalledTimes(1);
    expect(onDragStart).not.toHaveBeenCalled();
    expect(screen.queryByText('Card in the air')).not.toBeInTheDocument();
  });

  it('is picked up by the keyboard when the card itself has focus', async () => {
    const user = userEvent.setup();
    render(<CardBoard />);
    await user.tab();
    expect(screen.getByRole('group', { name: 'Ada' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(await screen.findByText('Card in the air')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByText('Card in the air')).not.toBeInTheDocument());
  });

  it('is not picked up by a key pressed on a link or a button inside it: Enter follows the link, Space presses the button', async () => {
    const onLink = vi.fn();
    const onButton = vi.fn();
    const onDragStart = vi.fn();
    const user = userEvent.setup();
    render(<CardBoard onLink={onLink} onButton={onButton} onDragStart={onDragStart} />);
    await user.tab();
    await user.tab();
    expect(screen.getByRole('link', { name: 'Ada' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onLink).toHaveBeenCalledTimes(1);
    await user.tab();
    expect(screen.getByRole('button', { name: 'Menu' })).toHaveFocus();
    await user.keyboard(' ');
    await user.keyboard('{Enter}');
    expect(onButton).toHaveBeenCalledTimes(2);
    expect(onDragStart).not.toHaveBeenCalled();
    expect(screen.queryByText('Card in the air')).not.toBeInTheDocument();
  });

  it('takes the role and description it is given, and stays focusable', () => {
    render(<CardBoard />);
    const card = screen.getByRole('group', { name: 'Ada' });
    expect(card).toHaveAttribute('aria-roledescription', 'draggable card');
    expect(card).toHaveAttribute('tabindex', '0');
    expect(screen.queryByRole('button', { name: 'Ada' })).not.toBeInTheDocument();
  });

  it('is a button, as dnd-kit makes it, when no role is given', () => {
    render(
      <Kanban value={{ 'col-a': [{ key: 'card-1' }] }} getItemValue={(card) => card.key}>
        <KanbanBoard>
          <KanbanColumn value="col-a">
            <KanbanItem value="card-1" asHandle aria-label="Plain" />
          </KanbanColumn>
        </KanbanBoard>
      </Kanban>
    );
    expect(screen.getByRole('button', { name: 'Plain' })).toHaveAttribute('aria-roledescription', 'sortable');
  });

  it('shows a grab cursor and does not stop a finger scrolling over it', () => {
    render(<CardBoard />);
    const card = screen.getByRole('group', { name: 'Ada' });
    expect(card).toHaveClass('cursor-grab', 'select-none');
    expect(card).not.toHaveClass('touch-none');
  });

  it('is not draggable, or focusable, while it is disabled', async () => {
    const user = userEvent.setup();
    render(
      <Kanban value={{ 'col-a': [{ key: 'card-1' }] }} getItemValue={(card) => card.key}>
        <KanbanBoard>
          <KanbanColumn value="col-a">
            <KanbanItem value="card-1" asHandle disabled aria-label="Locked" />
          </KanbanColumn>
        </KanbanBoard>
        <KanbanOverlay>{() => <p>Card in the air</p>}</KanbanOverlay>
      </Kanban>
    );
    const card = screen.getByLabelText('Locked');
    expect(card).not.toHaveAttribute('tabindex');
    await pressAndMove(user, card, 30);
    expect(screen.queryByText('Card in the air')).not.toBeInTheDocument();
  });
});

describe('Kanban: a touch drag', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts only after the press has been held a moment, so a swipe still scrolls', () => {
    vi.useFakeTimers();
    render(<CardBoard />);
    const card = screen.getByRole('group', { name: 'Ada' });
    const touch = { clientX: 10, clientY: 10, identifier: 1, target: card };
    fireEvent.touchStart(card, { touches: [touch], changedTouches: [touch] });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.queryByText('Card in the air')).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.getByText('Card in the air')).toBeInTheDocument();
  });

  it('does not start when the finger moves away before the moment is up: that is a swipe', () => {
    vi.useFakeTimers();
    render(<CardBoard />);
    const card = screen.getByRole('group', { name: 'Ada' });
    const start = { clientX: 10, clientY: 10, identifier: 1, target: card };
    const moved = { clientX: 10, clientY: 60, identifier: 1, target: card };
    fireEvent.touchStart(card, { touches: [start], changedTouches: [start] });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    fireEvent.touchMove(card, { touches: [moved], changedTouches: [moved] });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.queryByText('Card in the air')).not.toBeInTheDocument();
  });
});
