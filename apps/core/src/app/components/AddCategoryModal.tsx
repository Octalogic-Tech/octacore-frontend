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
import { ErrorMessage, Field, Form, Formik, FormikValues } from 'formik';
import * as Yup from 'yup'
import React from 'react';
import { postNewCategory } from '@octacore-frontend/services/categories';

const validationSchema = Yup.object({
  name: Yup.string().required('Category Name is required'),
  description: Yup.string().required('Category Description is required'),
});

export function AddCategoryModal(props: AddCategoryModalProps) {
  const {
    addCategoryOpen,
    setAddCategoryOpen,
    handleAddNewCategory
  } = props;

  const initialValues = {
    name: "",
    description: ""
  }

  const handleNewData = (value: FormikValues) => {
    postNewCategory()
    setAddCategoryOpen(false)
    handleAddNewCategory()
    return
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
          <Formik
            initialValues={initialValues}
            onSubmit={handleNewData}
            validationSchema={validationSchema}>
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

export default AddCategoryModal;
