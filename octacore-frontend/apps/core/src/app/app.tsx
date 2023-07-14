import { BrowserRouter, Routes, Route } from 'react-router-dom';
// import { coreRoutes } from '../../../../libs/constants/src/index';
// import styles from './app.module.css';
// import NestedNavbar from './components/NestedNavbar';
import CoreOverview from './CoreOverview';
import { Navbar } from '../../../../libs/shared-ui/src/index';
// import styles from '../../../../libs/shared-css/shared.module.css';
import { Grid } from '@mui/material';

function App() {
  return (
    <BrowserRouter>
      <Grid container spacing={2}>
        <Grid item xs={2} lg={2}>
            <Navbar />
        </Grid>

        {/* <div className={styles.content}> */}
        <Grid item xs={10}>
          <Routes>
            <Route path="/" element={<CoreOverview />} />
          </Routes>
          {/* </div> */}
        </Grid>
      </Grid>
    </BrowserRouter>
  );
}

export default App;
