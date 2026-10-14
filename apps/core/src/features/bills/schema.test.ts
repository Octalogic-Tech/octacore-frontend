import { toNewBill, type BillFormValues } from './schema';

const file = new File(['x'], 'receipt.png', { type: 'image/png' });
const values = {
  billDate: '2023-09-01',
  amount: '25.5',
  billType: 'Regular',
  reimbursement: 'Yes',
  addedBy: '  Asha ',
  attachment: [file] as unknown as FileList,
} as BillFormValues;

describe('toNewBill', () => {
  it('maps the form to a bill that starts pending', () => {
    expect(toNewBill(values)).toEqual({
      billDate: '2023-09-01',
      amount: 25.5,
      billType: 'Regular',
      actualExpense: true,
      billPath: 'receipt.png',
      uploadedBy: 'Asha',
      submittedBy: 'Asha',
      approved: false,
      approvedBy: '',
    });
  });

  it('stores reimbursement No as actualExpense false', () => {
    expect(toNewBill({ ...values, reimbursement: 'No' }).actualExpense).toBe(false);
  });
});
