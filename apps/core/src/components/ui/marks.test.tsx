import { render } from '@testing-library/react';
import { Arm, ArmArrow, CheckMark, ChevronDownMark, CloseMark, GripMark } from './marks';

describe('marks', () => {
  it('hides every drawn mark from assistive technology', () => {
    const { container } = render(
      <>
        <Arm />
        <ArmArrow />
        <CheckMark />
        <ChevronDownMark />
        <CloseMark />
        <GripMark />
      </>,
    );
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(6);
  });

  it('lets the caller size and colour a mark', () => {
    const { container } = render(<ArmArrow className="size-6 text-teal" />);
    expect(container.querySelector('svg')).toHaveClass('size-6', 'text-teal', 'arm-arrow');
  });
});
