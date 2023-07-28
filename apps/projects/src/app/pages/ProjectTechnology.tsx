import { Box, Fab, Typography } from '@mui/material';
import { SupportProjectTable } from '../components/SupportProjectTable';
import SearchIcon from '@mui/icons-material/Search';
import { styled } from '@mui/material/styles';
import InputBase from '@mui/material/InputBase';
import { Add } from '@mui/icons-material';
import { borderParameter, colorParameter, searchFieldFigma } from '@octacore-frontend/constant';
import { BreadCrumbs } from '@octacore-frontend/shared-ui';

const Search = styled('div')(({ theme }) => ({
  position: 'relative',
  borderRadius: borderParameter.containerRadius,
  border: searchFieldFigma.border,
  backgroundColor: searchFieldFigma.backgroundColor,
  '&:hover': {
    backgroundColor: searchFieldFigma.hoverColor,
  },
  marginLeft: 0,
  width: '100%',
  height: 32,
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

const TableHeadingBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  margin: '0 0 0.5rem 0',
  padding: '0px 0.3rem',
}));

function ProjectTechnology() {
  const array = new Array(5).fill('values');
  const [currentProject, currentPage] = ['Projects', 'technology'];
  return (
    <>
      <BreadCrumbs currentPage={currentPage} currentProject={currentProject} />
      <TableHeadingBox>
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
      </TableHeadingBox>
      <SupportProjectTable supportTableData={array} />
      <Fab
        aria-label="add"
        variant="extended"
        sx={{
          position: 'fixed',
          bottom: 20,
          right: { xs: 'calc(15%)', md: 30 },
          background: colorParameter.lightPink,
        }}
      >
        <Add />
        Add Technology
      </Fab>
    </>
  );
}

export default ProjectTechnology;
