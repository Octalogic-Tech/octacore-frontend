import styles from './nested-navbar.module.css';
import {
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  IconButton,
  ListItemButton,
  Toolbar,
} from '@mui/material';
import InboxIcon from '@mui/icons-material/MoveToInbox';
import StackedBarChartOutlinedIcon from '@mui/icons-material/StackedBarChartOutlined';
import Diversity2OutlinedIcon from '@mui/icons-material/Diversity2Outlined';
import { Link } from 'react-router-dom';
import { Margin, Padding } from '@mui/icons-material';
import { useEffect, useState } from 'react';

interface TabProject {
  tab: string;
  navTo: string;
}

interface TabGroup {
  appName: string;
  projects: TabProject[];
}

const tabs: TabGroup[] = [
  {
    appName: 'Projects',
    projects: [
      {
        tab: 'Overview',
        navTo: '/project/overview',
      },
      {
        tab: 'Technology',
        navTo: 'project/technology',
      },
      {
        tab: 'Industry',
        navTo: 'project/industry',
      },
      {
        tab: 'Category',
        navTo: 'project/industry',
      },
      {
        tab: 'Holidays',
        navTo: 'project/holiday',
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

export interface NestedNavbarProps {
  activeTab: string;
}

export function NestedNavbar(props: NestedNavbarProps) {
  const [findActiveMainTab, setFindActiveTab] = useState('Overview');
  const [nestedTabsArray, setNestedTabsArray] = useState<TabProject[]>([]);

  useEffect(() => {
    const index = tabs.findIndex((val) => val.appName === props.activeTab);
    if (index !== -1) {
      setNestedTabsArray(tabs[index].projects);
    }
  }, [props.activeTab]);

  const handleActiveTab = (activeTab:string) =>{
    setFindActiveTab(activeTab)
  } 

  return (
    <List>
      {nestedTabsArray.map((project, index) => (
        <ListItem disablePadding key={index}  sx={{
          background: project.tab === findActiveMainTab ? 'lightblue':""
        }}>
          <ListItemButton component={Link} to={project.navTo}
          onClick={()=>handleActiveTab(project.tab)}>
            <ListItemIcon sx={{ width: 50, padding: 0 }}>
              {project.tab === 'Overview' && <StackedBarChartOutlinedIcon />}
              {project.tab === 'Technology' && <Diversity2OutlinedIcon />}
              {project.tab === 'Industry' && <Diversity2OutlinedIcon />}
              {project.tab === 'Category' && <Diversity2OutlinedIcon />}
              {project.tab === 'Holidays' && <Diversity2OutlinedIcon />}
            </ListItemIcon>
            <ListItemText primary={project.tab} sx={{ padding: 0, margin: 0 }} />
          </ListItemButton>
        </ListItem>
      ))}
    </List>
  );
}

export default NestedNavbar;
