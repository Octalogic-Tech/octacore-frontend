import { render } from '@testing-library/react';
import CoreOverview from './CoreOverview';

describe('CoreOverview', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<CoreOverview />);
    expect(baseElement).toBeTruthy();
  });

  it('should have a greeting element', () => {
    const { getByTestId } = render(<CoreOverview />);
    const greetingElement = getByTestId('greeting');
    expect(greetingElement).toBeInTheDocument();
  });
});
