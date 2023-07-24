import { BrowserRouter, Routes, Route } from 'react-router-dom';
import CoreOverview from './pages/CoreOverview';
import { Navbar, NestedNav } from '@octacore-frontend/shared-ui';
import { Box, CssBaseline, Stack } from '@mui/material';
import { mainRootTheme, routes } from '@octacore-frontend/constant';
import { styled } from '@mui/material/styles';
import { ThemeProvider } from '@mui/material';

const NavbarBox = styled(Box)(({ theme }) => ({
  borderRight: '1px solid lightgray',
  flex: 1,
  padding: '0.1rem',
  minHeight: '100vh',
  [theme.breakpoints.up('xs')]: {
    display: 'none',
  },
  [theme.breakpoints.up('sm')]: {
    display: 'block',
  },
}));

const NestedNavbarBox = styled(Box)(({ theme }) => ({
  flex: 4,
  padding: '0.1rem',
  [theme.breakpoints.up('xs')]: {
    display: 'none',
  },
  [theme.breakpoints.up('sm')]: {
    display: 'block',
  },
}));

function App() {
  const activeTab = 'Core';
  return (
    <BrowserRouter>
      <CssBaseline>
        <ThemeProvider theme={mainRootTheme}>
          <Box>
            <Stack
              direction={'row'}
              spacing={0}
              justifyContent={'space-between'}
            >
              <NavbarBox>
                <Navbar activeTab={activeTab} />
              </NavbarBox>
              <NestedNavbarBox>
                <NestedNav activeTab={activeTab} />
              </NestedNavbarBox>
              <Box gap={32} flex={18} p={1}>
                <Routes>
                  <Route
                    path={routes.core.overview}
                    element={<CoreOverview />}
                  />
                </Routes>
              </Box>
            </Stack>
          </Box>
        </ThemeProvider>
      </CssBaseline>
    </BrowserRouter>
  );
}

export default App;
