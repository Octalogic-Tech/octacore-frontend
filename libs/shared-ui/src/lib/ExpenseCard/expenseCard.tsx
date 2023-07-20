import Card from '@mui/material/Card';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import { Button, CardActions, Chip, Stack,} from '@mui/material';
import { ThemeProvider } from '@mui/material';
import { cardThemeProvider, dollerCardThemeProvider } from '@octacore-frontend/constant';
import { Rowing } from '@mui/icons-material';

export interface ExpenseCardProps {
  currentMonth: string;
}


export const ExpenseCards = (props: ExpenseCardProps) => {
  const { currentMonth } = props


  return (
    <ThemeProvider theme={cardThemeProvider}>
        <Card>
      <Stack direction={'row'}>
        <Typography>Outstanding</Typography>
        <Chip color='success' label="24%" sx={{height:'1rem', margin:0,}}/>
        </Stack>
        <ThemeProvider theme={dollerCardThemeProvider}>
        <Stack direction="row" spacing={1}>
      <Typography variant="h5" component="div">
        $5600
      </Typography>
      <Typography variant="h6">
        from $4400 Last month
      </Typography>
    </Stack>
        </ThemeProvider>
      <CardContent>
      </CardContent>
      <CardActions disableSpacing>
        <Button disabled size='small'>{currentMonth}</Button>
        <Button size='small'>View All</Button>
      </CardActions>
    </Card>
    </ThemeProvider>
  );
}

