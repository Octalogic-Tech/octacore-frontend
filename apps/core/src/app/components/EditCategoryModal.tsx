import { Box, FormControl, OutlinedInput, Typography } from '@mui/material';
import React from 'react';
import {
  DialogBoxModal,
  SubmitButton,
  customPopupBoxStyle,
} from '@octacore-frontend/shared-ui';
import {
  EditCategoryModalProps,
  colorParameter,
  marginParameters,
  textSizeParameter,
} from '@octacore-frontend/constant';

//main edit compenent section here---------------------
function EditCategoryModal(props: EditCategoryModalProps) {
  const {
    editCategoryData,
    setEditCategoryData,
    editModalOpen,
    setEditModalOpen,
    handleEdiCategorysubmit,
  } = props;

  return (
    <DialogBoxModal
      open={editModalOpen}
      onClose={() => setEditModalOpen(false)}
      aria-labelledby="modal-modal-title"
      aria-describedby="modal-modal-description"
    >
      <Box sx={customPopupBoxStyle}>
        <Typography
          variant="h5"
          mb={1}
          sx={{ marginBottom: marginParameters.marginBottom }}
        >
          Edit Category
        </Typography>
        <Box width="100%">
          <Box
            component="form"
            noValidate
            autoComplete="off"
            mb={marginParameters.marginBottom}
          >
            <FormControl fullWidth sx={{ padding: 0 }}>
              <OutlinedInput
                placeholder="Enter Category Name"
                sx={{
                  padding: 0,
                  fontSize: textSizeParameter.fourteenPx,
                  color: colorParameter.darkGray,
                }}
                value={editCategoryData.name}
                onChange={(e) =>
                  setEditCategoryData({
                    ...editCategoryData,
                    name: e.target.value,
                  })
                }
              />
            </FormControl>
          </Box>
          <Box
            component="form"
            noValidate
            autoComplete="off"
            mb={marginParameters.marginBottom}
          >
            <FormControl fullWidth>
              <OutlinedInput
                multiline
                minRows={4}
                placeholder="Enter Category Name"
                sx={{
                  padding: '0.8rem 0.8rem',
                  fontSize: textSizeParameter.fourteenPx,
                  color: colorParameter.darkGray,
                }}
                value={editCategoryData.description}
                onChange={(e) =>
                  setEditCategoryData({
                    ...editCategoryData,
                    description: e.target.value,
                  })
                }
              />
            </FormControl>
          </Box>

          <SubmitButton
            variant="contained"
            fullWidth
            onClick={handleEdiCategorysubmit}
          >
            Submit
          </SubmitButton>
        </Box>
      </Box>
    </DialogBoxModal>
  );
}

export default EditCategoryModal;
