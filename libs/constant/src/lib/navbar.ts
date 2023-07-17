export interface NavTabsInterface {
    tab:string,
    navTo: string
  }
  
  export const NavTabs = [
    {
      tab: 'Core',
      navTo: 'http://localhost:4200/',
    },
    {
      tab: 'Projects',
      navTo: 'http://localhost:4201/project/overview',
    },
    {
      tab: 'People',
      navTo: 'http://localhost:4200/people/',
    },
    {
      tab: 'Documents',
      navTo: 'http://localhost:4200/documents',
    },
    {
      tab: 'Supports',
      navTo: 'http://localhost:4200/support',
    },
    {
      tab: 'Finance',
      navTo: 'http://localhost:4200/finance',
    },
    {
      tab: 'Setting',
      navTo: 'http://localhost:4200/setting',
    },
  ];
  