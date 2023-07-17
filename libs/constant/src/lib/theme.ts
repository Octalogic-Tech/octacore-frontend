import { createTheme } from '@mui/material/styles';
import { designVariable } from './design-system-variable';

export const theme = createTheme({
  palette: {
    primary: {
      main: designVariable.pallete.primaryColor,
    },
    secondary: {
      main: designVariable.pallete.seconderyColor,
    },
  },
  typography: {
    fontFamily: designVariable.typography.fontFamily,
  },
});
