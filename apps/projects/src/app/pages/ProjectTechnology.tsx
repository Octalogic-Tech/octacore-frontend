// projects/src/app/pages/ProjectTechnology.tsx
import { Box, Typography } from '@mui/material';
import React from 'react';
import { SupportProjectTable } from './SupportProjectTable';

function ProjectTechnology() {
  const array = new Array(5).fill("values")
  return(
  <>
  <Box textAlign="left">
        <Typography component="span">
          Projects/
          <Typography component="span" color="pink">Technology</Typography>
        </Typography>
        <Typography variant="h4">Overview</Typography>
      </Box>
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Typography variant="h5">SUPPORT PROJECT</Typography>
      </Box>
      <SupportProjectTable supportTableData={array} />
  </>
  )
}

export default ProjectTechnology;
