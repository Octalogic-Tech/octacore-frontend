import { InputBase } from '@mui/material';
import { styled } from '@mui/material/styles';
import { borderParameter, searchFieldFigma } from './design-system-variable';
export const Search = styled('div')(({ theme }) => ({
  position: 'relative',
  borderRadius: borderParameter.containerRadius,
  border: searchFieldFigma.border,
  backgroundColor: searchFieldFigma.backgroundColor,
  marginLeft: 0,
  width: '100%',
  padding: 0,
  boxShadow: 'none',
  [theme.breakpoints.up('sm')]: {
    marginLeft: theme.spacing(1),
    width: 'auto',
  },
  [theme.breakpoints.down('sm')]: {
    width: '100%',
  },
}));

export const SearchIconWrapper = styled('div')(({ theme }) => ({
  padding: theme.spacing(0, 2),
  height: '100%',
  position: 'absolute',
  pointerEvents: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}));

export const StyledInputBase = styled(InputBase)(({ theme }) => ({
  color: 'inherit',
  '& .MuiInputBase-input': {
    padding: theme.spacing(0.4, 0.3, 0.3, 0),
    // vertical padding + font size from searchIcon
    paddingLeft: `calc(1em + ${theme.spacing(4)})`,
    transition: theme.transitions.create('width'),
    width: '100%',
    [theme.breakpoints.up('sm')]: {
      width: '12ch',
      '&:focus': {
        width: '20ch',
      },
    },
  },
}));
