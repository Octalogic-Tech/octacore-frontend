import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  Divider,
  IconButton,
  ListItemButton,
  Grid,
  Box,
  Tooltip,
} from '@mui/material';
import NestedNavbar from '../nested-navbar/nested-navbar';
import styles from './navbar.module.css';
import { NavTabs, NavTabsInterface } from '@octacore-frontend/constant';

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
      <Grid item xs={10} lg={4}>
        <Box>
          <Drawer
            variant="permanent"
            sx={{
              minWidth: 10,
            }}
          >
            <Tooltip title="Click to show nested navigation">
              <IconButton onClick={handleNestedNavbarDrawer}>
                <img
                  src={require('../../../../../assets/O-Only.png')}
                  alt="octalogic"
                  width="40px"
                />
              </IconButton>
            </Tooltip>
            <Divider />
            <List>
              {NavTabs.map((tab:NavTabsInterface, index:number) => (
                <ListItem disablePadding key={index}>
                  <ListItemButton
                    sx={{
                      minHeight: 48,
                      justifyContent: 'initial',
                      background:
                        props.activeTab === tab.tab ? 'lightblue' : '',
                    }}
                    component={Link}
                    to={tab.navTo}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: 0,
                        mr: 'auto',
                        justifyContent: 'center',
                      }}
                    >
                      {/* {tab.tab === 'Core' && <ViewQuiltOutlinedIcon />}
                      {tab.tab === 'Projects' && <CodeTwoToneIcon />}
                      {tab.tab === 'People' && <PeopleAltOutlinedIcon />}
                      {tab.tab === 'Documents' && <ArticleOutlinedIcon />}
                      {tab.tab === 'Supports' && (
                        <SupportAgentOutlinedIcon />
                      )}
                      {tab.tab === 'Marketing' && (
                        <CampaignOutlinedIcon />
                      )}
                      {tab.tab === 'Finance' && (
                        <LocalAtmOutlinedIcon />
                      )}
                      {tab.tab === 'Setting' && (
                        <SettingsOutlinedIcon />
                      )} */}
                      <tab.icon/>
                    </ListItemIcon>
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </Drawer>
        </Box>
      </Grid>
      <Grid item xs={2} lg={8}>
        <Box
          sx={{
            display: isLarge ? 'block' : open,
            position: 'absolute',
            left: 50,
            background: 'white',
            minHeight: '100vh',
            width: isLarge ? '80%': '200px'
          }}
        >
          <div className={styles['nested-nav']}>
            <NestedNavbar activeTab={props.activeTab}/>
          </div>
        </Box>
      </Grid>
    </Grid>
  );
}
