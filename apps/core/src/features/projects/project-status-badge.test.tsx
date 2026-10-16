import { render, screen } from '@testing-library/react';
import { ProjectStatusBadge } from './project-status-badge';

describe('ProjectStatusBadge', () => {
  it('is a solid block for an active project', () => {
    render(<ProjectStatusBadge status="active" />);
    expect(screen.getByText('Active')).toHaveClass('bg-navy');
  });

  it.each([
    ['on_hold', 'On hold'],
    ['completed', 'Completed'],
  ] as const)('is outlined for %s, so the word and the fill say the same thing', (status, label) => {
    render(<ProjectStatusBadge status={status} />);
    const badge = screen.getByText(label);
    expect(badge).toHaveClass('border-navy');
    expect(badge).not.toHaveClass('bg-navy');
  });
});
