import { Box, FormControl, OutlinedInput, Typography } from '@mui/material';
import {
    DialogBoxModal,
    SubmitButton,
    colorParameter,
    customPopupBoxStyle,
    marginParameters,
    textSizeParameter,
} from '@octacore-frontend/constant';
import React from 'react';
//formik
import { ErrorMessage, Field, Form, Formik, FormikValues } from 'formik';
import * as Yup from 'yup'

const validationSchema = Yup.object({
    name: Yup.string().required('Technology Name is required'),
    description: Yup.string().required('Technology Description is required'),
});

interface TechnologyAddDialogProps {
    technologyAddDialogOpen: boolean,
    setTehnologyAddDialogOpen: React.Dispatch<React.SetStateAction<boolean>>
    handleAddnewTechnology: () => void
}

export function TechnologyAddDialog(props: TechnologyAddDialogProps) {
    const {
        technologyAddDialogOpen,
        setTehnologyAddDialogOpen,
        handleAddnewTechnology
    } = props;

    const initialValues = {
        name: "",
        description: ""
    }

    const handleNewData = (value: FormikValues) => {
        setTehnologyAddDialogOpen(false)
        handleAddnewTechnology()
        return
    }

    return (
        <DialogBoxModal
            open={technologyAddDialogOpen}
            onClose={() => setTehnologyAddDialogOpen(false)}
            aria-labelledby="modal-modal-title"
            aria-describedby="modal-modal-description"
        >
            <Box sx={customPopupBoxStyle}>
                <Typography
                    variant="subtitle2"
                    mb={1}
                    sx={{ marginBottom: marginParameters.marginBottom }}
                >
                    New Technology
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

export default TechnologyAddDialog;