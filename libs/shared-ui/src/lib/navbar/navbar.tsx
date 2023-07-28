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
  borderParameter,
  colorParameter,
  marginParameters,
} from '@octacore-frontend/constant';
import { Link } from 'react-router-dom';
import { Logout } from '@mui/icons-material';
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
  borderRadius: borderParameter.containerRadius,
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
  return (
    <BoxFixed>
      <List>
        <ListItem disablePadding sx={{
          marginBottom: '3rem'
        }}>
          <ListItemButton disableGutters sx={{padding:0, margin:0}}>
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
                  activeTab === tab.tab ? colorParameter.lightPink : '',
                color: activeTab === tab.tab ? 'secondary.main' : '',
                borderRadius: borderParameter.containerRadius,
                padding: 0, 
                margin: 0,
              }}
              disableGutters
            >
              <CustomeNavIconBox>
                <tab.icon />
                <Typography
                  fontSize={12}
                  color={
                    props.activeTab === tab.tab
                      ? 'secondary.main'
                      : ''
                  }
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
              <Logout />
              <Typography fontSize={12}>Logout</Typography>
            </CustomeNavIconBox>
          </ListItemButton>
        </ListItem>
      </List>
    </BoxFixed>
  );
}
