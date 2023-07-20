import { BrowserRouter, Routes, Route } from 'react-router-dom';
import CoreOverview from './pages/CoreOverview';
import { Navbar } from '@octacore-frontend/shared-ui';
import { CssBaseline, Grid } from '@mui/material';
import { routes } from '@octacore-frontend/constant';

function App() {
  const activeTab = 'Core'
  return (
    <BrowserRouter>
    <CssBaseline>
      <Grid container spacing={2}>
        <Grid item xs={2} lg={3} sx={{
          position:'relative'
        }}>
            <Navbar activeTab={activeTab} />
        </Grid>
        <Grid item xs={10} lg={9} sx={{background:'#ede7f6'}}>
          <Routes>
            <Route path={routes.core.overview} element={<CoreOverview />} />
          </Routes>
        </Grid>
      </Grid>
      </CssBaseline>
    </BrowserRouter>
  );
}

export default App;
