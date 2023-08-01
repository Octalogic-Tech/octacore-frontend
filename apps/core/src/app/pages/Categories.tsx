import { BreadCrumbs } from '@octacore-frontend/shared-ui';
import { styled } from '@mui/material/styles';
import { Box, Typography, useTheme } from '@mui/material';
import {
  Search,
  SearchIconWrapper,
  StyledInputBase,
  breadCrumbsConstants,
} from '@octacore-frontend/constant';
import CategoriesTable from '../components/CategoriesTable';
import SearchIcon from '@mui/icons-material/Search';
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

//categories functional components start here---------------
function Categories() {
  const currentPage = breadCrumbsConstants.core.category;
  const currentProject = breadCrumbsConstants.core.name;
  const { palette } = useTheme()

  //category jsx syntax start here
  return (
    <>
      <BreadCrumbs currentProject={currentProject} currentPage={currentPage} />
      <TableHeadingBox>
        <Typography variant="subtitle2" sx={{ textTransform: 'uppercase' }}>
          Categories
        </Typography>
        <Search>
          <SearchIconWrapper>
            <SearchIcon sx={{ color: palette.text.secondary }} />
          </SearchIconWrapper>
          <StyledInputBase
            placeholder="Search…"
            inputProps={{ 'aria-label': 'search' }}
          />
        </Search>
      </TableHeadingBox>
      <CategoriesTable />
    </>
  );
}

export default Categories;
