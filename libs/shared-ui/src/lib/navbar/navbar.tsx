import { styled } from '@mui/material/styles';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  Typography,
} from '@mui/material';
import {
  NavTabs,
  NavTabsInterface,
  marginParameters,
} from '@octacore-frontend/constant';
import { Link } from 'react-router-dom';
import { Logout } from '@mui/icons-material';
import { useTheme } from '@mui/material';
export interface NavbarProps {
  activeTab: string;
}

const CustomeNavIconBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  width: '52px',
  height: '50px',
  borderRadius: theme.shape.borderRadius,
  padding: 0,
}));

const BoxFixed = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  position: 'sticky',
  minHeight: '100%',
  padding: '0.6rem 1rem',
  width: '84px',
}));

export function Navbar(props: NavbarProps) {
  const { activeTab } = props;
  const { palette, shape } = useTheme()
  return (
    <BoxFixed>
      <List>
        <ListItem disablePadding sx={{
          marginBottom: '3rem'
        }}>
          <ListItemButton disableGutters sx={{ padding: 0, margin: 0 }}>
            <img
              src={require('../../../../../assets/Logo.png')}
              alt="octalogic"
              width="48px"
            />
          </ListItemButton>
        </ListItem>
        {NavTabs.map((tab: NavTabsInterface, index: number) => (
          <ListItem disablePadding key={index} sx={{
            marginBottom: marginParameters.marginBottom
          }}>
            <ListItemButton
              component={Link}
              to={tab.navTo}
              sx={{
                background:
                  activeTab === tab.tab ? palette.secondary.light : '',
                color: activeTab === tab.tab ? palette.secondary.main : palette.text.secondary,
                borderRadius: shape.borderRadius,
                padding: 0,
                margin: 0,
              }}
              disableGutters
            >
              <CustomeNavIconBox>
                <tab.icon />
                <Typography
                  variant='body2'
                  color={activeTab === tab.tab ? palette.secondary.main : palette.text.secondary}
                >
                  {tab.tab}
                </Typography>
              </CustomeNavIconBox>
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <List>
        <ListItem disablePadding>
          <ListItemButton disableGutters>
            <CustomeNavIconBox>
              <Logout sx={{ color: palette.text.secondary }} />
              <Typography fontSize={12}>Logout</Typography>
            </CustomeNavIconBox>
          </ListItemButton>
        </ListItem>
      </List>
    </BoxFixed>
  );
}
