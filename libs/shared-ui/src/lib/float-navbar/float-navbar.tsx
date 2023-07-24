import { Menu } from '@mui/icons-material';
import { AppBar, Box, Stack, Toolbar } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useState } from 'react';
import { Navbar } from '../navbar/navbar';
import NestedNav from '../nested-navbar/nested-navbar';

export interface FloatNavbarProps {
  activeTab: string;
}

const StyledAppBar = styled(AppBar)(({ theme }) => ({
  zIndex: theme.zIndex.drawer + 1,
}));

const StyledToolBar = styled(Toolbar)(({ theme }) => ({
  [theme.breakpoints.up('sm')]: {
    display: 'none',
  },
}));

const FloatingSideBar = styled(Box)(({ theme }) => ({
  position: 'fixed',
  top: theme.mixins.toolbar.minHeight,
  left: 0,
  backgroundColor: 'white',
  height: '100vh',
  maxWidth: '400px',
  [theme.breakpoints.up('sm')]: {
    display: 'none',
  },
}));

export function FloatNavbar(props: FloatNavbarProps) {
  const { activeTab } = props;
  const [isDrawerOpen, setIsDrawerOpen] = useState('none');

  const handleDrawer = () => {
    const status = isDrawerOpen === 'none' ? 'block' : 'none';
    setIsDrawerOpen(status);
  };

  return (
    <Box>
      <StyledAppBar>
        <StyledToolBar>
          <Menu onClick={handleDrawer} />
        </StyledToolBar>
      </StyledAppBar>
      <Box>
        <FloatingSideBar
          display={isDrawerOpen}
          onClick={() => setIsDrawerOpen('none')}
        >
          <Stack direction={'row'} spacing={2} p={2}>
            <Navbar activeTab={activeTab} />
            <NestedNav activeTab={activeTab} />
          </Stack>
        </FloatingSideBar>
      </Box>
    </Box>
  );
}

export default FloatNavbar;
