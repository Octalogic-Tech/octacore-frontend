// eslint-disable-next-line @typescript-eslint/no-unused-vars
// import styles from './app.module.css';
import {Grid, ThemeProvider} from '@mui/material'
import { Navbar } from '@octacore-frontend/shared-ui';
import { Route, Routes } from 'react-router-dom';
import ProjectOverview from './pages/ProjectOverview';
import ProjectTechnology from './pages/ProjectTechnology';
import { routes } from '@octacore-frontend/constant';
import { theme } from '@octacore-frontend/constant'

export function App() {
  const activeTab = 'Projects'
  return (
    <ThemeProvider theme={theme}>
      <Grid container spacing={2}>
        <Grid item xs={2} lg={3} sx={{
          position:'relative'
        }}>
            <Navbar activeTab={activeTab} />
        </Grid>
        <Grid item xs={10} lg={9} sx={{
          padding:'1rem'
        }}>
          <Routes>
            <Route path={routes.projects.overview} element={<ProjectOverview />} />
            <Route path={routes.projects.technology } element={<ProjectTechnology/>}/>
          </Routes>
        </Grid>
      </Grid>
    </ThemeProvider>
  );
}

export default App;
