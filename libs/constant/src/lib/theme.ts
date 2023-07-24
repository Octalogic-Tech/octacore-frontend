import { createTheme } from '@mui/material/styles';
import {
  fontStyleFigma,
  navBarFigma,
  overViewFigma,
} from './design-system-variable';

// themes for the root projects
export const mainRootTheme = createTheme({
  palette: {
    primary: {
      main: overViewFigma.breadCrumbsHeaderFontColor,
    },
    secondary: {
      main: navBarFigma.activeIconColor,
      light: navBarFigma.activeButtonColor,
    },
    success: {
      main: '#FFFFFF',
    },
  },
  typography: {
    allVariants: {
      color: fontStyleFigma.allTextColor,
      fontFamily: fontStyleFigma.allFontStyle,
    },
    h6: {
      fontSize: overViewFigma.breadCrumbsParentFontSize,
    },
    h4: {
      fontSize: overViewFigma.breadCrumbsHeaderFontSize,
      fontWeight: 'bolder',
    },
    h5: {
      fontSize: overViewFigma.tableLabelFontSize,
    },
  },
  components: {
    MuiTable: {
      styleOverrides: {
        root: {
          minWidth: 600,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: fontStyleFigma.tableHeadFontWeight,
          color: fontStyleFigma.tableHeadFontColor,
          fontFamily: fontStyleFigma.allFontStyle,
        },
        body: {
          fontWeight: fontStyleFigma.tableBodyFontWeight,
          color: fontStyleFigma.tableBodyFontColor,
          fontFamily: fontStyleFigma.allFontStyle,
        },
      },
    },
  },
});
