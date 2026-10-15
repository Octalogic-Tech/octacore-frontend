import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FormEvent } from 'react';
import { LuPencil } from 'react-icons/lu';
import { IconButton } from './icon-button';

describe('IconButton', () => {
  it('is named and explained by its label, with a decorative icon and no visible text', () => {
    render(<IconButton label="Edit Acme" icon={LuPencil} />);
    const button = screen.getByRole('button', { name: 'Edit Acme' });
    expect(button).toHaveAttribute('title', 'Edit Acme');
    expect(button).toHaveTextContent('');
    expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('is a 44px square target', () => {
    render(<IconButton label="Edit Acme" icon={LuPencil} />);
    expect(screen.getByRole('button', { name: 'Edit Acme' })).toHaveClass('size-11');
  });

  it('calls its handler, and does not submit a form', async () => {
    const onClick = vi.fn();
    const onSubmit = vi.fn((event: FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <IconButton label="Edit Acme" icon={LuPencil} onClick={onClick} />
      </form>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Edit Acme' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('cannot be clicked while disabled', async () => {
    const onClick = vi.fn();
    render(<IconButton label="Edit Acme" icon={LuPencil} disabled onClick={onClick} />);
    await userEvent.click(screen.getByRole('button', { name: 'Edit Acme' }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
