import { render } from '@testing-library/react';

import NestedNavbar from './nested-navbar';

describe('NestedNavbar', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<NestedNavbar />);
    expect(baseElement).toBeTruthy();
  });
});
