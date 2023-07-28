import { createTheme } from '@mui/material/styles';
import {
  colorParameter,
  fontStyleFigma,
  overViewFigma,
} from './design-system-variable';

// themes for the root projects
export const mainRootTheme = createTheme({
  palette: {
    primary: {
      main: overViewFigma.breadCrumbsHeaderFontColor,
    },
    secondary: {
      main: colorParameter.darkPink,
      light: colorParameter.lightPink,
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
      fontWeight: 700,
    },
    h5: {
      fontSize: overViewFigma.tableLabelFontSize,
      fontWeight: 700,
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
          fontSize:'1rem',
          paddingTop:'8px',
          paddingBottom:'16px'
        },
        body: {
          fontWeight: fontStyleFigma.tableBodyFontWeight,
          color: fontStyleFigma.tableBodyFontColor,
          fontFamily: fontStyleFigma.allFontStyle,
          fontSize: '0.8rem'
        },
      },
    },
  },
});
