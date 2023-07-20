import { BrowserRouter, Routes, Route } from 'react-router-dom';
import CoreOverview from './pages/CoreOverview';
import { Navbar } from '@octacore-frontend/shared-ui';
import { Grid } from '@mui/material';
import { routes } from '@octacore-frontend/constant';

function App() {
  const activeTab = 'Core'
  return (
    <BrowserRouter>
      <Grid container spacing={2}>
        <Grid item xs={2} lg={3} sx={{
          position:'relative'
        }}>
            <Navbar activeTab={activeTab} />
        </Grid>
        <Grid item xs={10} lg={9}>
          <Routes>
            <Route path={routes.core.overview} element={<CoreOverview />} />
          </Routes>
        </Grid>
      </Grid>
    </BrowserRouter>
  );
}

export default App;
