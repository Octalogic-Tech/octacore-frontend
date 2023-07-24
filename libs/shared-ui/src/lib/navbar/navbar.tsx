import { styled } from '@mui/material/styles';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  Stack,
  Typography,
} from '@mui/material';
import {
  NavTabs,
  NavTabsInterface,
  navBarFigma,
} from '@octacore-frontend/constant';
import { Link } from 'react-router-dom';
import { Logout } from '@mui/icons-material';
export interface NavbarProps {
  activeTab: string;
}

const StockIcon = styled(Stack)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '40px',
  borderRadius: theme.shape.borderRadius,
}));

const BoxFixed = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  position: 'sticky',
  minHeight: '100%',
}));

export function Navbar(props: NavbarProps) {
  const { activeTab } = props;
  return (
    <BoxFixed>
      <List sx={{ margin: '0.1rem' }}>
        <ListItem disablePadding>
          <ListItemButton>
            <img
              src={require('../../../../../assets/Logo.png')}
              alt="octalogic"
              width="40px"
            />
          </ListItemButton>
        </ListItem>
        <br />
        {NavTabs.map((tab: NavTabsInterface, index: number) => (
          <ListItem disablePadding key={index}>
            <ListItemButton
              component={Link}
              to={tab.navTo}
              sx={{
                background:
                  activeTab === tab.tab ? navBarFigma.activeButtonColor : '',
                color: activeTab === tab.tab ? 'secondary.main' : '',
                borderRadius: 1,
              }}
            >
              <StockIcon>
                <tab.icon />
                <Typography
                  fontSize={12}
                  color={
                    props.activeTab === tab.tab
                      ? navBarFigma.activeIconColor
                      : ''
                  }
                >
                  {tab.tab}
                </Typography>
              </StockIcon>
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <List>
        <ListItem disablePadding>
          <ListItemButton>
            <StockIcon>
              <Logout />
              <Typography fontSize={12}>Logout</Typography>
            </StockIcon>
          </ListItemButton>
        </ListItem>
      </List>
    </BoxFixed>
  );
}
