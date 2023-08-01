import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { FloatNavbar, Navbar, NestedNav } from '@octacore-frontend/shared-ui';
import { CssBaseline, Stack, createTheme } from '@mui/material';
import {
  ContentContainer,
  MainContainerBox,
  NavbarBox,
  NestedNavbarBox,
  routes,
  themeSettings,
} from '@octacore-frontend/constant';
import { ThemeProvider } from '@mui/material';
import ProjectOverview from './pages/ProjectOverview';
import ProjectTechnology from './pages/ProjectTechnology';
import ProjectIndustry from './pages/ProjectIndustry';
import { useMemo } from 'react';

function App() {
  const activeTab = 'Projects';
  const theme = useMemo(() => createTheme(themeSettings), [])
  return (
    <BrowserRouter>
      <CssBaseline>
        <ThemeProvider theme={theme}>
          <FloatNavbar activeTab={activeTab} />
          <MainContainerBox>
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
          </MainContainerBox>
        </ThemeProvider>
      </CssBaseline>
    </BrowserRouter>
  );
}

export default App;
