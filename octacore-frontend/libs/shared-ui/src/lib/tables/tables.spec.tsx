import { render } from '@testing-library/react';

import Tables from './tables';

describe('Tables', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<Tables />);
    expect(baseElement).toBeTruthy();
  });
});
