import { Box, FormControl, OutlinedInput, Typography } from '@mui/material';
import {
    DialogBoxModal,
    SubmitButton,
    colorParameter,
    customPopupBoxStyle,
    marginParameters,
    textSizeParameter,
} from '@octacore-frontend/constant';
//formik
import { ErrorMessage, Field, Form, Formik, FormikValues } from 'formik';
import * as Yup from 'yup'
import React from 'react';

const validationSchema = Yup.object({
    name: Yup.string().required('Technology Name is required'),
    description: Yup.string().required('Technology Description is required'),
});

type technologyEditDataType = {
    id: number,
    name: string;
    description: string;
}

interface TechnologyEditDialogProps {
    technologyEditDialogOpen: boolean,
    setTechnologyEditDialogOpen: React.Dispatch<React.SetStateAction<boolean>>
    handleEditTechnology: () => void
    technologyEditData: technologyEditDataType
    setEditTehnologyData:  React.Dispatch<React.SetStateAction<technologyEditDataType>>
}

export function TechnologyEditDialog(props: TechnologyEditDialogProps) {
    const {
        technologyEditDialogOpen,
        setTechnologyEditDialogOpen,
        handleEditTechnology,
        technologyEditData,
    } = props;

    const initialValues = {
        name: technologyEditData.name || '',
        description: technologyEditData.description || '',
      };

    const handleNewData = (value: FormikValues) => {
        setTechnologyEditDialogOpen(false)
        handleEditTechnology()
        return
    }

    return (
        <DialogBoxModal
            open={technologyEditDialogOpen}
            onClose={() => setTechnologyEditDialogOpen(false)}
            aria-labelledby="modal-modal-title"
            aria-describedby="modal-modal-description"
        >
            <Box sx={customPopupBoxStyle}>
                <Typography
                    variant="subtitle2"
                    mb={1}
                    sx={{ marginBottom: marginParameters.marginBottom }}
                >
                    Edit Technology
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
                                    placeholder="Enter Technology Name"
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
                                    placeholder="Enter Technology Description"
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

export default TechnologyEditDialog;