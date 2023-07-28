import { Box, Fab, Typography } from '@mui/material';
import { SupportProjectTable } from '../components/SupportProjectTable';
import SearchIcon from '@mui/icons-material/Search';
import { styled } from '@mui/material/styles';
import { Add } from '@mui/icons-material';
import {
  Search,
  SearchIconWrapper,
  StyledInputBase,
  fabStyle,
} from '@octacore-frontend/constant';
import { BreadCrumbs } from '@octacore-frontend/shared-ui';

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
      <Fab aria-label="add" variant="extended" sx={fabStyle}>
        <Add />
        Add Technology
      </Fab>
    </>
  );
}

export default ProjectTechnology;
