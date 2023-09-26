import { Box, FormControl, OutlinedInput, Typography } from '@mui/material';
import React from 'react';
import {
  DialogBoxModal,
  EditCategoryModalProps,
  SubmitButton,
  colorParameter,
  customPopupBoxStyle,
  marginParameters,
  textSizeParameter,
} from '@octacore-frontend/constant';

import { Formik, Form, ErrorMessage, FormikValues, Field } from 'formik';
import * as Yup from 'yup';
import { updateCategoryTable } from '@octacore-frontend/services/categories';

const validationSchema = Yup.object({
  name: Yup.string().required('Category Name is required'),
  description: Yup.string().required('Category Description is required'),
});

//main edit compenent section here---------------------
function EditCategoryModal(props: EditCategoryModalProps) {
  const {
    editCategoryData,
    editModalOpen,
    setEditModalOpen,
    handleEdiCategorysubmit,
  } = props;


  const handleEditedData = (values: FormikValues) => {
    updateCategoryTable()
    handleEdiCategorysubmit();
  };

  const initialValues = {
    name: editCategoryData.name || '',
    description: editCategoryData.description || '',
  };

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
          <Formik
            initialValues={initialValues}
            validationSchema={validationSchema}
            onSubmit={handleEditedData}
          >
            <Form>
              <FormControl fullWidth sx={{ padding: 0, marginBottom: marginParameters.marginBottom }}>
                <Field
                  as={OutlinedInput}
                  name="name"
                  placeholder="Enter Category Name"
                  sx={{
                    padding: 0,
                    fontSize: textSizeParameter.fourteenPx,
                    color: colorParameter.darkGray,
                  }}
                />
                <ErrorMessage name="name">
                  {(msg) => (
                    <Typography variant="body2" color="error">
                      {msg}
                    </Typography>
                  )}
                </ErrorMessage>
              </FormControl>
              <FormControl fullWidth sx={{ padding: 0, marginBottom: marginParameters.marginBottom }}>
                <Field
                  as={OutlinedInput}
                  multiline
                  minRows={4}
                  name="description"
                  placeholder="Enter Category Description"
                  sx={{
                    padding: '0.8rem 0.8rem',
                    fontSize: textSizeParameter.fourteenPx,
                    color: colorParameter.darkGray,
                  }}
                />
                <ErrorMessage name="description">
                  {(msg) => (
                    <Typography variant="body2" color="error">
                      {msg}
                    </Typography>
                  )}
                </ErrorMessage>
              </FormControl>
              <SubmitButton
                type='submit'
                variant="contained"
                fullWidth
              >
                Submit
              </SubmitButton>
            </Form>
          </Formik>
        </Box>
      </Box>
    </DialogBoxModal>
  );
}

export default EditCategoryModal;
