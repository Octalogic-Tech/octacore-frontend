import { routes } from './repoRoutes';
import { DashboardOutlined, LibraryBooksOutlined } from '@mui/icons-material';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import SupportAgentOutlinedIcon from '@mui/icons-material/SupportAgentOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import CodeTwoToneIcon from '@mui/icons-material/CodeTwoTone';
import MoneyOutlinedIcon from '@mui/icons-material/MoneyOutlined';

export interface NavTabsInterface {
  tab: string;
  navTo: string;
  icon: React.ComponentType;
}

export const NavTabs: NavTabsInterface[] = [
  {
    tab: routes.core.projectName,
    navTo: `${routes.host}${routes.core.port}${routes.core.overview}`,
    icon: DashboardOutlined,
  },
  {
    tab: routes.projects.projectName,
    navTo: `${routes.host}${routes.projects.port}${routes.projects.overview}`,
    icon: CodeTwoToneIcon,
  },
  {
    tab: 'People',
    navTo: 'http://localhost:4200/people/',
    icon: PeopleAltOutlinedIcon,
  },
  {
    tab: 'Documents',
    navTo: 'http://localhost:4200/documents',
    icon: LibraryBooksOutlined,
  },
  {
    tab: 'Supports',
    navTo: 'http://localhost:4200/support',
    icon: SupportAgentOutlinedIcon,
  },
  {
    tab: 'Finance',
    navTo: 'http://localhost:8080/finance/overview',
    icon: MoneyOutlinedIcon,
  },
  {
    tab: 'Setting',
    navTo: 'http://localhost:4200/setting',
    icon: SettingsOutlinedIcon,
  },
];
