import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from './confirm-dialog';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './dialog';
import { Sheet, SheetContent } from './sheet';

describe('Dialog', () => {
  it('is named by its title, described, and closes on Escape', async () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogTitle>New category</DialogTitle>
          <DialogDescription>Give it a name.</DialogDescription>
        </DialogContent>
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog', { name: 'New category' });
    expect(dialog).toHaveAccessibleDescription('Give it a name.');
    await userEvent.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('has a 44px close button with an accessible name', async () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
          <DialogDescription>Text</DialogDescription>
        </DialogContent>
      </Dialog>,
    );
    const close = screen.getByRole('button', { name: 'Close' });
    expect(close).toHaveClass('size-11');
    await userEvent.click(close);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe('ConfirmDialog', () => {
  function setup(onConfirm: () => Promise<void>) {
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Delete category “Web”?"
        description="This cannot be undone."
        confirmLabel="Delete category"
        onConfirm={onConfirm}
      />,
    );
    return onOpenChange;
  }

  it('shows the explicit wording', () => {
    setup(vi.fn().mockResolvedValue(undefined));
    expect(screen.getByRole('alertdialog', { name: 'Delete category “Web”?' })).toHaveAccessibleDescription(
      'This cannot be undone.',
    );
  });

  it('confirms, then closes', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = setup(onConfirm);
    await userEvent.click(screen.getByRole('button', { name: 'Delete category' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('stays open and says so when the action fails', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('network'));
    const onOpenChange = setup(onConfirm);
    await userEvent.click(screen.getByRole('button', { name: 'Delete category' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Try again');
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByRole('button', { name: 'Delete category' })).toBeEnabled();
  });

  it('cancels without confirming', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = setup(onConfirm);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe('Sheet', () => {
  it('opens with a screen-reader title and a close button', () => {
    render(
      <Sheet open>
        <SheetContent title="Menu">
          <p>Links</p>
        </SheetContent>
      </Sheet>,
    );
    expect(screen.getByRole('dialog', { name: 'Menu' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close menu' })).toBeInTheDocument();
  });
});
