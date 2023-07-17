import {
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
} from '@mui/material';
import StackedBarChartOutlinedIcon from '@mui/icons-material/StackedBarChartOutlined';
import Diversity2OutlinedIcon from '@mui/icons-material/Diversity2Outlined';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { NestedNavTabProject, nestedNavTabs } from '@octacore-frontend/constant';

export interface NestedNavbarProps {
  activeTab: string;
}

export function NestedNavbar(props: NestedNavbarProps) {
  const [findActiveMainTab, setFindActiveTab] = useState('Overview');
  const [nestedTabsArray, setNestedTabsArray] = useState<NestedNavTabProject[]>([]);

  useEffect(() => {
    const index = nestedNavTabs.findIndex((val) => val.appName === props.activeTab);
    if (index !== -1) {
      setNestedTabsArray(nestedNavTabs[index].projects);
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
