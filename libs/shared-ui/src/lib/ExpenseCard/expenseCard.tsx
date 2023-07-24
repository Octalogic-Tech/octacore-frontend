import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import { Box, Button, Chip } from '@mui/material';
import { styled } from '@mui/material/styles';
import { cardFigma, navBarFigma } from '@octacore-frontend/constant';

export interface ExpenseCardProps {
  currentMonth: string;
}

const CardHeadBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'space-between',
}));

const CardFirstContentBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'start',
  alignItems: 'center',
  Padding: '0.5rem 0',
}));

const CardContentBox = styled(CardContent)(({ theme }) => ({
  height: cardFigma.cardContentHeight,
  background: cardFigma.cardContentColor,
}));

export const ExpenseCards = (props: ExpenseCardProps) => {
  const { currentMonth } = props;
  return (
    <Card sx={{ padding: '0.5rem' }}>
      <CardHeadBox>
        <Typography>Outstanding</Typography>
        <Chip
          label="24%"
          sx={{
            height: '1rem',
            margin: 0,
            background: cardFigma.chipBackgroundColor,
            color: cardFigma.chipTextColor,
          }}
        />
      </CardHeadBox>
      <CardFirstContentBox>
        <Typography variant="h5" mr={1} component="div">
          $5600
        </Typography>
        <Typography variant="h6"> from $4400 Last month</Typography>
      </CardFirstContentBox>
      <CardContentBox></CardContentBox>
      <CardHeadBox>
        <Button disabled size="small">
          {currentMonth}
        </Button>
        <Button size="small" sx={{ color: navBarFigma.activeIconColor }}>
          View All
        </Button>
      </CardHeadBox>
    </Card>
  );
};
