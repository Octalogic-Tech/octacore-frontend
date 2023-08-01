import { tokens } from "./design-system-variable";

export const themeSettings = {
  palette: {
    primary: {
      ...tokens.primary,
      main: tokens.primary[900],
      light: tokens.primary[300],
    },
    secondary: {
      ...tokens.secondary,
      main: tokens.secondary[800],
      light: tokens.secondary[100],
    },
    grey: {
      ...tokens.grey,
      main: tokens.grey[200],
    },
    background: {
      default: tokens.background.main,
      light: tokens.background.light,
    },
    border: {
      main: tokens.grey[300],
    },
  },
  typography: {
    fontFamily: ['INunito Sans', 'sans-serif'].join(','),
    fontSize: 12,
    h1: {
      fontFamily: ['Nunito Sans', 'sans-serif'].join(','),
      fontSize: 90,
    },
    h2: {
      fontFamily: ['Nunito Sans', 'sans-serif'].join(','),
      fontSize: 68,
    },
    h3: {
      fontFamily: ['Nunito Sans', 'sans-serif'].join(','),
      fontSize: 50,
      fontWeight: 800,
      color: tokens.grey[200],
    },
    h4: {
      fontFamily: ['Nunito Sans', 'sans-serif'].join(','),
      fontSize: 38,
      fontWeight: 600,
      color: tokens.grey[300],
    },
    h5: {
      fontFamily: ['Nunito Sans', 'sans-serif'].join(','),
      fontSize: 28,
      fontWeight: 400,
      color: tokens.grey[300],
    },
    h6: {
      fontFamily: ['Inter', 'sans-serif'].join(','),
      fontSize: 22,
      color: tokens.text.secondary,
    },
    subtitle1:{
      fontFamily: ['Inter', 'sans-serif'].join(','),
      fontSize: 22,
      color: tokens.text.secondary,
    },
    subtitle2:{
      fontFamily: ['Inter', 'sans-serif'].join(','),
      fontSize: 16,
      color: tokens.text.secondary,
    },
    body1:{
      fontFamily: ['Inter', 'sans-serif'].join(','),
      fontSize: 14,
      color: tokens.text.tertiary
    },
    body2:{
      fontFamily: ['Inter', 'sans-serif'].join(','),
      fontSize: 12,
      color: tokens.text.secondary,
    }
  },
  shape: {
    borderRadius: 2,
  },
  spacing: 8,
  spacingProperties: {
    margin: {
      small: 4,
      medium: 8,
      large: 16,
    },
    marginBottom: {
      small: 4,
      medium: 8,
      large: 16,
    },
  },
 
};
