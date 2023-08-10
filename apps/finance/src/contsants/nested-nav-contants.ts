import { financeRoutes } from "./routes-contants";

export const items = [
    { navTo: financeRoutes.overview.path, text: 'Overview', icon: 'equalizer' },
    {
      navTo: financeRoutes.receiptsBills.path,
      text: 'Receipts & Bills',
      icon: 'receipt',
    },
    {
      navTo: financeRoutes.accountPayable.path,
      text: 'Accounts Payable',
      icon: 'keyboard_double_arrow_up',
    },
    {
      navTo: financeRoutes.accountReceivable.path,
      text: 'Accounts Recievable',
      icon: 'keyboard_double_arrow_down',
    },
    {
      navTo: financeRoutes.budgets.path,
      text: 'Budgets',
      icon: 'map',
    },
    {
      navTo: financeRoutes.assetsTrackings.path,
      text: 'Asset Tracking',
      icon: 'laptop_windows',
    },
    {
      navTo: financeRoutes.reports.path,
      text: 'Reports',
      icon: 'file_copy',
    },
  ]