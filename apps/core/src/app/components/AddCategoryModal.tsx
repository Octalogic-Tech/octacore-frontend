import { Box, FormControl, OutlinedInput, Typography } from '@mui/material';
import {
  AddCategoryModalProps,
  colorParameter,
  marginParameters,
  textSizeParameter,
} from '@octacore-frontend/constant';
import {
  DialogBoxModal,
  SubmitButton,
  customPopupBoxStyle,
} from '@octacore-frontend/shared-ui';
import React from 'react';

function AddCategoryModal(props: AddCategoryModalProps) {
  const {
    addCategoryOpen,
    setAddCategoryOpen,
    handleCategorySubmit,
    addCategoryTextFieldData,
    setAddCategoryTextFieldData,
  } = props;

  return (
    <DialogBoxModal
      open={addCategoryOpen}
      onClose={() => setAddCategoryOpen(false)}
      aria-labelledby="modal-modal-title"
      aria-describedby="modal-modal-description"
    >
      <Box sx={customPopupBoxStyle}>
        <Typography
          variant="h5"
          mb={1}
          sx={{ marginBottom: marginParameters.marginBottom }}
        >
          New Category
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
                onChange={(e) =>
                  setAddCategoryTextFieldData({
                    ...addCategoryTextFieldData,
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
                onChange={(e) =>
                  setAddCategoryTextFieldData({
                    ...addCategoryTextFieldData,
                    description: e.target.value,
                  })
                }
              />
            </FormControl>
          </Box>

          <SubmitButton
            variant="contained"
            fullWidth
            onClick={handleCategorySubmit}
          >
            Submit
          </SubmitButton>
        </Box>
      </Box>
    </DialogBoxModal>
  );
}

export default AddCategoryModal;
