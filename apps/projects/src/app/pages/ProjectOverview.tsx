import React from 'react';
import { Grid, Typography, Box } from '@mui/material';
import { ExpenseCards, SalaryCard } from '@octacore-frontend/shared-ui';
import { SupportProjectTable } from './SupportProjectTable';
import { OngoingDevelopmentTable } from './OngoingDevelopmentTable';

function ProjectOverview() {
  const currentDate = new Date();
  const currentMonth = currentDate.toLocaleString('default', { month: 'long' });
  const ongoingDevelopmentTableData = new Array(5).fill('values');
  const supportTableData = new Array(5).fill('values');

  return (
    <>
      <Box textAlign="left">
        <Typography component="span">
          Projects/
          <Typography component="span" color="pink">overview</Typography>
        </Typography>
        <Typography variant="h4">Overview</Typography>
      </Box>
      <Grid container spacing={1}>
        <Grid item xs={12} sm={6} md={4} lg={3}>
          <ExpenseCards currentMonth={currentMonth} />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={3}>
          <SalaryCard currentMonth={currentMonth} />
        </Grid>
      </Grid>
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Typography variant="h5">ONGOING DEVELOPMENT</Typography>
        <Typography variant="body1" color="primary" style={{ cursor: 'pointer' }}>
          View All
        </Typography>
      </Box>
      <OngoingDevelopmentTable ongoingDevelopmentTableData={ongoingDevelopmentTableData} />
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Typography variant="h5">SUPPORT PROJECT</Typography>
        <Typography variant="body1" color="primary" style={{ cursor: 'pointer' }}>
          View All
        </Typography>
      </Box>
      <SupportProjectTable supportTableData={supportTableData} />
    </>
  );
}

export default ProjectOverview;
