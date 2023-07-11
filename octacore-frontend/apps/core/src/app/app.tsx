import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import coreRoutes from '../../../../libs/constants/src/lib/constants';
import { Button } from '@mui/material';
import './app.module.css';

function App() {
  return (
    <BrowserRouter>
      <Button variant="contained" color="primary" style={{margin:'1rem'}}>
        <Link to={'/'} style={{textDecoration: 'none'}}>
          Route-1
        </Link>
      </Button>
      <Button variant="contained" color="primary" style={{margin:'1rem'}}>
        <Link to={'/route2'} style={{textDecoration: 'none'}}>
          Route-2
        </Link>
      </Button>
      <Routes>
        <Route path={coreRoutes[0].path} Component={coreRoutes[0].component} />
        <Route path={coreRoutes[1].path} Component={coreRoutes[1].component} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
