import { BrowserRouter, Routes, Route } from 'react-router-dom';
import CoreOverview from './pages/CoreOverview';
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
import Categories from './pages/Categories';
import { useMemo } from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';
import Technologies from './pages/Technologies';
const queryClient = new QueryClient()

function App() {
  const activeTab = 'Core';
  const theme = useMemo(() => createTheme(themeSettings), [])
  return (
    <QueryClientProvider client={queryClient}>
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
                      path={routes.core.overview}
                      element={<CoreOverview />}
                    />
                    <Route
                      path={routes.core.categories}
                      element={<Categories />}
                    />
                    <Route
                      path={routes.core.technologies}
                      element={<Technologies />}
                    />
                  </Routes>
                </ContentContainer>
              </Stack>
            </MainContainerBox>
          </ThemeProvider>
        </CssBaseline>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
