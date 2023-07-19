import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Drawer,
  ListItem,
  ListItemButton,
  Grid,
  Box,
  Tooltip,
  ThemeProvider,
  Stack,
  Typography,
  List,
} from '@mui/material';
import NestedNavbar from '../nested-navbar/nested-navbar';
import styles from './navbar.module.css';
import {
  NavTabs,
  NavTabsInterface,
  activeBarsColorVariables,
  leftMostNavBarThemeProvider,
  logoStackThemeProvide,
  nestedNavThemeProvider,
} from '@octacore-frontend/constant';
import { useTheme } from '@emotion/react';

export interface NavbarProps {
  activeTab: string;
}
export function Navbar(props: NavbarProps) {
  const [open, setOpen] = useState('none');
  const [isLarge, setIsLarge] = useState(true);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1200) {
        setIsLarge(true);
      } else {
        setIsLarge(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleNestedNavbarDrawer = () => {
    setOpen((open) => {
      if (open === 'none') {
        return 'block';
      } else {
        return 'none';
      }
    });
  };
  return (
    <Grid container>
      <ThemeProvider theme={leftMostNavBarThemeProvider}>
        <Grid item xs={open === 'none' ? 12 : 4} lg={3}>
          <Box>
            <Drawer variant="permanent">
              <Tooltip title="Click to show nested navigation">
                <ThemeProvider theme={logoStackThemeProvide}>
                  <Stack onClick={handleNestedNavbarDrawer}>
                    <img
                      src={require('../../../../../assets/O-Only.png')}
                      alt="octalogic"
                      width="40px"
                    />
                  </Stack>
                </ThemeProvider>
              </Tooltip>
              <List>
                {NavTabs.map((tab: NavTabsInterface, index: number) => (
                  <ListItem disablePadding key={index}>
                    <ListItemButton
                      component={Link}
                      to={tab.navTo}
                      sx={{
                        background:
                          props.activeTab === tab.tab ? activeBarsColorVariables.activeNavItemColor : '',
                        color: props.activeTab === tab.tab ? activeBarsColorVariables.activeNavIconColor: 'inherit'
                      }}
                    >
                      <Stack direction={'column'}>
                        <tab.icon />
                        <Typography>{tab.tab}</Typography>
                      </Stack>
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Drawer>
          </Box>
        </Grid>
      </ThemeProvider>
      <Grid item xs={open === 'none' ? 0 : 8} lg={9}>
        <ThemeProvider theme={nestedNavThemeProvider}>
        <Stack
          sx={{
            display: isLarge ? 'block' : open,
            width: isLarge ? '100%' : '200px',
            position: isLarge ? 'static': 'absolute',
            left: isLarge? 0 : '100px',
            background: 'white',
            zIndex:200
          }}
        >
            <NestedNavbar activeTab={props.activeTab} setOpen={setOpen} />
        </Stack>
        </ThemeProvider>
      </Grid>
    </Grid>
  );
}
