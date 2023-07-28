import { BrowserRouter, Routes, Route } from 'react-router-dom';
import CoreOverview from './pages/CoreOverview';
import { FloatNavbar, Navbar, NestedNav } from '@octacore-frontend/shared-ui';
import { CssBaseline, Stack } from '@mui/material';
import {
  ContentContainer,
  MainContainerBox,
  NavbarBox,
  NestedNavbarBox,
  mainRootTheme,
  routes,
} from '@octacore-frontend/constant';
import { ThemeProvider } from '@mui/material';
import Categories from './pages/Categories';

function App() {
  const activeTab = 'Core';
  return (
    <BrowserRouter>
      <CssBaseline>
        <ThemeProvider theme={mainRootTheme}>
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
                    path={routes.core.overview}
                    element={<CoreOverview />}
                  />
                  <Route
                    path={routes.core.categories}
                    element={<Categories />}
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
