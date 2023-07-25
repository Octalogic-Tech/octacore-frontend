import { BreadCrumbs } from '@octacore-frontend/shared-ui';
import { styled } from '@mui/material/styles';
import { Box, Button, Modal, TextField, Typography } from '@mui/material';
import { breadCrumbsConstants, navBarFigma } from '@octacore-frontend/constant';
import { Add } from '@mui/icons-material';
import CategoriesTable from '../components/CategoriesTable';
import { useState } from 'react';

const TableHeadingBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginTop: '1rem',
  padding: '0px 0.3rem',
}));

const StyledModal = styled(Modal)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  width: '100vw',
}));

const style = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: { xs: '100vw', sm: '80vw', md: 600 },
  bgcolor: navBarFigma.activeButtonColor,
  boxShadow: 24,
  padding: {xs: 1,sm:2, md:4 },
  borderRadius: {xs: 1,sm:2, md:4 }
};

function Categories() {
  const array = new Array(5).fill('values');
  const currentPage = breadCrumbsConstants.core.category;
  const currentProject = breadCrumbsConstants.core.name;
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  return (
    <>
      <BreadCrumbs currentProject={currentProject} currentPage={currentPage} />
      <TableHeadingBox>
        <Typography variant="h5">CATEGORIES</Typography>
        <Button
          size="small"
          color="secondary"
          startIcon={<Add />}
          sx={{
            padding: 0,
          }}
          onClick={() => setAddCategoryOpen(true)}
        >
          Add Category
        </Button>
      </TableHeadingBox>
      <CategoriesTable categoriesArray={array} />
      <StyledModal
        open={addCategoryOpen}
        onClose={() => setAddCategoryOpen(false)}
        aria-labelledby="modal-modal-title"
        aria-describedby="modal-modal-description"
      >
        <Box sx={style}>
          <Typography variant="h4" textAlign={'center'} color="secondary">
            New Category
          </Typography>
          <Box width="100%">
            <TextField
              id="standard-password-input"
              label="Name"
              type="text"
              variant="standard"
              fullWidth
              color="secondary"
            />
            <TextField
              id="standard-password-input"
              label="Description"
              type="text"
              variant="standard"
              multiline
              fullWidth
              minRows={4}
              color="secondary"
            />
            <Button
              variant="contained"
              color="secondary"
              fullWidth
              sx={{ marginTop: '1rem' }}
            >
              Submit
            </Button>
          </Box>
        </Box>
      </StyledModal>
    </>
  );
}

export default Categories;
