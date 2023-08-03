import { routes } from './repoRoutes';
import FactoryOutlinedIcon from '@mui/icons-material/FactoryOutlined';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import StackedBarChartOutlinedIcon from '@mui/icons-material/StackedBarChartOutlined';
import Diversity2OutlinedIcon from '@mui/icons-material/Diversity2Outlined';
import CodeOutlinedIcon from '@mui/icons-material/CodeOutlined';

export interface NestedNavTabProject {
  tab: string;
  navTo: string;
  icon: React.ComponentType;
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
        navTo: routes.projects.overview,
        icon: StackedBarChartOutlinedIcon,
      },
      {
        tab: 'Technology',
        navTo: routes.projects.technology,
        icon: Diversity2OutlinedIcon,
      },
      {
        tab: 'Industry',
        navTo: routes.projects.industry,
        icon: FactoryOutlinedIcon,
      },
      {
        tab: 'Category',
        navTo: routes.projects.category,
        icon: CategoryOutlinedIcon,
      },
      {
        tab: 'Holidays',
        navTo: routes.projects.hodays,
        icon: CalendarMonthOutlinedIcon,
      },
    ],
  },
  {
    appName: 'Core',
    projects: [
      {
        tab: 'Overview',
        navTo: routes.core.overview,
        icon: StackedBarChartOutlinedIcon,
      },
      {
        tab: 'Category',
        navTo: routes.core.categories,
        icon: CategoryOutlinedIcon,
      },
      {
        tab: 'Technologies',
        navTo: routes.core.technologies,
        icon: CodeOutlinedIcon,
      },
    ],
  },
];
