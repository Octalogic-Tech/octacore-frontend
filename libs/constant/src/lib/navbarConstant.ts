import { routes } from './repoRoutes';
import { ViewQuiltOutlined } from '@mui/icons-material';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import SupportAgentOutlinedIcon from '@mui/icons-material/SupportAgentOutlined';
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import CodeTwoToneIcon from '@mui/icons-material/CodeTwoTone';

export interface NavTabsInterface {
  tab: string;
  navTo: string;
  icon: any;
}

export const NavTabs: NavTabsInterface[] = [
  {
    tab: routes.core.projectName,
    navTo: `${routes.host}${routes.core.port}${routes.core.overview}`,
    icon: ViewQuiltOutlined,
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
    icon: ArticleOutlinedIcon,
  },
  {
    tab: 'Supports',
    navTo: 'http://localhost:4200/support',
    icon: SupportAgentOutlinedIcon,
  },
  {
    tab: 'Finance',
    navTo: 'http://localhost:4200/finance',
    icon: CampaignOutlinedIcon,
  },
  {
    tab: 'Setting',
    navTo: 'http://localhost:4200/setting',
    icon: SettingsOutlinedIcon,
  },
];
