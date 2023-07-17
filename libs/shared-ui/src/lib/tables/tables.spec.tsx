import { render } from '@testing-library/react';
import { Tables } from './tables';

describe('Tables', () => {
  it('should render successfully', () => {
    const outstandingInvoice = ["undefines"];

    const { baseElement } = render(<Tables outstandingInvoice= {outstandingInvoice} />);
    expect(baseElement).toBeTruthy();
  });
});