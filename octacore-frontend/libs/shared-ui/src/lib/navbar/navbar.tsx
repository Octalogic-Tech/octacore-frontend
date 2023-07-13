import React, { useState } from 'react';
import {
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  IconButton,
  ListItemButton,
} from '@mui/material';
import CodeTwoToneIcon from '@mui/icons-material/CodeTwoTone';
import MailIcon from '@mui/icons-material/Mail';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

export const Navbar: React.FC = () => {
  const [open, setOpen] = useState(false);
  const handleDrawer = () => {
    setOpen(!open);
  };

  return (
    <Drawer
      variant="permanent"
      open={open}
      sx={{
        minWidth: 25,
      }}
    >
      <div>
        <IconButton onClick={handleDrawer}>
          <img src={require('../../../../../assets/O-Only.png')} alt="octalogic" width="40rem" />
        </IconButton>
      </div>
      <Divider />
      <List>
          <ListItem disablePadding>
            <ListItemButton
              sx={{
                minHeight: 48,
                justifyContent: open ? 'initial' : 'center',
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  mr: 'auto',
                  justifyContent: 'center',
                }}
              >
                <CodeTwoToneIcon/>
              </ListItemIcon>
            </ListItemButton>
          </ListItem>
      </List>
    </Drawer>
  );
};
