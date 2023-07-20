import {
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Box,
  Typography,
} from '@mui/material';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { NestedNavTabProject, activeBarsColorVariables, nestedNavTabs } from '@octacore-frontend/constant';
export interface NestedNavbarProps {
  activeTab: string;
  setOpen: React.Dispatch<React.SetStateAction<string>>;
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
      <Box sx={{marginBottom: '1rem'}}>
        <Typography>
          {props.activeTab} Module
        </Typography>
      </Box>
      {nestedTabsArray.map((project, index) => (
        <ListItem disablePadding key={index}  sx={{
          background: project.tab === findActiveMainTab ? activeBarsColorVariables.activeNavItemColor: 'inherit',
          color: project.tab === findActiveMainTab ? activeBarsColorVariables.activeNavIconColor: 'primary',
        }}>
          <ListItemButton component={Link} to={project.navTo}
          aria-label={project.tab}
          onClick={()=>{
            handleActiveTab(project.tab);
            props.setOpen("none")
            }}>
            <ListItemIcon sx={{ width: 50, padding: 0 }}>
                <project.icon/>
            </ListItemIcon>
            <ListItemText primary={project.tab} sx={{ padding: 0, margin: 0 }} />
          </ListItemButton>
        </ListItem>
      ))}
    </List>
  );
}

export default NestedNavbar;
