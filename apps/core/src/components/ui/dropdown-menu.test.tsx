import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from './dropdown-menu';

function Menu({ onSelect }: { onSelect?: (name: string) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup aria-label="Move to">
          <DropdownMenuLabel aria-hidden="true">Move to</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => onSelect?.('Bench')}>Bench</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onSelect?.('Website')}>Website</DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

describe('DropdownMenu', () => {
  it('opens on a click, titled and with one item per choice, and picks one', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<Menu onSelect={onSelect} />);
    await user.click(screen.getByRole('button', { name: 'Actions' }));
    const menu = await screen.findByRole('menu', { name: 'Actions' });
    expect(within(menu).getByText('Move to')).toBeInTheDocument();
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent)
    ).toEqual(['Bench', 'Website']);
    await user.click(within(menu).getByRole('menuitem', { name: 'Website' }));
    expect(onSelect).toHaveBeenCalledWith('Website');
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  });

  it('opens from the keyboard with Enter, Space or the down arrow, moves with the arrows, and picks with Enter', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<Menu onSelect={onSelect} />);
    for (const key of ['{Enter}', ' ', '{ArrowDown}']) {
      screen.getByRole('button', { name: 'Actions' }).focus();
      await user.keyboard(key);
      expect(await screen.findByRole('menu')).toBeInTheDocument();
      await user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    }
    screen.getByRole('button', { name: 'Actions' }).focus();
    await user.keyboard('{Enter}');
    await screen.findByRole('menu');
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith('Website');
  });

  it('closes on Escape and gives focus back to the button', async () => {
    const user = userEvent.setup();
    render(<Menu />);
    await user.click(screen.getByRole('button', { name: 'Actions' }));
    await screen.findByRole('menu');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Actions' })).toHaveFocus());
  });

  it('makes every item a 44px target, and the menu a flat square object in the brand tokens', async () => {
    const user = userEvent.setup();
    render(<Menu />);
    await user.click(screen.getByRole('button', { name: 'Actions' }));
    const menu = await screen.findByRole('menu');
    for (const item of within(menu).getAllByRole('menuitem')) expect(item).toHaveClass('min-h-11');
    expect(menu).toHaveClass('border', 'border-navy', 'bg-background');
    expect(menu.className).not.toMatch(/rounded|shadow/);
  });
});
