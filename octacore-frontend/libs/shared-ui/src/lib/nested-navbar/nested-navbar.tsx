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

/* eslint-disable-next-line */
export interface NestedNavbarProps {}

export function NestedNavbar(props: NestedNavbarProps) {
  return (
    <List>
      <ListItem disablePadding>
        <ListItemButton>
          <ListItemText primary="Overview" />
        </ListItemButton>
      </ListItem>
      <ListItem disablePadding>
        <ListItemButton>
          <ListItemText primary="Technology" />
        </ListItemButton>
      </ListItem>
    </List>
  );
}
export default NestedNavbar;
