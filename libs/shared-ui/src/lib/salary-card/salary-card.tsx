import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import { Button, Box } from '@mui/material';
import { styled } from '@mui/material/styles';
import { cardFigma, colorParameter} from '@octacore-frontend/constant';

export interface SalaryCardProps {
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

export const SalaryCard = (props: SalaryCardProps) => {
  const { currentMonth } = props;
  return (
    <Card sx={{ padding: '0.5rem', maxWidth: 400 }}>
      <CardHeadBox>
        <Typography>Outstanding</Typography>
      </CardHeadBox>
      <CardFirstContentBox>
        <Typography variant="h5" mr={1} component="div">
          7000
        </Typography>
        <Typography variant="h6"> from 1,40,400</Typography>
      </CardFirstContentBox>
      <CardContentBox></CardContentBox>
      <CardHeadBox>
        <Button disabled size="small">
          {currentMonth}
        </Button>
        <Button size="small" sx={{ color: colorParameter.darkGray }}>
          View All
        </Button>
      </CardHeadBox>
    </Card>
  );
};
