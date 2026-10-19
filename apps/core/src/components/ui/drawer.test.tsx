import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Drawer, DrawerContent } from './drawer';

function Harness({ description }: { description?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open settings
      </button>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent title="Quote settings" description={description}>
          <p>Rates and percentages</p>
          <input aria-label="Currency" />
        </DrawerContent>
      </Drawer>
    </>
  );
}

describe('Drawer', () => {
  it('opens a dialog named by its visible title, with the children inside', async () => {
    render(<Harness />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Open settings' }));
    const dialog = await screen.findByRole('dialog', { name: 'Quote settings' });
    const title = screen.getByText('Quote settings');
    expect(dialog).toContainElement(title);
    expect(title).toHaveClass('text-title', 'font-semibold');
    expect(dialog).toContainElement(screen.getByText('Rates and percentages'));
    expect(dialog).toContainElement(screen.getByRole('textbox', { name: 'Currency' }));
  });

  it('describes itself when it has a description', async () => {
    render(<Harness description="Rates, headcounts and percentages." />);
    await userEvent.click(screen.getByRole('button', { name: 'Open settings' }));
    expect(await screen.findByRole('dialog', { name: 'Quote settings' })).toHaveAccessibleDescription(
      'Rates, headcounts and percentages.',
    );
  });

  it('needs no description', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open settings' }));
    const dialog = await screen.findByRole('dialog', { name: 'Quote settings' });
    expect(dialog).not.toHaveAccessibleDescription();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('closes on Escape', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open settings' }));
    await screen.findByRole('dialog', { name: 'Quote settings' });
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('has a 44px Close button that closes it', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open settings' }));
    const close = await screen.findByRole('button', { name: 'Close' });
    expect(close).toHaveClass('size-11');
    await userEvent.click(close);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('returns focus to the button that opened it', async () => {
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Open settings' });
    await userEvent.click(opener);
    await screen.findByRole('dialog', { name: 'Quote settings' });
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it('sits on the right edge, full height, and scrolls inside', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open settings' }));
    const dialog = await screen.findByRole('dialog', { name: 'Quote settings' });
    expect(dialog).toHaveClass('right-0', 'inset-y-0', 'overflow-y-auto');
    expect(dialog).toHaveClass('w-[min(28rem,100%)]', 'bg-background', 'border-l', 'border-rule');
  });

  it('lets the caller add classes', async () => {
    render(
      <Drawer open>
        <DrawerContent title="Wide" className="p-0">
          <p>Body</p>
        </DrawerContent>
      </Drawer>,
    );
    expect(screen.getByRole('dialog', { name: 'Wide' })).toHaveClass('p-0', 'right-0');
  });
});
