import { render, screen, waitFor } from '@testing-library/react';
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
  });
});

describe('Kanban: a caller that opts out', () => {
  it('keeps the built-in drag from starting by preventing default on the event that began it (a pointer drag)', async () => {
    const user = userEvent.setup();
    render(<Board onDragStart={(event) => event.activatorEvent.preventDefault()} />);
    await user.pointer({ keys: '[MouseLeft>]', target: screen.getByRole('button', { name: 'Drag card 1' }) });
    expect(screen.queryByText('Card in the air')).not.toBeInTheDocument();
  });

  it('lets a pointer drag start when it does not', async () => {
    const user = userEvent.setup();
    render(<Board />);
    await user.pointer({ keys: '[MouseLeft>]', target: screen.getByRole('button', { name: 'Drag card 1' }) });
    expect(await screen.findByText('Card in the air')).toBeInTheDocument();
  });
});
