import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { ChoiceChip } from './choice-chip';

function Chip({ disabled = false }: { disabled?: boolean }) {
  const [checked, setChecked] = useState(false);
  return (
    <ChoiceChip checked={checked} disabled={disabled} onChange={(event) => setChecked(event.target.checked)}>
      React
    </ChoiceChip>
  );
}

describe('ChoiceChip', () => {
  it('is a checkbox named by its label, and starts unchecked', () => {
    render(<Chip />);
    expect(screen.getByRole('checkbox', { name: 'React' })).not.toBeChecked();
  });

  it('toggles with a click on the chip and with Space on the focused box', async () => {
    const user = userEvent.setup();
    render(<Chip />);
    await user.click(screen.getByText('React'));
    expect(screen.getByRole('checkbox', { name: 'React' })).toBeChecked();

    screen.getByRole('checkbox', { name: 'React' }).focus();
    await user.keyboard(' ');
    expect(screen.getByRole('checkbox', { name: 'React' })).not.toBeChecked();
  });

  it('cannot be toggled while disabled', async () => {
    const user = userEvent.setup();
    render(<Chip disabled />);
    await user.click(screen.getByText('React'));
    expect(screen.getByRole('checkbox', { name: 'React' })).not.toBeChecked();
  });
});
