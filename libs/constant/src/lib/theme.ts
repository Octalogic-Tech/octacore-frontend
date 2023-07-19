import { createTheme } from '@mui/material/styles';
import { activeBarsColorVariables, designVariable } from './design-system-variable';

// themes for the root projects
export const mainRootTheme = createTheme({
  palette: {
    primary: {
      main: designVariable.palette.primaryColor,
    },
    secondary: {
      main: designVariable.palette.secondaryColor,
    },
    success: {
      main: '#00e676',
    },
  },
  typography: {
    fontFamily: designVariable.typography.fontFamily,
    allVariants: {
      color: 'gray',
    },
    h6:{
      fontSize:'0.7rem'
    },
    h4:{
      fontSize:'2rem',
      fontWeight: 'bolder',
    },
    h5: {
      fontSize: '1.2rem'
    }
  },
});

//theme for the tables
export const tableThemeProvider = createTheme({
  components: {
    MuiTable:{
      styleOverrides: {
        root: {
          minWidth:650,
        }
      }
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 700,
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:last-child td, &:last-child th': {
            border: 0,
          },
        },
      },
    },
  },
});

//themes for the navbars drawer
export const leftMostNavBarThemeProvider = createTheme({
  components: {
    MuiListItemButton: {
      styleOverrides: {
        root: {
          minHeight: 48,
          width: "4rem",
          borderRadius: '0.3rem',
          margin: '0.1rem',
          '&:hover': {
            background: activeBarsColorVariables.activeNavItemColor,
            color: activeBarsColorVariables.activeNavIconColor,
          },
        },
      },
    },
    MuiTypography: {
      styleOverrides: {
        root: {
          fontSize: '0.7rem',
        },
      },
    },
    MuiStack:{
      defaultProps:{
        width:'100%',
        alignItems:'center',
        padding:'0px'
      }
    },
  },
});

//card theme provider section
export const cardThemeProvider = createTheme({
  palette: {
    success: {
      main:'#00c853'
    }
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: { 
          maxWidth: 400,
          background:"white",
          padding:'0.3rem',
        }
      }
    },
    MuiStack: {
      defaultProps: {
          justifyContent:'space-between',
          alignItems:'center',
      }
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          height: 50,
          background: "#cfd8dc",
          }
      }
    },
    MuiCardActions: {
      styleOverrides: {
        root:{
          display: "flex",
          justifyContent:"space-between"
        }
      }
    }
  }
})

export const dollerCardThemeProvider = createTheme({
  typography:{
    h6:{
      fontSize:'0.7rem'
    }
  },
  components:{
    MuiStack:{
      defaultProps:{
        justifyContent:'start',
        alignItems:'center'
      }
    }
  }
})


//logoStack theme provide
export const logoStackThemeProvide = createTheme({
  components:{
    MuiStack: {
      defaultProps: {
        margin:'1rem 0',
        alignItems: 'center',

      }
    }
  }
})


export const nestedNavThemeProvider = createTheme({
  components: {
    MuiStack: {
      defaultProps: {
        minHeight: '100vh',
      },
    },
    MuiListItem: {
      styleOverrides: {
        root: {
          borderRadius: "0.3rem",
          '&:hover': {
            background: activeBarsColorVariables.activeNavItemColor,
            color: activeBarsColorVariables.activeNavIconColor,
          },
        }
      }
    },
  }
});

//theme for over view and technology pages
export const overviewTechnologyThemProvider = createTheme({
  typography:{
    h4:{
      fontSize:'1.5rem'
    }
  }
})

//add technology button theme provider
export const buttonThemeProvider = createTheme({
  components: {
    MuiButton:{
      styleOverrides: {
        root: {
          position:'absolute',
          right:'7%',
          bottom:'7%',
          background: activeBarsColorVariables.activeNavItemColor,
        }
      }
    }
  }
})