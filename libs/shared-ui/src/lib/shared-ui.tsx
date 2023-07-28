import { Box, Button, Modal } from '@mui/material';
import styles from './shared-ui.module.css';
import { styled } from '@mui/material/styles';
import {
  borderParameter,
  containerSpecFigma,
  fabButtonParameter,
} from '@octacore-frontend/constant';

//table heading custom mui start here------
export const TableHeadingBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  margin: '1rem 0 0.5rem 0',
  padding: '0px 0.3rem',
}));

//Submit Button Custom style--------------
export const SubmitButton = styled(Button)(({ theme }) => ({
  background: fabButtonParameter.buttonColor,
  color: fabButtonParameter.buttonTextColor,
  textTransform: 'capitalize',
  fontSize: fabButtonParameter.fontSize,
  borderRadius: fabButtonParameter.borderRadius,
  boxShadow: fabButtonParameter.boxShadow,
  height: '50px',
  '&:hover': {
    background: fabButtonParameter.buttonColor,
    boxShadow: fabButtonParameter.hoverBoxShadow,
  },
}));

//fab floating button style start here---------------
export const fabStyle = {
  position: 'fixed',
  bottom: { xs: 5, sm: 20 },
  right: { xs: 'calc(20%)', md: 30 },
  background: fabButtonParameter.buttonColor,
  color: fabButtonParameter.buttonTextColor,
  borderRadius: fabButtonParameter.borderRadius,
  hieght: fabButtonParameter.buttonHieght,
  textTransform: 'capitalize',
  gap: fabButtonParameter.gap,
  Padding: fabButtonParameter.padding,
  fontSize: fabButtonParameter.fontSize,
  boxShadow: fabButtonParameter.boxShadow,
  '&:hover': {
    background: fabButtonParameter.buttonColor,
    boxShadow: fabButtonParameter.hoverBoxShadow,
  },
};
//fab floating button style end here---------------

//app.tsx main layout styles start here--------------
export const NavbarBox = styled(Box)(({ theme }) => ({
  borderRight: '1px solid lightgray',
  flex: 1,
  padding: '0.1rem',
  minHeight: '100vh',
  [theme.breakpoints.up('xs')]: {
    display: 'none',
  },
  [theme.breakpoints.up('sm')]: {
    display: 'block',
  },
}));

export const NestedNavbarBox = styled(Box)(({ theme }) => ({
  flex: 4,
  padding: '0.1rem',
  [theme.breakpoints.up('xs')]: {
    display: 'none',
  },
  [theme.breakpoints.up('sm')]: {
    display: 'block',
  },
}));

export const MainContainerBox = styled(Box)(({ theme }) => ({
  [theme.breakpoints.down('sm')]: {
    marginTop: '60px',
  },
  [theme.breakpoints.up('sm')]: {
    marginTop: '0',
  },
}));

export const ContentContainer = styled(Box)(({ theme }) => ({
  gap: 32,
  flex: 18,
  background: containerSpecFigma.backgroundColor,
  [theme.breakpoints.up('xs')]: {
    padding: '0',
  },
  [theme.breakpoints.up('sm')]: {
    padding: containerSpecFigma.mainConatainerPadding,
  },
}));
//app.tsx main layout styles end here--------------

//dialog modal styling start here-----------------
// Custom style modal start here-------
export const DialogBoxModal = styled(Modal)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  width: '100vw',
}));

// Custom popup box style start here------
export const customPopupBoxStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: { xs: '100vw', sm: '80vw', md: 600 },
  bgcolor: '#ffff',
  boxShadow: 24,
  padding: { xs: 1, sm: 2, md: 4 },
  borderRadius: borderParameter.containerRadius,
};
//dialog modal styling start here-----------------

/* eslint-disable-next-line */
export interface SharedUiProps {}

export function SharedUi(props: SharedUiProps) {
  return (
    <div className={styles['container']}>
      <h1>Welcome to SharedUi!</h1>
    </div>
  );
}

export default SharedUi;
