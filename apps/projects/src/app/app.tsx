import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { FloatNavbar, Navbar, NestedNav } from '@octacore-frontend/shared-ui';
import { Box, CssBaseline, Stack } from '@mui/material';
import {
  mainRootTheme,
  navBarFigma,
  routes,
} from '@octacore-frontend/constant';
import { styled } from '@mui/material/styles';
import { ThemeProvider } from '@mui/material';
import ProjectOverview from './pages/ProjectOverview';
import ProjectTechnology from './pages/ProjectTechnology';
import ProjectIndustry from './pages/ProjectIndustry';

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

const ContentContainer = styled(Box)(({ theme }) => ({
  gap: 32,
  flex: 18,
  background: navBarFigma.hoverItemColor,
  [theme.breakpoints.up('sm')]: {
    padding: '0.3rem',
  },
}));

function App() {
  const activeTab = 'Projects';
  return (
    <BrowserRouter>
      <CssBaseline>
        <ThemeProvider theme={mainRootTheme}>
          <FloatNavbar activeTab={activeTab} />
          <Box sx={{ paddingTop: { xs: '60px', sm: 0 } }}>
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
              <ContentContainer>
                <Routes>
                  <Route
                    path={routes.projects.overview}
                    element={<ProjectOverview />}
                  />
                  <Route
                    path={routes.projects.technology}
                    element={<ProjectTechnology />}
                  />
                  <Route
                    path={routes.projects.industry}
                    element={<ProjectIndustry />}
                  />
                </Routes>
              </ContentContainer>
            </Stack>
          </Box>
        </ThemeProvider>
      </CssBaseline>
    </BrowserRouter>
  );
}

export default App;
