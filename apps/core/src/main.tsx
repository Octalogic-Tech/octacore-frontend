import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import { mainRootTheme } from '@octacore-frontend/constant';

import App from './app/app';
import { ThemeProvider } from '@mui/material';


const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);


root.render(
  <StrictMode>
    <ThemeProvider theme={mainRootTheme}>
      <App />
    </ThemeProvider>
  </StrictMode>
);
