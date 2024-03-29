import {
  Box,
  List,
  ListItem,
  ListItemButton,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  NestedNavTabProject,
  borderParameter,
  marginParameters,
  nestedNavTabs,
} from '@octacore-frontend/constant';
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '@mui/material';
export interface NestedNavbarProps {
  activeTab: string;
}
const BoxSticky = styled(Box)(({ theme }) => ({
  padding: '1.5rem 0.5rem',
}));

const listButtonStyle = {
  borderRadius: borderParameter.containerRadius,
  height: 40,
  padding: '0.5rem',
};

const CustomNestedNavBox = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'start',
});

export function NestedNav(props: NestedNavbarProps) {
  const [findActiveMainTab, setFindActiveTab] = useState('Overview');
  const [nestedTabsArray, setNestedTabsArray] = useState<NestedNavTabProject[]>(
    []
  );
  const location = useLocation();
  const { palette } = useTheme()

  useEffect(() => {
    const index = nestedNavTabs.findIndex(
      (val) => val.appName === props.activeTab
    );
    if (index !== -1) {
      setNestedTabsArray(nestedNavTabs[index].projects);
    }
  }, [props.activeTab]);

  //useEffect for finding active nav bar whenever the page is refreshed
  useEffect(() => {
    setFindActiveTab(location.pathname);
  }, [location.pathname]);

  return (
    <BoxSticky>
      <Typography
        variant='body1'
        sx={{
          marginBottom: marginParameters.marginBottom,
        }}
      >
        {props.activeTab} Module
      </Typography>
      <List>
        {nestedTabsArray.map((project, index) => (
          <ListItem
            disablePadding
            key={index}
            sx={{
              marginBottom: marginParameters.marginBottom,
            }}
          >
            <ListItemButton
              component={Link}
              to={project.navTo}
              aria-label={project.tab}
              sx={{
                background:
                  project.navTo === findActiveMainTab
                    ? palette.secondary.light
                    : '',
                color:
                project.navTo === findActiveMainTab
                    ? palette.secondary.main
                    : palette.text.secondary,
                ...listButtonStyle,
              }}
              disableGutters
            >
              <CustomNestedNavBox
                sx={{
                  color:
                    project.navTo === findActiveMainTab ? 'secondary.main' : '',
                }}
              >
                <project.icon />
                <Typography
                  sx={{
                    color:
                      project.navTo === findActiveMainTab
                        ? 'secondary.main'
                        : '',
                    marginLeft: '0.5rem',
                  }}
                >
                  {project.tab}
                </Typography>
              </CustomNestedNavBox>
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </BoxSticky>
  );
}

export default NestedNav;
