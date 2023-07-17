import { routes } from "./repoRoutes";
export interface NavTabsInterface {
    tab:string,
    navTo: string
  }
  
  export const NavTabs = [
    {
      tab: routes.core.projectName,
      navTo: `${routes.host}${routes.core.port}${routes.core.overview}`,
    },
    {
      tab: routes.projects.projectName,
      navTo:`${routes.host}${routes.projects.port}${routes.projects.overview}`,
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
  