import Card from '@mui/material/Card';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Typography from '@mui/material/Typography';
import { ThemeProvider } from '@emotion/react';
import { cardThemeProvider, dollerCardThemeProvider } from '@octacore-frontend/constant';
import { Button, Stack } from '@mui/material';



export interface SalaryCardProps {
  currentMonth: string;
}



export const SalaryCard = (props: SalaryCardProps) => {
  const { currentMonth } = props

  return (
    <ThemeProvider theme={cardThemeProvider}>
       <Card>
      <Stack direction={'row'}>
        <Typography>Salary</Typography>
        </Stack>
        <ThemeProvider theme={dollerCardThemeProvider}>
        <Stack direction="row" spacing={1}>
      <Typography variant="h5" component="div">
        7000
      </Typography>
      <Typography variant="h6">
        from 4400 
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

