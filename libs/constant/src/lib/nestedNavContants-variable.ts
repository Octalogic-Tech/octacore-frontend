import { routes } from "./repoRoutes";

export interface NestedNavTabProject {
    tab: string;
    navTo: string;
  }
  
 export interface NestedNavTabGroup {
    appName: string;
    projects: NestedNavTabProject[];
  }
  
  export const nestedNavTabs: NestedNavTabGroup[] = [
    {
      appName: 'Projects',
      projects: [
        {
          tab: 'Overview',
          navTo: routes.core.overview,
        },
        {
          tab: 'Technology',
          navTo: routes.projects.technology,
        },
        {
          tab: 'Industry',
          navTo: routes.projects.industry,
        },
        {
          tab: 'Category',
          navTo: routes.projects.category,
        },
        {
          tab: 'Holidays',
          navTo: routes.projects.hodays,
        },
      ],
    },
    {
      appName: 'Core',
      projects: [
        {
          tab: 'Overview',
          navTo: '/',
        },
      ],
    },
  ];
  