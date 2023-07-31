import { Box, FormControl, OutlinedInput, Typography } from '@mui/material';
import React, { useState } from 'react';
import {
  DialogBoxModal,
  EditCategoryModalProps,
  SubmitButton,
  colorParameter,
  customPopupBoxStyle,
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

  const [validationrror, setValidationError] = useState(false)
  

  const handleValidateData = () => {
    if(editCategoryData.name && editCategoryData.description){
      setValidationError(false)
      handleEdiCategorysubmit()
    }
    else{
      setValidationError(true)
    }
    
  }

  return (
    <DialogBoxModal
      open={editModalOpen}
      onClose={() => setEditModalOpen(false)}
      aria-labelledby="modal-modal-title"
      aria-describedby="modal-modal-description"
    >
      <Box sx={customPopupBoxStyle}>
        <Typography
          variant="subtitle2"
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
          >
            <FormControl fullWidth sx={{ padding: 0, marginBottom:marginParameters.marginBottom}}>
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
            <FormControl fullWidth sx={{ padding: 0, marginBottom:marginParameters.marginBottom}}>
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

export default EditCategoryModal;
