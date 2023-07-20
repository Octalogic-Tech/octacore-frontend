// projects/src/app/pages/ProjectTechnology.tsx
import { Box, Button, ThemeProvider, Typography } from '@mui/material';
import { SupportProjectTable } from './SupportProjectTable';
import AddIcon from '@mui/icons-material/Add';
import { activeBarsColorVariables, buttonThemeProvider } from '@octacore-frontend/constant';

function ProjectTechnology() {
  const array = new Array(5).fill("values")
  return(
  <>
  <Box textAlign="left">
        <Typography component="span">
          Projects/
          <Typography component="span" color="pink">Technology</Typography>
        </Typography>
        <Typography variant="h4" gutterBottom>Technology</Typography>
      </Box>
      <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ mt: 2 }}>
        <Typography variant="h5">SUPPORT PROJECT</Typography>
      </Box>
      <SupportProjectTable supportTableData={array} />
      <ThemeProvider theme={buttonThemeProvider}>
      <Button  variant='contained' startIcon={<AddIcon/>}>Add Technology</Button>
      </ThemeProvider>
      
  </>
  )
}

export default ProjectTechnology;
