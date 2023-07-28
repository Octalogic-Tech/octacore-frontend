import { BreadCrumbs, fabStyle } from '@octacore-frontend/shared-ui';
import { styled } from '@mui/material/styles';
import { Box, Fab, InputBase, Typography } from '@mui/material';
import {
  CategoryData,
  borderParameter,
  breadCrumbsConstants,
  searchFieldFigma,
} from '@octacore-frontend/constant';
import CategoriesTable from '../components/CategoriesTable';
import { useEffect, useState } from 'react';
import AddCategoryModal from '../components/AddCategoryModal';
import SearchIcon from '@mui/icons-material/Search';
import { Add } from '@mui/icons-material';

//table heading custom mui start here------
const TableHeadingBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  margin: '0 0 0.5rem 0',
  padding: '0px 0.3rem',
  [theme.breakpoints.down('sm')]: {
    flexDirection: 'column',
    alignItems: 'start',
    justifyContent: 'center',
  },
}));

const Search = styled('div')(({ theme }) => ({
  position: 'relative',
  borderRadius: borderParameter.containerRadius,
  border: searchFieldFigma.border,
  backgroundColor: searchFieldFigma.backgroundColor,
  marginLeft: 0,
  width: '100%',
  padding: 0,
  boxShadow: 'none',
  [theme.breakpoints.up('sm')]: {
    marginLeft: theme.spacing(1),
    width: 'auto',
  },
  [theme.breakpoints.down('sm')]: {
    width: '100%',
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
    padding: theme.spacing(0.4, 0.3, 0.3, 0),
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

//categories functional components start here---------------
function Categories() {
  const array = new Array(5).fill('values');
  const currentPage = breadCrumbsConstants.core.category;
  const currentProject = breadCrumbsConstants.core.name;
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [addCategoryTextFieldData, setAddCategoryTextFieldData] =
    useState<CategoryData>({ name: '', description: '' });

  //handling useEffect for the initial fetching category
  useEffect(() => {
    fetchCategoryData();
  }, []);

  //backend call for listing all categories
  function fetchCategoryData() {
    return '';
  }

  //handle category data function
  const handleCategorySubmit = () => {
    console.log(addCategoryTextFieldData);
  };

  //category jsx syntax start here
  return (
    <>
      <BreadCrumbs currentProject={currentProject} currentPage={currentPage} />
      <TableHeadingBox>
        <Typography variant="h5" sx={{ textTransform: 'uppercase' }}>
          Categories
        </Typography>
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
      <CategoriesTable
        categoriesArray={array}
        fetchCategoryData={fetchCategoryData}
      />
      <Fab
        aria-label="add"
        variant="extended"
        sx={fabStyle}
        onClick={() => setAddCategoryOpen(true)}
      >
        <Add />
        Add Categories
      </Fab>
      <AddCategoryModal
        addCategoryOpen={addCategoryOpen}
        setAddCategoryOpen={setAddCategoryOpen}
        addCategoryTextFieldData={addCategoryTextFieldData}
        setAddCategoryTextFieldData={setAddCategoryTextFieldData}
        handleCategorySubmit={handleCategorySubmit}
      />
    </>
  );
}

export default Categories;
