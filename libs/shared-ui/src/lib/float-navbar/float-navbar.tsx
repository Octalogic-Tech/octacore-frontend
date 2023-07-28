import { Close, Menu } from '@mui/icons-material';
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
  minHeight: '100vh',
  width: '100vw',
  zIndex: theme.zIndex.drawer + 1,
  [theme.breakpoints.up('sm')]: {
    display: 'none',
  },
}));

export function FloatNavbar(props: FloatNavbarProps) {
  const { activeTab } = props;
  const [isDrawerOpen, setIsDrawerOpen] = useState('none');

  return (
    <Box>
      <StyledAppBar>
        <StyledToolBar>
          {isDrawerOpen === 'none' ? (
            <Menu onClick={() => setIsDrawerOpen('block')} />
          ) : (
            <Close onClick={() => setIsDrawerOpen('none')} />
          )}
        </StyledToolBar>
      </StyledAppBar>
      <FloatingSideBar
        display={isDrawerOpen}
        onClick={() => setIsDrawerOpen('none')}
      >
        <Stack direction={'row'} spacing={2} p={2} margin={0} padding={0}>
          <Box sx={{borderRight:'1px solid gray'}}>
            <Navbar activeTab={activeTab} />
          </Box>
          <Box width={'100%'}>
            <NestedNav activeTab={activeTab} />
          </Box>
        </Stack>
      </FloatingSideBar>
    </Box>
  );
}

export default FloatNavbar;
