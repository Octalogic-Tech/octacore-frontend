import { render } from '@testing-library/react';

import NestedNavbar from './nested-navbar';
import { BrowserRouter } from 'react-router-dom';

describe('NestedNavbar', () => {
  it('should render successfully', () => {
    const { baseElement } = render(
      <BrowserRouter>
          <NestedNavbar activeTab='Core'/>
      </BrowserRouter>
    );
    expect(baseElement).toBeTruthy();
  });
});
