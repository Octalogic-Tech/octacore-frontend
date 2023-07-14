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
import CodeTwoToneIcon from '@mui/icons-material/CodeTwoTone';
import NestedNavbar from '../nested-navbar/nested-navbar';
import styles from './navbar.module.css'
import ViewQuiltOutlinedIcon from '@mui/icons-material/ViewQuiltOutlined';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import SupportAgentOutlinedIcon from '@mui/icons-material/SupportAgentOutlined';
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';
import LocalAtmOutlinedIcon from '@mui/icons-material/LocalAtmOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';

export const Navbar: React.FC = () => {
  const [open, setOpen] = useState('none');
  const [isLarge, setIsLarge] = useState(true)

  useEffect(() => {
    const handleResize = () => {
      if(window.innerWidth >= 1200) {
        setIsLarge(true)
      }
      else {
        setIsLarge(false)
      }
      console.log(window.innerWidth)
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleImageClick = () => {
    setOpen((open)=>{
      if(open==='none'){
        return 'block'
      }else{
        return 'none'
      }
    });
  };

  return (
    <Grid container>
      <Grid item xs={4} lg={4}>
        <Box>
        <Drawer
          variant="permanent"
          sx={{
            minWidth: 10,
          }}
        >
                   <Tooltip title="Click to show nested navigation">
            <IconButton
              onClick={handleImageClick}
            >
              <img
                src={require('../../../../../assets/O-Only.png')}
                alt="octalogic"
                width="40px"
              />
            </IconButton>
          </Tooltip>
          <Divider />
          <List>
            <ListItem disablePadding>
              <ListItemButton
                sx={{
                  minHeight: 48,
                  justifyContent:'initial',
                }}
                component={Link}
                to="/"
              >
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: 'auto',
                    justifyContent: 'center',
                  }}
                >
                  <ViewQuiltOutlinedIcon/>
                </ListItemIcon>
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton
                sx={{
                  minHeight: 48,
                  justifyContent:'initial',
                }}
                component={Link}
                to="/project/overview"
              >
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: 'auto',
                    justifyContent: 'center',
                  }}
                >
                  <CodeTwoToneIcon />
                </ListItemIcon>
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton
                sx={{
                  minHeight: 48,
                  justifyContent:'initial',
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: 'auto',
                    justifyContent: 'center',
                  }}
                >
                  <PeopleAltOutlinedIcon/>
                </ListItemIcon>
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton
                sx={{
                  minHeight: 48,
                  justifyContent:'initial',
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: 'auto',
                    justifyContent: 'center',
                  }}
                >
                  <ArticleOutlinedIcon/>
                </ListItemIcon>
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton
                sx={{
                  minHeight: 48,
                  justifyContent:'initial',
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: 'auto',
                    justifyContent: 'center',
                  }}
                >
                  <SupportAgentOutlinedIcon/>
                </ListItemIcon>
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton
                sx={{
                  minHeight: 48,
                  justifyContent:'initial',
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: 'auto',
                    justifyContent: 'center',
                  }}
                >
                  <CampaignOutlinedIcon/>
                </ListItemIcon>
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton
                sx={{
                  minHeight: 48,
                  justifyContent:'initial',
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: 'auto',
                    justifyContent: 'center',
                  }}
                >
                  <LocalAtmOutlinedIcon/>
                </ListItemIcon>
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton
                sx={{
                  minHeight: 48,
                  justifyContent:'initial',
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: 'auto',
                    justifyContent: 'center',
                  }}
                >
                  <SettingsOutlinedIcon/>
                </ListItemIcon>
              </ListItemButton>
            </ListItem>
          </List>
        </Drawer>
        </Box>
      </Grid>
      <Grid item xs={10} lg={8}>
        <Box
          sx={{
            display: isLarge ? 'block' : open,
            position:'absolute',
            left:50,
            background:'white',
            minHeight:'100vh',
          }}
        >
          <div className={styles['nested-nav']}>
          <NestedNavbar />
          </div>
         
        </Box>
      </Grid>
    </Grid>
  );
};
