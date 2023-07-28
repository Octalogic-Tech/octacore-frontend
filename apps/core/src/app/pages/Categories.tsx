import { BreadCrumbs } from '@octacore-frontend/shared-ui';
import { styled } from '@mui/material/styles';
import { Box, Fab, Typography } from '@mui/material';
import {
  CategoryData,
  CategoryDataArrayType,
  Search,
  SearchIconWrapper,
  StyledInputBase,
  breadCrumbsConstants,
  fabStyle,
} from '@octacore-frontend/constant';
import CategoriesTable from '../components/CategoriesTable';
import { useEffect, useState } from 'react';
import AddCategoryModal from '../components/AddCategoryModal';
import SearchIcon from '@mui/icons-material/Search';
import { Add } from '@mui/icons-material';
import axios from 'axios';

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

type temporaryData = {
  id: number
  userId: number
  body: string
  title: string
}

//categories functional components start here---------------
function Categories() {
  const [categoryData, setCategoryData] =
    useState<CategoryDataArrayType | null>(null);
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
  async function fetchCategoryData() {
    const data = await axios('https://jsonplaceholder.typicode.com/posts');
    const currentDate = new Date();
    setCategoryData(
      data.data.map((val: temporaryData) => {
        return {
          id: val.id,
          name: val.title,
          description: val.body,
          updated: `${currentDate.getMonth() + 1}/${currentDate.getFullYear()}`,
          created: `${currentDate.getMonth() + 1}/${
            currentDate.getFullYear() - 1
          }`,
        };
      })
    );
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
        categoryData={categoryData}
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
