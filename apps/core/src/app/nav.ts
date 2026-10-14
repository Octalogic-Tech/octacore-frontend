export interface NavItem {
  label: string;
  to: string;
  end?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Work',
    items: [
      { label: 'Overview', to: '/', end: true },
      { label: 'Clients', to: '/clients' },
      { label: 'Projects', to: '/projects' },
    ],
  },
  {
    label: 'Finance',
    items: [{ label: 'Receipts and bills', to: '/finance/receipts-bills' }],
  },
  {
    label: 'Reference data',
    items: [
      { label: 'Categories', to: '/categories' },
      { label: 'Technologies', to: '/technologies' },
      { label: 'Countries', to: '/countries' },
    ],
  },
];
