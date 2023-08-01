import { render } from '@testing-library/react';

import FloatNavbar from './float-navbar';

describe('FloatNavbar', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<FloatNavbar />);
    expect(baseElement).toBeTruthy();
  });
});
