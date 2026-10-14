import { z } from 'zod';
import { BILL_TYPES, type Bill, type BillType } from './types';

export const billFormSchema = z.object({
  billDate: z.string().min(1, 'Date is required'),
  // Kept as text so a blank field and a typed 0 give different messages.
  amount: z
    .string()
    .min(1, 'Amount is required')
    .refine((value) => Number.isFinite(Number(value)) && Number(value) > 0, 'Amount must be greater than 0'),
  billType: z.string().refine((value) => (BILL_TYPES as readonly string[]).includes(value), 'Bill type is required'),
  reimbursement: z.enum(['Yes', 'No']),
  addedBy: z.string().trim().min(1, 'Added by is required'),
  attachment: z.custom<FileList>(
    (value) => value instanceof FileList && value.length > 0 && value[0].type.startsWith('image/'),
    'Attach an image of the bill',
  ),
});

export type BillFormValues = z.infer<typeof billFormSchema>;

/** A new bill starts pending. Only the attachment's name is kept: json-server cannot store the file. */
export function toNewBill(values: BillFormValues): Omit<Bill, 'id'> {
  const addedBy = values.addedBy.trim();
  return {
    billDate: values.billDate,
    amount: Number(values.amount),
    billType: values.billType as BillType,
    actualExpense: values.reimbursement === 'Yes',
    billPath: values.attachment[0].name,
    uploadedBy: addedBy,
    submittedBy: addedBy,
    approved: false,
    approvedBy: '',
  };
}
