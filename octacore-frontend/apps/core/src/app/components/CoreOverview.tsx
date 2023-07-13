import React from 'react';
import { Grid } from '@mui/material';
import { Cards } from '../../../../../libs/shared-ui/src/lib/card/card';
import styles from '../../../../../libs/shared-css/shared.module.css';
import { Tables } from '@octacore-frontend/shared-ui';

function CoreOverview() {
  const currentDate = new Date();
  const currentMonth: string = currentDate.toLocaleString('default', { month: 'long' });
  const outstandingInvoice:Array<any> = new Array(5).fill("values")
  return (
    <>
    <div style={{textAlign: 'left'}}>
        <p>core/
          <span style={{color:"pink"}}>overview</span>
        </p>
        <h1 style={{margin:0, padding: 0}}>
          Overview
        </h1>
    </div>
      <Grid container spacing={4}>
      <Grid item xs={12} sm={6} md={4} lg={3}>
        <Cards currentMonth={currentMonth}/>
      </Grid>
      <Grid item xs={12} sm={6} md={4} lg={3}>
        <Cards currentMonth={currentMonth}/>
      </Grid>
      <Grid item xs={12} sm={6} md={4} lg={3}>
        <Cards currentMonth={currentMonth}/>
      </Grid>
      <Grid item xs={12} sm={6} md={4} lg={3}>
        <Cards currentMonth={currentMonth}/>
      </Grid>
    </Grid>
    <div className={styles['table-headings']}>
      <h2>
        OUTSTANDING INVOICES
      </h2>
      <p>
        View All
      </p>
    </div>
    <Tables outstandingInvoice ={ outstandingInvoice }/>
    <div className={styles['table-headings']}>
      <h2>
        FOLLOW UPS
      </h2>
      <p>
        View All
      </p>
    </div>
    <Tables outstandingInvoice ={ outstandingInvoice }/>
    </>
  );
}

export default CoreOverview;