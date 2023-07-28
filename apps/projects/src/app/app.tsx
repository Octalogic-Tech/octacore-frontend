import { BrowserRouter, Routes, Route } from 'react-router-dom';
import {
  ContentContainer,
  FloatNavbar,
  MainContainerBox,
  Navbar,
  NavbarBox,
  NestedNav,
  NestedNavbarBox,
} from '@octacore-frontend/shared-ui';
import { CssBaseline, Stack } from '@mui/material';
import { mainRootTheme, routes } from '@octacore-frontend/constant';
import { ThemeProvider } from '@mui/material';
import ProjectOverview from './pages/ProjectOverview';
import ProjectTechnology from './pages/ProjectTechnology';
import ProjectIndustry from './pages/ProjectIndustry';

function App() {
  const activeTab = 'Projects';
  return (
    <BrowserRouter>
      <CssBaseline>
        <ThemeProvider theme={mainRootTheme}>
          <FloatNavbar activeTab={activeTab} />
          <MainContainerBox >
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
