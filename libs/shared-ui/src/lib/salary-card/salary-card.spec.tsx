import { render } from '@testing-library/react';

import SalaryCard from './salary-card';

describe('SalaryCard', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<SalaryCard />);
    expect(baseElement).toBeTruthy();
  });
});
