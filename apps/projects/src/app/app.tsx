// eslint-disable-next-line @typescript-eslint/no-unused-vars
// import styles from './app.module.css';
import { CssBaseline, Grid } from '@mui/material'
import { Navbar } from '@octacore-frontend/shared-ui';
import { Route, Routes } from 'react-router-dom';
import ProjectOverview from './pages/ProjectOverview';
import ProjectTechnology from './pages/ProjectTechnology';
import { routes } from '@octacore-frontend/constant';

export function App() {
  const activeTab = 'Projects'
  return (
    <CssBaseline>
      <Grid container spacing={2}>
        
        <Grid item xs={2} lg={3} sx={{
          position:'relative'
        }}>
            <Navbar activeTab={activeTab} />
        </Grid>
        <Grid item xs={10} lg={9} sx={{background:'#ede7f6'}}>
          <Routes>
            <Route path={routes.projects.overview} element={<ProjectOverview />} />
            <Route path={routes.projects.technology } element={<ProjectTechnology/>}/>
          </Routes>
        </Grid>
        
      </Grid>
      </CssBaseline>
  );
}

export default App;
