import { Box, FormControl, OutlinedInput, Typography } from '@mui/material';
import {
  AddCategoryModalProps,
  DialogBoxModal,
  SubmitButton,
  colorParameter,
  customPopupBoxStyle,
  marginParameters,
  textSizeParameter,
} from '@octacore-frontend/constant';
import React, { useState } from 'react';

export function AddCategoryModal(props: AddCategoryModalProps) {
  const {
    addCategoryOpen,
    setAddCategoryOpen,
    handleCategorySubmit,
    addCategoryTextFieldData,
    setAddCategoryTextFieldData,
  } = props;
  const [validationrror, setValidationError] = useState(false)

  const handleValidateData = () => {
    if (addCategoryTextFieldData.name && addCategoryTextFieldData.description) {
      setValidationError(false)
      handleCategorySubmit()
    }
    else {
      setValidationError(true)
    }
  }

    return (
      <DialogBoxModal
        open={addCategoryOpen}
        onClose={() => setAddCategoryOpen(false)}
        aria-labelledby="modal-modal-title"
        aria-describedby="modal-modal-description"
      >
        <Box sx={customPopupBoxStyle}>
          <Typography
            variant="subtitle2"
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
            >
              <FormControl fullWidth sx={{ padding: 0, marginBottom: marginParameters.marginBottom }}>
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
              <FormControl fullWidth sx={{ padding: 0, marginBottom: marginParameters.marginBottom }}>
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
            {validationrror?<Typography color='error'>All field must be filled</Typography>:''}
            <SubmitButton
              variant="contained"
              fullWidth
              onClick={handleValidateData}
            >
              Submit
            </SubmitButton>
          </Box>
        </Box>
      </DialogBoxModal>
    );
  }

export default AddCategoryModal;
