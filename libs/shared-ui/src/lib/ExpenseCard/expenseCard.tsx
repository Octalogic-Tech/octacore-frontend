import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import { Box, Button, Chip, useTheme } from '@mui/material';
import { styled } from '@mui/material/styles';
import { cardFigma, colorParameter } from '@octacore-frontend/constant';

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
  const {palette} = useTheme()
  return (
    <Card sx={{ padding: '0.5rem', maxWidth: 400 }}>
      <CardHeadBox>
        <Typography variant='body2'>Outstanding</Typography>
        <Chip
          label="24%"
          sx={{
            height: '1rem',
            margin: 0,
            background: palette.primary.light,
            color: palette.primary.main,
          }}
        />
      </CardHeadBox>
      <CardFirstContentBox>
        <Typography variant="h6" mr={1} component="div">
          $5600
        </Typography>
        <Typography variant="body2"> from $4400 Last month</Typography>
      </CardFirstContentBox>
      <CardContentBox></CardContentBox>
      <CardHeadBox>
        <Button disabled size="small">
          {currentMonth}
        </Button>
        <Button size="small" sx={{ color: colorParameter.darkPink }}>
          View All
        </Button>
      </CardHeadBox>
    </Card>
  );
};
