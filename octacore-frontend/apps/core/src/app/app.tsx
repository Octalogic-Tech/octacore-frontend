import { BrowserRouter, Routes, Route } from 'react-router-dom';
// import { coreRoutes } from '../../../../libs/constants/src/index';
// import styles from './app.module.css';
// import NestedNavbar from './components/NestedNavbar';
import CoreOverview from './components/CoreOverview';
import { Navbar } from '../../../../libs/shared-ui/src/index';
import styles from '../../../../libs/shared-css/shared.module.css';
// import { Grid } from '@mui/material';

function App() {
  return (
    <BrowserRouter>
    <Navbar />
    <div className={styles.content}>
        <Routes>
          <Route path="/" element={<CoreOverview />}/>
        </Routes>
    </div>
  </BrowserRouter>
  );
}

export default App;
