export interface NavItem {
  label: string;
  to: string;
  end?: boolean;
}

export interface NavGroup {
  label: string;
  /** Only people with one of these roles see the group. Absent: everyone who is signed in. */
  roles?: string[];
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Work',
    items: [
      { label: 'Overview', to: '/', end: true },
      { label: 'Clients', to: '/clients' },
      { label: 'Projects', to: '/projects' },
      { label: 'People', to: '/people' },
    ],
  },
  {
    label: 'Finance',
    items: [{ label: 'Invoices', to: '/finance/invoices' }],
  },
  {
    label: 'Reference data',
    items: [
      { label: 'Categories', to: '/categories' },
      { label: 'Technologies', to: '/technologies' },
      { label: 'Countries', to: '/countries' },
    ],
  },
  {
    label: 'Admin',
    roles: ['admin'],
    items: [{ label: 'Users', to: '/users' }],
  },
  {
    label: 'Planned',
    roles: ['admin'],
    items: [{ label: 'Planned features', to: '/planned' }],
  },
];
