import { render } from '@testing-library/react';

import { Cards } from './card';

describe('Card', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<Cards currentMonth='Jan'/>);
    expect(baseElement).toBeTruthy();
  });
  
});