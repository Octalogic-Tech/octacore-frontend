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

  it('shows the message the service wrote when it is asked to, and the general one when there is none', async () => {
    const failureMessage = vi.fn((error: unknown) => (error instanceof Error && error.message === 'in use' ? 'It is in use.' : undefined));
    const onConfirm = vi.fn().mockRejectedValueOnce(new Error('in use')).mockRejectedValueOnce(new Error('network'));
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Delete category “Web”?"
        description="This cannot be undone."
        confirmLabel="Delete category"
        onConfirm={onConfirm}
        failureMessage={failureMessage}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Delete category' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('It is in use.');
    await userEvent.click(screen.getByRole('button', { name: 'Delete category' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('That did not work. Try again.'));
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

describe('ConfirmDialog while the action is in flight', () => {
  it('ignores Escape, so a failure is still shown to the user', async () => {
    let fail!: (error: Error) => void;
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((_, reject) => {
          fail = reject;
        }),
    );
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Delete?"
        description="Sure?"
        confirmLabel="Delete it"
        onConfirm={onConfirm}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Delete it' }));
    await userEvent.keyboard('{Escape}');
    expect(onOpenChange).not.toHaveBeenCalled();
    fail(new Error('network'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Try again');
  });
});
