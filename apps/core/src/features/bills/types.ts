export const BILL_TYPES = ['Regular', 'Incentive', 'Bonus'] as const;
export type BillType = (typeof BILL_TYPES)[number];

export interface Bill {
  id: number;
  /** `YYYY-MM-DD`. */
  billDate: string;
  amount: number;
  billType: BillType;
  /** Shown to staff as "Reimbursement". */
  actualExpense: boolean;
  /** json-server cannot store files, so this holds the attachment's file name. */
  billPath: string;
  uploadedBy: string;
  submittedBy: string;
  approved: boolean;
  approvedBy: string;
}

export type ApprovalFilter = 'all' | 'pending' | 'approved';

export interface BillFilters {
  from: string;
  to: string;
  approval: ApprovalFilter;
}
