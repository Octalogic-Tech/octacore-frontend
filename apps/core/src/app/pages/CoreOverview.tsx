import React from 'react';
import { Grid, Typography, Box } from '@mui/material';
import { Cards } from '@octacore-frontend/shared-ui';
import { OutstandingTable } from './OutstandingInvoiceTable';
import { FollowUpsTable } from './FollowUpsTable';

function CoreOverview() {
  const currentDate = new Date();
  const currentMonth = currentDate.toLocaleString('default', { month: 'long' });
  const outstandingInvoiceTableData = new Array(5).fill('values');
  const followUpstableData = new Array(5).fill('values');

  return (
    <>
      <Box textAlign="left">
        <Typography component="span">
          core/
          <Typography component="span" color="pink">
            overview
          </Typography>
        </Typography>
        <Typography variant="h4" sx={{ margin: 0, padding: 0 }}>
          Overview
        </Typography>
      </Box>
      <Grid container spacing={4}>
        <Grid item xs={12} sm={6} md={4} lg={3}>
          <Cards currentMonth={currentMonth} />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={3}>
          <Cards currentMonth={currentMonth} />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={3}>
          <Cards currentMonth={currentMonth} />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={3}>
          <Cards currentMonth={currentMonth} />
        </Grid>
      </Grid>
      <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ mt: 2 }}>
        <Typography variant="h5">OUTSTANDING INVOICES</Typography>
        <Typography variant="body1" color="primary" style={{ cursor: 'pointer' }}>
          View All
        </Typography>
      </Box>
      <OutstandingTable outstandingInvoice={outstandingInvoiceTableData} />
      <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ mt: 2 }}>
        <Typography variant="h5">FOLLOW UPS</Typography>
        <Typography variant="body1" color="primary" style={{ cursor: 'pointer' }}>
          View All
        </Typography>
      </Box>
      <FollowUpsTable followUpstableData={followUpstableData} />
    </>
  );
}

export default CoreOverview;
