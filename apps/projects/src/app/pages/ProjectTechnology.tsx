// projects/src/app/pages/ProjectTechnology.tsx
import { Box, Button, ThemeProvider, Typography } from '@mui/material';
import { SupportProjectTable } from '../components/SupportProjectTable';
import AddIcon from '@mui/icons-material/Add';
import { activeBarsColorVariables, buttonThemeProvider } from '@octacore-frontend/constant';
import SearchIcon from '@mui/icons-material/Search';
import { styled, alpha } from '@mui/material/styles';
import InputBase from '@mui/material/InputBase';

const Search = styled('div')(({ theme }) => ({
  position: 'relative',
  borderRadius: theme.shape.borderRadius,
  backgroundColor: alpha(theme.palette.common.white, 0.15),
  '&:hover': {
    backgroundColor: alpha(theme.palette.common.white, 0.25),
  },
  marginLeft: 0,
  width: '100%',
  [theme.breakpoints.up('sm')]: {
    marginLeft: theme.spacing(1),
    width: 'auto',
  },
}));

const SearchIconWrapper = styled('div')(({ theme }) => ({
  padding: theme.spacing(0, 2),
  height: '100%',
  position: 'absolute',
  pointerEvents: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}));

const StyledInputBase = styled(InputBase)(({ theme }) => ({
  color: 'inherit',
  '& .MuiInputBase-input': {
    padding: theme.spacing(1, 1, 1, 0),
    // vertical padding + font size from searchIcon
    paddingLeft: `calc(1em + ${theme.spacing(4)})`,
    transition: theme.transitions.create('width'),
    width: '100%',
    [theme.breakpoints.up('sm')]: {
      width: '12ch',
      '&:focus': {
        width: '20ch',
      },
    },
  },
}));


function ProjectTechnology() {
  const array = new Array(5).fill("values")
  return(
  <>
  <Box textAlign="left">
        <Typography component="span">
          Projects/
          <Typography component="span" color="pink">Technology</Typography>
        </Typography>
        <Typography variant="h4" gutterBottom>Technology</Typography>
      </Box>
      <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ mt: 2 }}>
        <Typography variant="h5">SUPPORT PROJECT</Typography>
        <Search>
            <SearchIconWrapper>
              <SearchIcon />
            </SearchIconWrapper>
            <StyledInputBase  
              placeholder="Search…"
              inputProps={{ 'aria-label': 'search' }}
            />
          </Search>
      </Box>
      <SupportProjectTable supportTableData={array} />
      <ThemeProvider theme={buttonThemeProvider}>
      <Button  variant='contained' startIcon={<AddIcon/>}>Add Technology</Button>
      </ThemeProvider>
      
  </>
  )
}

export default ProjectTechnology;
