import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  NestedNavTabProject,
  navBarFigma,
  nestedNavTabs,
} from '@octacore-frontend/constant';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
export interface NestedNavbarProps {
  activeTab: string;
}
const BoxSticky = styled(Box)(({ theme }) => ({}));

export function NestedNav(props: NestedNavbarProps) {
  const [findActiveMainTab, setFindActiveTab] = useState('Overview');
  const [nestedTabsArray, setNestedTabsArray] = useState<NestedNavTabProject[]>(
    []
  );
  useEffect(() => {
    const index = nestedNavTabs.findIndex(
      (val) => val.appName === props.activeTab
    );
    if (index !== -1) {
      setNestedTabsArray(nestedNavTabs[index].projects);
    }
  }, [props.activeTab]);

  const handleActiveTab = (activeTab: string) => {
    setFindActiveTab(activeTab);
  };

  return (
    <BoxSticky>
      <Typography variant="h6" margin={'1.5rem 0 0'}>
        {props.activeTab} Module
      </Typography>
      <List>
        {nestedTabsArray.map((project, index) => (
          <ListItem
            disablePadding
            key={index}
            sx={{
              background:
                project.tab === findActiveMainTab
                  ? navBarFigma.activeButtonColor
                  : 'inherit',
              borderRadius: 1,
            }}
          >
            <ListItemButton
              component={Link}
              to={project.navTo}
              aria-label={project.tab}
              onClick={() => handleActiveTab(project.tab)}
            >
              <ListItemIcon
                sx={{
                  color:
                    project.tab === findActiveMainTab
                      ? navBarFigma.activeIconColor
                      : '',
                }}
              >
                <project.icon />
              </ListItemIcon>
              <ListItemText
                primary={project.tab}
                sx={{
                  color:
                    project.tab === findActiveMainTab ? 'secondary.main' : '',
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </BoxSticky>
  );
}

export default NestedNav;
