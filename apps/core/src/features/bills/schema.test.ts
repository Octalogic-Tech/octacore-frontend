import { billFormSchema, toNewBill, type BillFormValues } from './schema';

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

const amountMessages = (amount: string) => {
  const result = billFormSchema.safeParse({ ...values, amount });
  return result.success
    ? []
    : result.error.issues.filter((issue) => issue.path[0] === 'amount').map((issue) => issue.message);
};

describe('billFormSchema amount', () => {
  it.each(['0', '-5', 'abc', 'Infinity', '1e999'])('rejects %s as not a positive number', (amount) => {
    expect(amountMessages(amount)).toEqual(['Amount must be greater than 0']);
  });

  it('asks for an amount when it is blank', () => {
    expect(amountMessages('')[0]).toBe('Amount is required');
  });

  it('rejects sub-cent precision, so what is stored is what the table shows', () => {
    expect(amountMessages('25.555')).toEqual(['Amount can have at most two decimals']);
  });

  it.each(['25', '25.5', '25.55', '0.01'])('accepts %s', (amount) => {
    expect(amountMessages(amount)).toEqual([]);
  });
});
