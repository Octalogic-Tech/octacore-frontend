// eslint-disable-next-line @typescript-eslint/no-unused-vars
import styles from './app.module.css';
import {Grid} from '@mui/material'
import { Navbar } from '../../../../libs/shared-ui/src/index';

import { Route, Routes } from 'react-router-dom';
import ProjectOverview from './components/ProjectOverview';
import ProjectTechnology from './components/ProjectTechnology';

export function App() {
  const activeTab = 'Projects'
  return (
    <Grid container spacing={2}>
        <Grid item xs={2} lg={3} sx={{
          position:'relative'
        }}>
            <Navbar activeTab={activeTab} />
        </Grid>
        <Grid item xs={10} lg={9} sx={{
          padding:'1rem'
        }}>
        {/* <div className={styles.content}> */}
          <Routes>
            <Route path="/project/overview" element={<ProjectOverview />} />
            <Route path='/project/technology' element={<ProjectTechnology/>}/>
          </Routes>
          {/* </div> */}
        </Grid>
        
      </Grid>
  );
}

export default App;
