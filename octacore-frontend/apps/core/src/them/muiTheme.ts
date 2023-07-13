import { createTheme } from '@mui/material/styles';
import { designVariable } from '../../../../libs/design-system/src/index';

const theme = createTheme({
  palette: {
    primary: {
      main: designVariable.pallete.primaryColor,
    },
    secondary: {
      main: designVariable.pallete.seconderyColor,
    },
  },
});

export default theme;