import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Navbar } from './navbar';

describe('Navbar', () => {
  it('should render successfully', () => {
    const { baseElement } = render(
      <BrowserRouter>
        <Navbar activeTab='Core'/>
      </BrowserRouter>
    );
    expect(baseElement).toBeTruthy();
  });
});

