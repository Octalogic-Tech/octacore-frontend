export interface BillTableItem {
    [key: string]: Date | number | boolean | string;
    billDate: Date;
    amount: number;
    billType: string;
    actualExpense: boolean;
    billPath: string;
    uploadedBy: string;
    submittedBy: string;
    approved: boolean;
    approvedBy: string;
    reimbursement: Date;
  }